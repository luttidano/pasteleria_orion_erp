import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PosActiveShiftOverview, PosShiftRecord } from '@repo/types';
import { ClosePosShiftDto, UpdateOpeningCashDto } from './dto/pos-shift.dto';
import { PrismaService } from '../../database/prisma.service';
import { PosShiftReconciliationService } from './pos-shift-reconciliation.service';
import { roundMoney } from '../../common/utils/money.util';
import {
  getTimeZoneDayBounds,
  getZonedDateString,
  resolveStoreDateRange,
  STORE_TIMEZONE,
} from '../../common/utils/chile-time.util';
import {
  aggregateSalesTotals,
  emptySalesTotals,
  mapShiftRecord,
} from './pos-totals.helper';

@Injectable()
export class PosShiftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reconciliationService: PosShiftReconciliationService,
  ) {}

  async getActiveShiftOverview(
    from?: string,
    to?: string,
  ): Promise<PosActiveShiftOverview> {
    const { startDate, endDate } = resolveStoreDateRange(
      from,
      to,
      STORE_TIMEZONE,
    );

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

      let totals = emptySalesTotals();

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
        totals = aggregateSalesTotals(grouped);
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
        totals = aggregateSalesTotals(grouped);
      }

      const openingCash = activeShift
        ? roundMoney(Number(activeShift.openingCash))
        : 0;
      const expectedCash = roundMoney(openingCash + totals.cashSalesTotal);

      return {
        businessDate: getZonedDateString(new Date(), STORE_TIMEZONE),
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
      console.error('[PosShiftService] Error consultando turno activo:', error);
      throw new InternalServerErrorException(
        'No se pudo consultar el estado del turno de caja.',
      );
    }
  }

  async updateOpeningCash(
    dto: UpdateOpeningCashDto,
    userId?: string,
  ): Promise<PosActiveShiftOverview> {
    const { startDate } = getTimeZoneDayBounds(STORE_TIMEZONE);
    const roundedOpening = roundMoney(dto.openingCash);

    try {
      await this.prisma.$transaction(async (tx) => {
        const activeShift = await this.ensureActiveShiftInTx(
          tx,
          userId,
          roundedOpening,
          startDate,
        );

        await tx.$queryRaw`
          SELECT id
          FROM public.pos_shift
          WHERE id = ${activeShift.id}::uuid
          FOR UPDATE
        `;

        await tx.posShift.update({
          where: { id: activeShift.id, status: 'abierto' },
          data: {
            openingCash: roundedOpening,
          },
        });
      });

      return this.getActiveShiftOverview();
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[PosShiftService] Error actualizando fondo inicial:', error);
      throw new InternalServerErrorException(
        'No se pudo actualizar el fondo inicial de caja.',
      );
    }
  }

  async closeShift(
    dto: ClosePosShiftDto,
    userId?: string,
  ): Promise<PosShiftRecord> {
    const { startDate, endDate } = getTimeZoneDayBounds(STORE_TIMEZONE);

    let closedShift;
    let outboxEventId: string | null = null;
    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        let openShift = await tx.posShift.findFirst({
          where: { status: 'abierto' },
          orderBy: { openedAt: 'desc' },
        });

        if (!openShift) {
          const lastClosed = await tx.posShift.findFirst({
            where: { status: 'cerrado' },
            select: { id: true },
          });

          if (lastClosed) {
            throw new ConflictException(
              'No hay un turno abierto activo para cerrar. El último turno ya fue cerrado.',
            );
          }

          const unshiftedTodayCount = await tx.posSale.count({
            where: {
              shiftId: null,
              status: 'completada',
              soldAt: {
                gte: startDate,
                lte: endDate,
              },
            },
          });

          if (unshiftedTodayCount === 0) {
            throw new BadRequestException(
              'No hay un turno abierto ni ventas activas para cerrar. Guarda el fondo inicial o registra una venta antes de realizar el arqueo.',
            );
          }

          openShift = await this.ensureActiveShiftInTx(
            tx,
            userId,
            0,
            startDate,
          );
        }

        // Bloqueo pesimista del turno antes de agregar ventas y ejecutar cierre
        await tx.$queryRaw`
          SELECT id
          FROM public.pos_shift
          WHERE id = ${openShift.id}::uuid
          FOR UPDATE
        `;

        const grouped = await tx.posSale.groupBy({
          by: ['paymentMethod'],
          where: {
            shiftId: openShift.id,
            status: 'completada',
          },
          _sum: { total: true },
          _count: { _all: true },
        });

        const totals = aggregateSalesTotals(grouped);
        const effectiveOpeningCash = roundMoney(Number(openShift.openingCash));
        const expectedCash = roundMoney(
          effectiveOpeningCash + totals.cashSalesTotal,
        );
        const countedCash = roundMoney(dto.countedCash);
        const cashDifference = roundMoney(countedCash - expectedCash);

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

        try {
          const updatedShift = await tx.posShift.update({
            where: { id: openShift.id, status: 'abierto' },
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

          let enqueuedOutboxId: string | null = null;
          if (hasDifference) {
            const closedAtDate = updatedShift.closedAt ?? now;
            enqueuedOutboxId =
              await this.reconciliationService.enqueueShiftDifferenceInTx(tx, {
                shiftId: updatedShift.id,
                shiftNumber: Number(updatedShift.shiftNumber),
                closedAt: closedAtDate,
                cashDifference,
              });
          }

          return {
            closedShift: updatedShift,
            outboxEventId: enqueuedOutboxId,
          };
        } catch (err) {
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2025'
          ) {
            throw new ConflictException(
              'El turno de caja ya fue cerrado por otra operación simultánea.',
            );
          }
          throw err;
        }
      });

      closedShift = txResult.closedShift;
      outboxEventId = txResult.outboxEventId;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[PosShiftService] Error cerrando turno de caja:', error);
      throw new InternalServerErrorException(
        'No se pudo cerrar el turno y generar el arqueo de caja.',
      );
    }

    const reconciliation =
      await this.reconciliationService.reconcileShiftDifference({
        shiftId: closedShift.id,
        shiftNumber: closedShift.shiftNumber,
        cashDifference: Number(closedShift.cashDifference ?? 0),
        outboxEventId,
        initialAccountingStatus: closedShift.accountingStatus as
          | 'none'
          | 'posted'
          | 'pending',
        initialAccountingWarning: closedShift.accountingWarning ?? null,
        initialClosingEntryId: closedShift.closingEntryId ?? null,
        initialClosingEntryNumber: closedShift.closingEntry
          ? Number(closedShift.closingEntry.entryNumber)
          : null,
      });

    return {
      ...mapShiftRecord(closedShift),
      accountingStatus: reconciliation.accountingStatus,
      accountingWarning: reconciliation.accountingWarning,
      closingEntryId: reconciliation.closingEntryId,
      closingEntryNumber: reconciliation.closingEntryNumber,
    };
  }

  async findShifts(): Promise<PosShiftRecord[]> {
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

      return shifts.map((shift) => mapShiftRecord(shift));
    } catch (error) {
      console.error(
        '[PosShiftService] Error consultando historial de arqueos:',
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo consultar el historial de arqueos de caja.',
      );
    }
  }

  async ensureActiveShiftInTx(
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
      await tx.$queryRaw`
        SELECT id
        FROM public.pos_shift
        WHERE id = ${existingOpen.id}::uuid
        FOR UPDATE
      `;
      return existingOpen;
    }

    const lastClosed = await tx.posShift.findFirst({
      where: { status: 'cerrado' },
      select: { id: true },
    });

    const normalizedUserId = userId ?? null;
    const inserted = await tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO public.pos_shift (opened_by, opening_cash, status)
      VALUES (${normalizedUserId}::uuid, ${roundMoney(openingCash)}, 'abierto')
      ON CONFLICT (status) WHERE status = 'abierto' DO NOTHING
      RETURNING id
    `;

    if (!inserted || inserted.length === 0) {
      const raced = await tx.posShift.findFirst({
        where: { status: 'abierto' },
        orderBy: { openedAt: 'desc' },
      });
      if (!raced) {
        throw new ConflictException(
          'No se pudo inicializar o recuperar el turno de caja activo.',
        );
      }
      await tx.$queryRaw`
        SELECT id
        FROM public.pos_shift
        WHERE id = ${raced.id}::uuid
        FOR UPDATE
      `;
      return raced;
    }

    const created = await tx.posShift.findUnique({
      where: { id: inserted[0].id },
    });

    if (!created) {
      throw new ConflictException(
        'No se pudo recuperar el turno de caja recién creado.',
      );
    }

    if (!lastClosed) {
      const adoptFrom =
        unshiftedFrom ?? getTimeZoneDayBounds(STORE_TIMEZONE).startDate;

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
}
