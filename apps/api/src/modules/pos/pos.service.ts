import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { ClosePosShiftDto, UpdateOpeningCashDto } from './dto/pos-shift.dto';
import { EntryService } from '../accounting/entry.service';
import { PrismaService } from '../../database/prisma.service';

const STORE_TIMEZONE = 'America/Santiago';


@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entryService: EntryService,
  ) {}

  /**
   * Registra una venta y sus productos.
   * Ejecuta la persistencia en una transacción atómica ACID mediante Prisma.
   */
  async createSale(dto: CreateSaleDto, createdById?: string) {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'La venta debe contener al menos un producto.',
      );
    }

    // Los precios enviados por el navegador no se consideran confiables.
    // Calculamos el total a partir de las líneas de la venta.
    const items = dto.items.map((item) => {
      const lineTotal = this.roundMoney(item.quantity * item.unitPrice);

      return {
        productId: item.productId ?? null,
        packagingId: item.packagingId,
        productName: item.productName.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      };
    });

    if (items.some((item) => !item.productName)) {
      throw new BadRequestException(
        'Todos los productos deben tener un nombre.',
      );
    }

    const itemsTotal = this.roundMoney(
      items.reduce((sum, item) => sum + item.lineTotal, 0),
    );

    const declaredTotal = this.roundMoney(dto.total);
    const declaredSubtotal = this.roundMoney(dto.subtotal);
    const declaredTax = this.roundMoney(dto.taxAmount);

    if (Math.abs(itemsTotal - declaredTotal) > 0.01) {
      throw new BadRequestException(
        'El total de la venta no coincide con el total de sus productos.',
      );
    }

    if (
      Math.abs(
        this.roundMoney(declaredSubtotal + declaredTax) - declaredTotal,
      ) > 0.01
    ) {
      throw new BadRequestException(
        'El subtotal más el impuesto debe coincidir con el total.',
      );
    }

    // El ticket se genera en el servidor para evitar depender
    // del número que envíe el navegador.
    const ticketNumber = `TK-${Date.now()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    // 1. Guardar la cabecera y el detalle en una transacción ACID y descontar stock
    let sale;
    try {
      sale = await this.prisma.$transaction(async (tx) => {
        // Descontar inventario de productos y empaques secundarios vendidos en mostrador
        for (const item of items) {
          if (item.productId) {
            const product = await tx.product.findUnique({
              where: { id: item.productId },
              select: {
                id: true,
                name: true,
                stock: true,
              },
            });

            if (!product) {
              throw new BadRequestException(
                `El producto "${item.productName}" no fue encontrado en el catálogo.`,
              );
            }

            if (Number(product.stock) < item.quantity) {
              throw new BadRequestException(
                `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`,
              );
            }

            // Descontar existencias del producto terminado
            await tx.product.update({
              where: { id: item.productId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });
          } else if (item.packagingId) {
            const pkg = await tx.packaging.findUnique({
              where: { id: item.packagingId },
              select: {
                id: true,
                name: true,
                stock: true,
              },
            });

            if (!pkg) {
              throw new BadRequestException(
                `El empaque "${item.productName}" no fue encontrado en el catálogo.`,
              );
            }

            if (Number(pkg.stock) < item.quantity) {
              throw new BadRequestException(
                `Stock insuficiente para el empaque "${pkg.name}". Disponible: ${pkg.stock}, solicitado: ${item.quantity}.`,
              );
            }

            // Descontar existencias del empaque secundario
            await tx.packaging.update({
              where: { id: item.packagingId },
              data: {
                stock: {
                  decrement: item.quantity,
                },
              },
            });
          }
        }

        let shiftId: string | null = null;
        if (tx.posShift) {
          const activeShift = await this.ensureActiveShiftInTx(tx, createdById);
          shiftId = activeShift.id;
        }

        return tx.posSale.create({
          data: {
            ticketNumber,
            paymentMethod: dto.paymentMethod,
            subtotal: declaredSubtotal,
            taxAmount: declaredTax,
            total: declaredTotal,
            status: 'completada',
            accountingStatus: 'posted',
            dataOrigin: 'real',
            createdById: createdById ?? null,
            ...(shiftId ? { shiftId } : {}),
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            createdBy: {
              select: { id: true, name: true, role: true },
            },
          },
        });
      });
    } catch (createError) {
      if (createError instanceof BadRequestException) {
        throw createError;
      }
      console.error(
        '[PosService] Error registrando venta de forma atómica:',
        createError,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar la venta ni actualizar el inventario.',
      );
    }

    // 2. Registrar el ingreso contable asociado a esta venta (desacoplado y con tolerancia a fallos)
    let accountingStatus: 'posted' | 'pending' = 'posted';
    let accountingWarning: string | null = null;

    const accountingEntryCreated = declaredTotal > 0;
    if (accountingEntryCreated) {
      try {
        await this.entryService.registerSaleIncome({
          id: sale.id,
          ticketNumber: sale.ticketNumber,
          soldAt: sale.soldAt.toISOString(),
          total: declaredTotal,
          paymentMethod: sale.paymentMethod,
        });
      } catch (accError) {
        accountingStatus = 'pending';
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar en contabilidad';
        accountingWarning = `Venta registrada en caja. La sincronización contable quedó pendiente: ${errorMsg}`;
        console.warn(
          `[PosService] Venta ${sale.ticketNumber} guardada, pero falló la contabilización:`,
          errorMsg,
        );

        await this.prisma.posSale.update({
          where: { id: sale.id },
          data: {
            accountingStatus: 'pending',
            accountingError: errorMsg,
          },
        });
      }
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      status: sale.status,
      accountingStatus,
      accountingWarning,
      soldAt: sale.soldAt.toISOString(),
      dataOrigin: sale.dataOrigin,
      cashierName: sale.createdBy?.name || 'Cajero no asignado',
      cashierRole: sale.createdBy?.role || 'cashier',
      accountingEntryCreated,
      items: sale.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        line_total: Number(item.lineTotal),
        saleId: item.saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  /**
   * Obtiene las últimas ventas guardadas.
   */
  async findAllSales() {
    try {
      const sales = await this.prisma.posSale.findMany({
        include: {
          items: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          }
        },
        orderBy: { soldAt: 'desc' },
        take: 20,
      });

      return sales.map((sale) => ({
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        paymentMethod: sale.paymentMethod,
        subtotal: Number(sale.subtotal),
        taxAmount: Number(sale.taxAmount),
        total: Number(sale.total),
        status: sale.status,
        accountingStatus: sale.accountingStatus ?? 'posted',
        accountingError: sale.accountingError ?? null,
        soldAt: sale.soldAt.toISOString(),
        dataOrigin: sale.dataOrigin,
        cashierName: sale.createdBy?.name || 'Cajero no asignado',
        cashierRole: sale.createdBy?.role || 'cashier',
        items: sale.items.map((item) => ({
          id: item.id,
          sale_id: item.saleId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          line_total: Number(item.lineTotal),
          saleId: item.saleId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      }));
    } catch (error) {
      console.error('[PosService] Error consultando ventas:', error);

      throw new InternalServerErrorException(
        'No se pudo consultar el historial de ventas.',
      );
    }
  }

  /**
   * Obtiene una venta específica con sus productos.
   */
  async findSaleById(id: string) {
    let sale;
    try {
      sale = await this.prisma.posSale.findUnique({
        where: { id },
        include: {
          items: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });
    } catch (error) {
      console.error('[PosService] Error consultando venta:', error);

      throw new InternalServerErrorException(
        'No se pudo consultar la venta.',
      );
    }

    if (!sale) {
      throw new BadRequestException('La venta solicitada no existe.');
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      status: sale.status,
      accountingStatus: sale.accountingStatus ?? 'posted',
      accountingError: sale.accountingError ?? null,
      soldAt: sale.soldAt.toISOString(),
      dataOrigin: sale.dataOrigin,
      cashierName: sale.createdBy?.name || 'Cajero no asignado',
      cashierRole: sale.createdBy?.role || 'cashier',
      items: sale.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        line_total: Number(item.lineTotal),
        saleId: item.saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  async getSalesSummary(from?: string, to?: string) {
    const { startDate, endDate } = this.resolveDateRange(from, to);

    try {
      const grouped = await this.prisma.posSale.groupBy({
        by: ['paymentMethod'],
        where: {
          status: 'completada',
          soldAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { total: true },
        _count: { _all: true },
      });

      const totals = this.aggregateSalesTotals(grouped);

      return {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        ...totals,
      };
    } catch (error) {
      console.error('[PosService] Error calculando resumen de caja:', error);
      throw new InternalServerErrorException(
        'No se pudo calcular el resumen de ventas de caja.',
      );
    }
  }

  async getActiveShiftOverview(from?: string, to?: string) {
    const { startDate, endDate } = this.resolveDateRange(from, to);

    try {
      const [activeShift, lastClosedShift] = await Promise.all([
        this.prisma.posShift.findFirst({
          where: { status: 'abierto' },
          include: {
            openedBy: { select: { id: true, name: true } },
          },
          orderBy: { openedAt: 'desc' },
        }),
        this.prisma.posShift.findFirst({
          where: { status: 'cerrado' },
          include: {
            closedBy: { select: { id: true, name: true } },
          },
          orderBy: { closedAt: 'desc' },
        }),
      ]);

      let totals = this.emptySalesTotals();

      if (activeShift) {
        const grouped = await this.prisma.posSale.groupBy({
          by: ['paymentMethod'],
          where: {
            shiftId: activeShift.id,
            status: 'completada',
          },
          _sum: { total: true },
          _count: { _all: true },
        });
        totals = this.aggregateSalesTotals(grouped);
      } else if (!lastClosedShift) {
        const grouped = await this.prisma.posSale.groupBy({
          by: ['paymentMethod'],
          where: {
            shiftId: null,
            status: 'completada',
            soldAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          _sum: { total: true },
          _count: { _all: true },
        });
        totals = this.aggregateSalesTotals(grouped);
      }

      const openingCash = activeShift
        ? this.roundMoney(Number(activeShift.openingCash))
        : 0;
      const expectedCash = this.roundMoney(openingCash + totals.cashSalesTotal);

      return {
        businessDate: this.getZonedDateString(),
        hasOpenShift: Boolean(activeShift),
        activeShiftId: activeShift?.id ?? null,
        shiftNumber: activeShift ? Number(activeShift.shiftNumber) : null,
        openedAt: activeShift ? activeShift.openedAt.toISOString() : null,
        openedByName: activeShift?.openedBy?.name ?? null,
        openingCash,
        ...totals,
        expectedCash,
        lastClosedShift: lastClosedShift
          ? {
              id: lastClosedShift.id,
              shiftNumber: Number(lastClosedShift.shiftNumber),
              closedAt: (
                lastClosedShift.closedAt ?? lastClosedShift.openedAt
              ).toISOString(),
              closedByName: lastClosedShift.closedBy?.name ?? 'Cajero',
              totalSales: Number(lastClosedShift.totalSales),
              expectedCash: Number(lastClosedShift.expectedCash),
              countedCash: Number(
                lastClosedShift.countedCash ?? lastClosedShift.expectedCash,
              ),
              cashDifference: Number(lastClosedShift.cashDifference ?? 0),
            }
          : null,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[PosService] Error consultando turno activo:', error);
      throw new InternalServerErrorException(
        'No se pudo consultar el estado del turno de caja.',
      );
    }
  }

  async updateOpeningCash(dto: UpdateOpeningCashDto, userId?: string) {
    const { startDate } = this.resolveDateRange(dto.from, dto.to);
    const roundedOpening = this.roundMoney(dto.openingCash);

    try {
      await this.prisma.$transaction(async (tx) => {
        const activeShift = await this.ensureActiveShiftInTx(
          tx,
          userId,
          roundedOpening,
          startDate,
        );

        await tx.posShift.update({
          where: { id: activeShift.id },
          data: {
            openingCash: roundedOpening,
          },
        });
      });

      return this.getActiveShiftOverview(dto.from, dto.to);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[PosService] Error actualizando fondo inicial:', error);
      throw new InternalServerErrorException(
        'No se pudo actualizar el fondo inicial de caja.',
      );
    }
  }

  async closeShift(dto: ClosePosShiftDto, userId?: string) {
    const { startDate, endDate } = this.resolveDateRange(dto.from, dto.to);

    let closedShift;
    try {
      closedShift = await this.prisma.$transaction(async (tx) => {
        let openShift = await tx.posShift.findFirst({
          where: { status: 'abierto' },
          orderBy: { openedAt: 'desc' },
        });

        if (!openShift) {
          const lastClosed = await tx.posShift.findFirst({
            where: { status: 'cerrado' },
            select: { id: true },
          });

          const unshiftedTodayCount = !lastClosed
            ? await tx.posSale.count({
                where: {
                  shiftId: null,
                  status: 'completada',
                  soldAt: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
              })
            : 0;

          if (
            (dto.openingCash ?? 0) === 0 &&
            dto.countedCash === 0 &&
            unshiftedTodayCount === 0
          ) {
            throw new BadRequestException(
              'No hay un turno activo con ventas ni fondo inicial para cerrar.',
            );
          }

          openShift = await this.ensureActiveShiftInTx(
            tx,
            userId,
            dto.openingCash ?? 0,
            startDate,
          );
        }

        const grouped = await tx.posSale.groupBy({
          by: ['paymentMethod'],
          where: {
            shiftId: openShift.id,
            status: 'completada',
          },
          _sum: { total: true },
          _count: { _all: true },
        });

        const totals = this.aggregateSalesTotals(grouped);
        const effectiveOpeningCash =
          dto.openingCash !== undefined
            ? this.roundMoney(dto.openingCash)
            : this.roundMoney(Number(openShift.openingCash));
        const expectedCash = this.roundMoney(
          effectiveOpeningCash + totals.cashSalesTotal,
        );
        const countedCash = this.roundMoney(dto.countedCash);
        const cashDifference = this.roundMoney(countedCash - expectedCash);

        if (
          totals.transactionsCount === 0 &&
          effectiveOpeningCash === 0 &&
          countedCash === 0
        ) {
          throw new BadRequestException(
            'No puedes cerrar un turno sin ventas, fondo inicial ni efectivo contado.',
          );
        }

        const hasDifference = Math.abs(cashDifference) >= 0.01;
        const now = new Date();

        return tx.posShift.update({
          where: { id: openShift.id },
          data: {
            status: 'cerrado',
            closedAt: now,
            closedById: userId ?? null,
            openingCash: effectiveOpeningCash,
            totalSales: totals.totalSales,
            transactionsCount: totals.transactionsCount,
            cashSalesTotal: totals.cashSalesTotal,
            debitTotal: totals.debitTotal,
            creditTotal: totals.creditTotal,
            transferTotal: totals.transferTotal,
            cardPosTotal: totals.cardPosTotal,
            expectedCash,
            countedCash,
            cashDifference,
            notes: dto.notes?.trim() || null,
            accountingStatus: hasDifference ? 'pending' : 'none',
          },
          include: {
            openedBy: { select: { id: true, name: true } },
            closedBy: { select: { id: true, name: true } },
            closingEntry: { select: { id: true, entryNumber: true } },
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[PosService] Error cerrando turno de caja:', error);
      throw new InternalServerErrorException(
        'No se pudo cerrar el turno y generar el arqueo de caja.',
      );
    }

    let finalAccountingStatus = closedShift.accountingStatus as
      | 'none'
      | 'posted'
      | 'pending';
    let finalAccountingWarning: string | null =
      closedShift.accountingWarning ?? null;
    let finalClosingEntryId = closedShift.closingEntryId ?? null;
    let finalClosingEntryNumber = closedShift.closingEntry
      ? Number(closedShift.closingEntry.entryNumber)
      : null;

    const cashDiff = Number(closedShift.cashDifference ?? 0);
    if (Math.abs(cashDiff) >= 0.01) {
      try {
        const closedAtDate = closedShift.closedAt ?? new Date();
        const adj = await this.entryService.registerShiftDifferenceAdjustment({
          shiftId: closedShift.id,
          shiftNumber: Number(closedShift.shiftNumber),
          closedAt: closedAtDate.toISOString(),
          cashDifference: cashDiff,
          entryDate: dto.localDate || this.getZonedDateString(closedAtDate),
        });

        if (adj) {
          finalAccountingStatus = 'posted';
          finalClosingEntryId = adj.entryId;
          finalClosingEntryNumber = adj.entryNumber;
          finalAccountingWarning = null;

          await this.prisma.posShift.update({
            where: { id: closedShift.id },
            data: {
              accountingStatus: 'posted',
              closingEntryId: adj.entryId,
              accountingWarning: null,
            },
          });
        }
      } catch (accError) {
        finalAccountingStatus = 'pending';
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar diferencia de caja en contabilidad.';
        finalAccountingWarning = `Turno cerrado en caja. El ajuste contable por diferencia quedó pendiente: ${errorMsg}`;
        console.warn(
          `[PosService] Turno #${Number(closedShift.shiftNumber)} cerrado, ajuste contable pendiente:`,
          errorMsg,
        );

        await this.prisma.posShift.update({
          where: { id: closedShift.id },
          data: {
            accountingStatus: 'pending',
            accountingWarning: finalAccountingWarning,
          },
        });
      }
    }

    return {
      ...this.mapShiftRecord(closedShift),
      accountingStatus: finalAccountingStatus,
      accountingWarning: finalAccountingWarning,
      closingEntryId: finalClosingEntryId,
      closingEntryNumber: finalClosingEntryNumber,
    };
  }

  async findShifts() {
    try {
      const shifts = await this.prisma.posShift.findMany({
        where: { status: 'cerrado' },
        include: {
          openedBy: { select: { id: true, name: true } },
          closedBy: { select: { id: true, name: true } },
          closingEntry: { select: { id: true, entryNumber: true } },
        },
        orderBy: [{ closedAt: 'desc' }, { shiftNumber: 'desc' }],
        take: 30,
      });

      return shifts.map((shift) => this.mapShiftRecord(shift));
    } catch (error) {
      console.error('[PosService] Error consultando historial de arqueos:', error);
      throw new InternalServerErrorException(
        'No se pudo consultar el historial de arqueos de caja.',
      );
    }
  }

  private async ensureActiveShiftInTx(
    tx: Prisma.TransactionClient,
    userId?: string,
    openingCash = 0,
    unshiftedFrom?: Date,
  ) {
    const existingOpen = await tx.posShift.findFirst({
      where: { status: 'abierto' },
      orderBy: { openedAt: 'desc' },
    });

    if (existingOpen) {
      return existingOpen;
    }

    const lastClosed = await tx.posShift.findFirst({
      where: { status: 'cerrado' },
      select: { id: true },
    });

    let created;
    try {
      created = await tx.posShift.create({
        data: {
          status: 'abierto',
          openedById: userId ?? null,
          openingCash: this.roundMoney(openingCash),
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const raced = await tx.posShift.findFirst({
          where: { status: 'abierto' },
          orderBy: { openedAt: 'desc' },
        });
        if (raced) {
          return raced;
        }
      }
      throw err;
    }

    if (!lastClosed && typeof tx.posSale?.updateMany === 'function') {
      const adoptFrom =
        unshiftedFrom ?? this.getTimeZoneDayBounds(STORE_TIMEZONE).startDate;

      await tx.posSale.updateMany({
        where: {
          shiftId: null,
          status: 'completada',
          soldAt: { gte: adoptFrom },
        },
        data: { shiftId: created.id },
      });
    }

    return created;
  }

  private getZonedInstant(
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number,
    second: number,
    ms: number,
    timeZone = STORE_TIMEZONE,
  ): Date {
    const utcBaseline = Date.UTC(year, month - 1, day, hour, minute, second, ms);
    const getOffsetMs = (utcMs: number): number => {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      }).formatToParts(new Date(utcMs));

      const map: Record<string, number> = {};
      for (const p of parts) {
        if (p.type !== 'literal') {
          map[p.type] = Number(p.value);
        }
      }

      const h = map.hour === 24 ? 0 : map.hour;
      const asUtc = Date.UTC(
        map.year,
        map.month - 1,
        map.day,
        h,
        map.minute,
        map.second,
        0,
      );
      return asUtc - (utcMs - (utcMs % 1000));
    };

    const firstPass = utcBaseline - getOffsetMs(utcBaseline);
    const secondPass = utcBaseline - getOffsetMs(firstPass);
    return new Date(secondPass);
  }

  private getZonedDateParts(
    refDate: Date = new Date(),
    timeZone = STORE_TIMEZONE,
  ): { year: number; month: number; day: number } {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(refDate);

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = Number(p.value);
      }
    }

    return {
      year: map.year,
      month: map.month,
      day: map.day,
    };
  }

  private getZonedDateString(
    refDate: Date = new Date(),
    timeZone = STORE_TIMEZONE,
  ): string {
    const { year, month, day } = this.getZonedDateParts(refDate, timeZone);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private getTimeZoneDayBounds(
    timeZone = STORE_TIMEZONE,
    refDate: Date = new Date(),
  ): { startDate: Date; endDate: Date; businessDate: string } {
    const { year, month, day } = this.getZonedDateParts(refDate, timeZone);
    return {
      startDate: this.getZonedInstant(year, month, day, 0, 0, 0, 0, timeZone),
      endDate: this.getZonedInstant(year, month, day, 23, 59, 59, 999, timeZone),
      businessDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    };
  }

  private resolveDateRange(
    from?: string,
    to?: string,
  ): { startDate: Date; endDate: Date } {
    const bounds = this.getTimeZoneDayBounds(STORE_TIMEZONE);
    const startDate = from ? new Date(from) : bounds.startDate;
    const endDate = to ? new Date(to) : bounds.endDate;

    if (
      Number.isNaN(startDate.getTime()) ||
      Number.isNaN(endDate.getTime()) ||
      startDate > endDate
    ) {
      throw new BadRequestException(
        'Rango de fechas inválido para el resumen de caja.',
      );
    }

    return { startDate, endDate };
  }

  private emptySalesTotals() {
    return {
      totalSales: 0,
      transactionsCount: 0,
      cashSalesTotal: 0,
      cardPosTotal: 0,
      debitTotal: 0,
      creditTotal: 0,
      transferTotal: 0,
    };
  }

  private aggregateSalesTotals(
    grouped: Array<{
      paymentMethod: string;
      _sum: { total: unknown };
      _count: { _all: number };
    }>,
  ) {
    let cashSalesTotal = 0;
    let debitTotal = 0;
    let creditTotal = 0;
    let transferTotal = 0;
    let transactionsCount = 0;

    for (const row of grouped) {
      const amount = Number(row._sum.total ?? 0);
      const count = row._count._all ?? 0;
      transactionsCount += count;

      switch (row.paymentMethod) {
        case 'efectivo':
          cashSalesTotal += amount;
          break;
        case 'debito':
          debitTotal += amount;
          break;
        case 'credito':
          creditTotal += amount;
          break;
        case 'transferencia':
          transferTotal += amount;
          break;
      }
    }

    cashSalesTotal = this.roundMoney(cashSalesTotal);
    debitTotal = this.roundMoney(debitTotal);
    creditTotal = this.roundMoney(creditTotal);
    transferTotal = this.roundMoney(transferTotal);
    const cardPosTotal = this.roundMoney(debitTotal + creditTotal);
    const totalSales = this.roundMoney(
      cashSalesTotal + cardPosTotal + transferTotal,
    );

    return {
      totalSales,
      transactionsCount,
      cashSalesTotal,
      cardPosTotal,
      debitTotal,
      creditTotal,
      transferTotal,
    };
  }

  private mapShiftRecord(shift: {
    id: string;
    shiftNumber: bigint;
    status: string;
    openedAt: Date;
    openedBy?: { id: string; name: string } | null;
    closedAt: Date | null;
    closedBy?: { id: string; name: string } | null;
    openingCash: unknown;
    totalSales: unknown;
    transactionsCount: number;
    cashSalesTotal: unknown;
    debitTotal: unknown;
    creditTotal: unknown;
    transferTotal: unknown;
    cardPosTotal: unknown;
    expectedCash: unknown;
    countedCash: unknown;
    cashDifference: unknown;
    notes: string | null;
    closingEntryId: string | null;
    closingEntry?: { id: string; entryNumber: bigint } | null;
    accountingStatus: string;
    accountingWarning: string | null;
  }) {
    return {
      id: shift.id,
      shiftNumber: Number(shift.shiftNumber),
      status: shift.status as 'abierto' | 'cerrado',
      openedAt: shift.openedAt.toISOString(),
      openedBy: shift.openedBy ?? null,
      closedAt: shift.closedAt ? shift.closedAt.toISOString() : null,
      closedBy: shift.closedBy ?? null,
      openingCash: Number(shift.openingCash),
      totalSales: Number(shift.totalSales),
      transactionsCount: shift.transactionsCount,
      cashSalesTotal: Number(shift.cashSalesTotal),
      debitTotal: Number(shift.debitTotal),
      creditTotal: Number(shift.creditTotal),
      transferTotal: Number(shift.transferTotal),
      cardPosTotal: Number(shift.cardPosTotal),
      expectedCash: Number(shift.expectedCash),
      countedCash:
        shift.countedCash !== null && shift.countedCash !== undefined
          ? Number(shift.countedCash)
          : null,
      cashDifference:
        shift.cashDifference !== null && shift.cashDifference !== undefined
          ? Number(shift.cashDifference)
          : null,
      notes: shift.notes ?? null,
      closingEntryId: shift.closingEntryId ?? null,
      closingEntryNumber: shift.closingEntry
        ? Number(shift.closingEntry.entryNumber)
        : null,
      accountingStatus: shift.accountingStatus as
        | 'none'
        | 'posted'
        | 'pending',
      accountingWarning: shift.accountingWarning ?? null,
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}