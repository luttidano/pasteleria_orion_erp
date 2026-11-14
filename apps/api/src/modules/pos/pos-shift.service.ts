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
import { AccountingOutboxService } from '../accounting/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/accounting-outbox-processor.service';
import { PrismaService } from '../../database/prisma.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';
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
    private readonly accountingOutboxService: AccountingOutboxService,
    private readonly accountingOutboxProcessor: AccountingOutboxProcessorService,
    private readonly posAccountingStatusService: PosAccountingStatusService,
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
            const outboxEvent =
              await this.accountingOutboxService.enqueueShiftDifferenceInTx(
                tx,
                {
                  shiftId: updatedShift.id,
                  shiftNumber: Number(updatedShift.shiftNumber),
                  closedAt: closedAtDate,
                  cashDifference,
                  entryDate: getZonedDateString(closedAtDate, STORE_TIMEZONE),
                },
              );
            enqueuedOutboxId = outboxEvent?.id ?? null;
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
    if (Math.abs(cashDiff) >= 0.01 && outboxEventId) {
      try {
        const adj =
          await this.accountingOutboxProcessor.processEvent(outboxEventId);

        if (adj.entryId) {
          finalAccountingStatus = 'posted';
          finalClosingEntryId = adj.entryId;
          finalClosingEntryNumber = adj.entryNumber;
          finalAccountingWarning = null;

          await this.posAccountingStatusService
            .markShiftPosted(closedShift.id, adj.entryId)
            .catch(() => undefined);
        }
      } catch (accError) {
        finalAccountingStatus = 'pending';
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar diferencia de caja en contabilidad.';
        finalAccountingWarning = `Turno cerrado en caja. El ajuste contable por diferencia quedó pendiente: ${errorMsg}`;
        console.warn(
          `[PosShiftService] Turno #${Number(closedShift.shiftNumber)} cerrado, ajuste contable pendiente:`,
          errorMsg,
        );

        await this.posAccountingStatusService
          .markShiftPending(closedShift.id, finalAccountingWarning)
          .catch(() => undefined);
      }
    }

    return {
      ...mapShiftRecord(closedShift),
      accountingStatus: finalAccountingStatus,
      accountingWarning: finalAccountingWarning,
      closingEntryId: finalClosingEntryId,
      closingEntryNumber: finalClosingEntryNumber,
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
      ON CONFLICT DO NOTHING
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
