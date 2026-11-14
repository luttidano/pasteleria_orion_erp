import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AccountingPeriod,
  AccountingYearOverview,
  PeriodCheckResult,
} from '@repo/types';
import { PrismaService } from '../../database/prisma.service';
import { AccountingEntryOrigin, AccountingPeriodStatus } from '../../common/enums';
import {
  extractUtcDate,
  extractYearMonth as extractYearMonthUtc,
  getMonthDateRangeUtc,
} from '../../common/utils/chile-time.util';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../common/utils/prisma-error.util';
import { AccountingSettingsService } from './accounting-settings.service';
import { AccountingOutboxService } from './accounting-outbox.service';
import { PeriodIdentifierDto } from './dto/accounting-period.dto';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

@Injectable()
export class AccountingPeriodService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: AccountingSettingsService,
    private readonly outboxService: AccountingOutboxService,
  ) {}

  getMonthLabel(month: number): string {
    return MONTH_NAMES[month - 1] || `Mes ${month}`;
  }

  /**
   * Extrae (year, month) en UTC sin desplazamiento por zona horaria local.
   */
  extractYearMonth(dateInput: Date | string): { year: number; month: number } {
    return extractYearMonthUtc(dateInput);
  }

  /**
   * Guardián transaccional que impide insertar o anular asientos previos al inicio contable,
   * en meses cerrados o en años ya refundidos.
   */
  async assertPeriodOpen(
    dateInput: Date | string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ year: number; month: number }> {
    const db = tx ?? this.prisma;
    const { year, month, dateUtc, isoDate } = extractUtcDate(dateInput);

    const { minDateUtc, startIso } = await this.settingsService.getStartDateUtc(db);
    if (minDateUtc && startIso && dateUtc < minDateUtc) {
      throw new ConflictException(
        `La fecha ${isoDate} es anterior al inicio contable del negocio (${startIso}). No se pueden registrar ni anular asientos previos a la apertura.`,
      );
    }

    const annualClosing = await db.accountingEntry.findFirst({
      where: {
        origin: AccountingEntryOrigin.closing,
        closingYear: year,
        status: 'active',
      },
      select: { id: true, entryNumber: true },
    });

    if (annualClosing) {
      throw new ConflictException(
        `El ejercicio ${year} ya cuenta con un Asiento de Cierre Anual (#${Number(annualClosing.entryNumber)}). No se pueden registrar ni anular asientos en ${this.getMonthLabel(month)} ${year}.`,
      );
    }

    await db.$executeRaw`
      INSERT INTO public.accounting_period ("id", "year", "month", "status", "created_at", "updated_at")
      VALUES (gen_random_uuid(), ${year}, ${month}, 'abierto', NOW(), NOW())
      ON CONFLICT ("year", "month") DO NOTHING
    `;

    const periods = await db.$queryRaw<Array<{ status: string }>>`
      SELECT status
      FROM public.accounting_period
      WHERE "year" = ${year} AND "month" = ${month}
      FOR SHARE
    `;

    const currentPeriod = periods[0];
    if (currentPeriod && currentPeriod.status === AccountingPeriodStatus.cerrado) {
      throw new ConflictException(
        `El período contable ${this.getMonthLabel(month)} ${year} (${String(month).padStart(2, '0')}/${year}) está cerrado. No se pueden registrar ni anular asientos en ese mes.`,
      );
    }

    return { year, month };
  }

  /**
   * Mapa rápido para saber qué períodos o años fiscales están bloqueados.
   */
  async getLockedLookup(): Promise<{
    closedMonthKeys: Set<string>;
    closedYears: Set<number>;
    accountingStartDate: string | null;
  }> {
    const [closedPeriods, activeClosings, startInfo] = await Promise.all([
      this.prisma.accountingPeriod.findMany({
        where: { status: AccountingPeriodStatus.cerrado },
        select: { year: true, month: true },
      }),
      this.prisma.accountingEntry.findMany({
        where: {
          origin: AccountingEntryOrigin.closing,
          status: 'active',
          closingYear: { not: null },
        },
        select: { closingYear: true },
      }),
      this.settingsService.getStartDateUtc(this.prisma),
    ]);

    return {
      closedMonthKeys: new Set(closedPeriods.map((p) => `${p.year}-${p.month}`)),
      closedYears: new Set(
        activeClosings
          .map((e) => e.closingYear)
          .filter((y): y is number => typeof y === 'number'),
      ),
      accountingStartDate: startInfo.startIso,
    };
  }

  async checkDate(dateStr: string): Promise<PeriodCheckResult> {
    const { year, month, dateUtc } = extractUtcDate(dateStr);

    const [annualClosing, period, startInfo] = await Promise.all([
      this.prisma.accountingEntry.findFirst({
        where: {
          origin: AccountingEntryOrigin.closing,
          closingYear: year,
          status: 'active',
        },
        select: { id: true, entryNumber: true },
      }),
      this.prisma.accountingPeriod.findUnique({
        where: { year_month: { year, month } },
      }),
      this.settingsService.getStartDateUtc(this.prisma),
    ]);

    const startIso = startInfo.startIso;
    const isBeforeAccountingStart = Boolean(
      startInfo.minDateUtc && dateUtc < startInfo.minDateUtc,
    );
    const isYearClosed = Boolean(annualClosing);
    const isMonthClosed = period?.status === AccountingPeriodStatus.cerrado;
    const isOpen = !isBeforeAccountingStart && !isYearClosed && !isMonthClosed;

    let reason: string | null = null;
    if (isBeforeAccountingStart && startIso) {
      reason = `La fecha es anterior al inicio contable configurado (${startIso}).`;
    } else if (isYearClosed && annualClosing) {
      reason = `El ejercicio ${year} está cerrado con Asiento de Cierre Anual (#${Number(annualClosing.entryNumber)}).`;
    } else if (isMonthClosed) {
      reason = `El período ${this.getMonthLabel(month)} ${year} está cerrado.`;
    }

    return {
      date: dateStr.slice(0, 10),
      year,
      month,
      monthLabel: this.getMonthLabel(month),
      status: isOpen
        ? AccountingPeriodStatus.abierto
        : AccountingPeriodStatus.cerrado,
      isOpen,
      isYearClosed,
      isBeforeAccountingStart,
      accountingStartDate: startIso,
      reason,
    };
  }

  async getYearOverview(yearInput?: number): Promise<AccountingYearOverview> {
    const year = yearInput ?? new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [persistedPeriods, yearEntries, pendingEvents, closingEntry, startInfo] =
      await Promise.all([
        this.prisma.accountingPeriod.findMany({
          where: { year },
          include: {
            closedBy: { select: { id: true, name: true } },
            reopenedBy: { select: { id: true, name: true } },
          },
          orderBy: { month: 'asc' },
        }),
        this.prisma.accountingEntry.findMany({
          where: {
            entryDate: {
              gte: yearStart,
              lte: yearEnd,
            },
          },
          select: {
            id: true,
            entryDate: true,
            status: true,
          },
        }),
        this.outboxService.getPendingEventsInRange(yearStart, yearEnd),
        this.prisma.accountingEntry.findFirst({
          where: {
            origin: AccountingEntryOrigin.closing,
            closingYear: year,
            status: 'active',
          },
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            concept: true,
            createdAt: true,
          },
        }),
        this.settingsService.getStartDateUtc(this.prisma),
      ]);

    const startIso = startInfo.startIso;
    const periodByMonth = new Map(persistedPeriods.map((p) => [p.month, p]));

    const entriesCountByMonth = new Map<
      number,
      { total: number; active: number }
    >();
    for (const entry of yearEntries) {
      const m = entry.entryDate.getUTCMonth() + 1;
      const cur = entriesCountByMonth.get(m) ?? { total: 0, active: 0 };
      cur.total += 1;
      if (entry.status === 'active') cur.active += 1;
      entriesCountByMonth.set(m, cur);
    }

    const pendingByMonth = new Map<number, number>();
    for (const event of pendingEvents) {
      const m = event.businessDate.getUTCMonth() + 1;
      pendingByMonth.set(m, (pendingByMonth.get(m) ?? 0) + 1);
    }

    const periods: AccountingPeriod[] = Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const persisted = periodByMonth.get(month);
      const entryStats = entriesCountByMonth.get(month) ?? {
        total: 0,
        active: 0,
      };
      const pendingCount = pendingByMonth.get(month) ?? 0;
      const monthEndIso = new Date(Date.UTC(year, month, 0))
        .toISOString()
        .slice(0, 10);
      const isBeforeAccountingStart = Boolean(startIso && monthEndIso < startIso);

      return {
        id: persisted?.id ?? null,
        year,
        month,
        monthLabel: this.getMonthLabel(month),
        status:
          (persisted?.status as AccountingPeriodStatus) ??
          AccountingPeriodStatus.abierto,
        closedAt: persisted?.closedAt ? persisted.closedAt.toISOString() : null,
        closedBy: persisted?.closedBy ?? null,
        reopenedAt: persisted?.reopenedAt
          ? persisted.reopenedAt.toISOString()
          : null,
        reopenedBy: persisted?.reopenedBy ?? null,
        closingEntryId: persisted?.closingEntryId ?? null,
        notes: persisted?.notes ?? null,
        entriesCount: entryStats.total,
        activeEntriesCount: entryStats.active,
        pendingSalesCount: pendingCount,
        isPersisted: Boolean(persisted),
        isBeforeAccountingStart,
      };
    });

    return {
      year,
      accountingStartDate: startIso,
      isYearClosed: Boolean(closingEntry),
      closingEntry: closingEntry
        ? {
            id: closingEntry.id,
            entryNumber: Number(closingEntry.entryNumber),
            entryDate: closingEntry.entryDate.toISOString().slice(0, 10),
            concept: closingEntry.concept,
            createdAt: closingEntry.createdAt.toISOString(),
          }
        : null,
      periods,
    };
  }

  async closePeriod(
    dto: PeriodIdentifierDto,
    userId?: string,
  ): Promise<AccountingPeriod | undefined> {
    const { year, month } = dto;
    const range = getMonthDateRangeUtc(year, month);
    const monthEndIso = range.end.toISOString().slice(0, 10);

    try {
      await this.prisma.$transaction(async (tx) => {
        const { startIso } = await this.settingsService.getStartDateUtc(tx);
        if (startIso && monthEndIso < startIso) {
          throw new BadRequestException(
            `El período ${this.getMonthLabel(month)} ${year} es completamente anterior al inicio contable (${startIso}) y ya está bloqueado automáticamente.`,
          );
        }

        await tx.$queryRaw`
          SELECT id
          FROM public.accounting_period
          WHERE year = ${year} AND month = ${month}
          FOR UPDATE
        `;

        const existing = await tx.accountingPeriod.findUnique({
          where: { year_month: { year, month } },
        });

        if (existing?.status === AccountingPeriodStatus.cerrado) {
          throw new ConflictException(
            `El período ${this.getMonthLabel(month)} ${year} ya se encuentra cerrado.`,
          );
        }

        const pendingOutboxCount = await this.outboxService.countPendingInRange(
          range.start,
          range.end,
          tx,
        );

        if (pendingOutboxCount > 0) {
          throw new ConflictException(
            `Hay ${pendingOutboxCount} evento(s) POS pendientes de contabilizar en ${this.getMonthLabel(month)} ${year}. Sincronízalos desde el Libro Diario antes de cerrar el período.`,
          );
        }

        const now = new Date();
        if (existing) {
          const updated = await tx.accountingPeriod.updateMany({
            where: {
              id: existing.id,
              status: AccountingPeriodStatus.abierto,
            },
            data: {
              status: AccountingPeriodStatus.cerrado,
              closedAt: now,
              closedById: userId ?? null,
              ...(dto.notes !== undefined
                ? { notes: dto.notes.trim() || null }
                : {}),
            },
          });

          if (updated.count === 0) {
            throw new ConflictException(
              `El período ${this.getMonthLabel(month)} ${year} fue cerrado por otra operación simultánea.`,
            );
          }
        } else {
          await tx.accountingPeriod.create({
            data: {
              year,
              month,
              status: AccountingPeriodStatus.cerrado,
              closedAt: now,
              closedById: userId ?? null,
              notes: dto.notes?.trim() || null,
            },
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `El período ${this.getMonthLabel(month)} ${year} fue modificado por otra operación simultánea.`,
        );
      }
      rethrowPrismaError(error, {
        fallback: `No se pudo cerrar el período ${this.getMonthLabel(month)} ${year}.`,
      });
    }

    const overview = await this.getYearOverview(year);
    return overview.periods.find((p) => p.month === month);
  }

  async reopenPeriod(
    dto: PeriodIdentifierDto,
    userId?: string,
  ): Promise<AccountingPeriod | undefined> {
    const { year, month } = dto;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.accounting_period
          WHERE year = ${year} AND month = ${month}
          FOR UPDATE
        `;

        const annualClosing = await tx.accountingEntry.findFirst({
          where: {
            origin: AccountingEntryOrigin.closing,
            closingYear: year,
            status: 'active',
          },
          select: { id: true, entryNumber: true },
        });

        if (annualClosing) {
          throw new ConflictException(
            `El año ${year} tiene un Asiento de Cierre Anual activo (#${Number(annualClosing.entryNumber)}). Debes reversar primero el cierre anual si necesitas reabrir un mes.`,
          );
        }

        const existing = await tx.accountingPeriod.findUnique({
          where: { year_month: { year, month } },
        });

        if (!existing || existing.status === AccountingPeriodStatus.abierto) {
          throw new BadRequestException(
            `El período ${this.getMonthLabel(month)} ${year} ya está abierto.`,
          );
        }

        const reopened = await tx.accountingPeriod.updateMany({
          where: {
            id: existing.id,
            status: AccountingPeriodStatus.cerrado,
          },
          data: {
            status: AccountingPeriodStatus.abierto,
            reopenedAt: new Date(),
            reopenedById: userId ?? null,
            ...(dto.notes !== undefined
              ? { notes: dto.notes.trim() || null }
              : {}),
          },
        });

        if (reopened.count === 0) {
          throw new ConflictException(
            `El período ${this.getMonthLabel(month)} ${year} ya fue reabierto por otra operación simultánea.`,
          );
        }
      });
    } catch (error) {
      rethrowPrismaError(error, {
        fallback: `No se pudo reabrir el período ${this.getMonthLabel(month)} ${year}.`,
      });
    }

    const overview = await this.getYearOverview(year);
    return overview.periods.find((p) => p.month === month);
  }
}
