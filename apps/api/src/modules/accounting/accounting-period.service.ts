import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccountingEntryOrigin, AccountingPeriodStatus } from '../../common/enums';
import {
  ExecuteAnnualClosingDto,
  PeriodIdentifierDto,
  ReverseAnnualClosingDto,
  UpdateAccountingSettingsDto,
} from './dto/accounting-period.dto';

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

export interface AnnualClosingLinePreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'ingreso' | 'costo' | 'gasto' | 'patrimonio';
  currentBalance: number;
  debit: number;
  credit: number;
  description: string;
}

export interface AnnualClosingPreview {
  year: number;
  closingDate: string;
  alreadyClosed: boolean;
  existingClosingEntryId: string | null;
  hasLaterYearClosed: boolean;
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  resultadoEjercicio: number;
  equityAccount: {
    id: string;
    code: string;
    name: string;
  } | null;
  openMonthsCount: number;
  pendingSalesCount: number;
  canExecute: boolean;
  blockingReason: string | null;
  lines: AnnualClosingLinePreview[];
}

@Injectable()
export class AccountingPeriodService {
  constructor(private readonly prisma: PrismaService) {}

  private round2(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }

  getMonthLabel(month: number): string {
    return MONTH_NAMES[month - 1] || `Mes ${month}`;
  }

  /**
   * Extrae (year, month) en UTC sin desplazamiento por zona horaria local.
   */
  extractYearMonth(dateInput: Date | string): { year: number; month: number } {
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      if (!trimmed) {
        throw new BadRequestException('Fecha contable inválida.');
      }

      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(trimmed);
      if (isoMatch) {
        const year = Number(isoMatch[1]);
        const month = Number(isoMatch[2]);
        const day = Number(isoMatch[3]);
        const check = new Date(Date.UTC(year, month - 1, day));
        if (
          year < 2000 ||
          year > 2100 ||
          month < 1 ||
          month > 12 ||
          check.getUTCFullYear() !== year ||
          check.getUTCMonth() + 1 !== month ||
          check.getUTCDate() !== day
        ) {
          throw new BadRequestException(`Fecha contable inválida: "${dateInput}".`);
        }
        return { year, month };
      }

      const parsed = new Date(trimmed);
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException(`Fecha contable inválida: "${dateInput}".`);
      }

      const year = parsed.getUTCFullYear();
      if (year < 2000 || year > 2100) {
        throw new BadRequestException(`Año contable fuera de rango (2000-2100): ${year}.`);
      }

      return {
        year,
        month: parsed.getUTCMonth() + 1,
      };
    }

    if (!(dateInput instanceof Date) || Number.isNaN(dateInput.getTime())) {
      throw new BadRequestException('Fecha contable inválida.');
    }

    const year = dateInput.getUTCFullYear();
    if (year < 2000 || year > 2100) {
      throw new BadRequestException(`Año contable fuera de rango (2000-2100): ${year}.`);
    }

    return {
      year,
      month: dateInput.getUTCMonth() + 1,
    };
  }

  private extractUtcDate(dateInput: Date | string): {
    year: number;
    month: number;
    day: number;
    dateUtc: Date;
    isoDate: string;
  } {
    const { year, month } = this.extractYearMonth(dateInput);

    let day: number;
    if (typeof dateInput === 'string') {
      const trimmed = dateInput.trim();
      const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(trimmed);
      day = isoMatch ? Number(isoMatch[3]) : new Date(trimmed).getUTCDate();
    } else {
      day = dateInput.getUTCDate();
    }

    const dateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    return {
      year,
      month,
      day,
      dateUtc,
      isoDate: dateUtc.toISOString().slice(0, 10),
    };
  }

  private getMonthDateRangeUtc(year: number, month: number): { start: Date; end: Date } {
    return {
      start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
      end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
    };
  }

  private toUtcDateOnly(d: Date): Date {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
  }

  async getAccountingSettings(db: Prisma.TransactionClient | PrismaService = this.prisma) {
    const settings = await db.accountingSettings.findUnique({
      where: { id: 'default' },
      include: { updatedBy: { select: { id: true, name: true } } },
    });

    return {
      accountingStartDate: settings?.accountingStartDate
        ? settings.accountingStartDate.toISOString().slice(0, 10)
        : null,
      updatedAt: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
      updatedBy: settings?.updatedBy ?? null,
    };
  }

  async updateAccountingSettings(dto: UpdateAccountingSettingsDto, userId?: string) {
    const parsedStart = dto.accountingStartDate
      ? this.extractUtcDate(dto.accountingStartDate)
      : null;

    return this.prisma.$transaction(async (tx) => {
      if (parsedStart) {
        const [earlierEntry, earlierPendingSale] = await Promise.all([
          tx.accountingEntry.findFirst({
            where: {
              status: 'active',
              entryDate: { lt: parsedStart.dateUtc },
            },
            orderBy: { entryDate: 'asc' },
            select: { entryNumber: true, entryDate: true },
          }),
          tx.posSale.findFirst({
            where: {
              accountingStatus: 'pending',
              soldAt: { lt: parsedStart.dateUtc },
            },
            orderBy: { soldAt: 'asc' },
            select: { ticketNumber: true, soldAt: true },
          }),
        ]);

        if (earlierEntry) {
          throw new ConflictException(
            `No puedes fijar el inicio contable en ${parsedStart.isoDate} porque ya existe el asiento activo #${Number(earlierEntry.entryNumber)} con fecha ${earlierEntry.entryDate.toISOString().slice(0, 10)}.`,
          );
        }

        if (earlierPendingSale) {
          throw new ConflictException(
            `No puedes fijar el inicio contable en ${parsedStart.isoDate} porque existe la venta POS pendiente ${earlierPendingSale.ticketNumber} (${earlierPendingSale.soldAt.toISOString().slice(0, 10)}).`,
          );
        }
      }

      const saved = await tx.accountingSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          accountingStartDate: parsedStart ? parsedStart.dateUtc : null,
          updatedById: userId ?? null,
        },
        update: {
          accountingStartDate: parsedStart ? parsedStart.dateUtc : null,
          updatedById: userId ?? null,
        },
        include: { updatedBy: { select: { id: true, name: true } } },
      });

      return {
        accountingStartDate: saved.accountingStartDate
          ? saved.accountingStartDate.toISOString().slice(0, 10)
          : null,
        updatedAt: saved.updatedAt.toISOString(),
        updatedBy: saved.updatedBy ?? null,
      };
    });
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
    const { year, month, dateUtc, isoDate } = this.extractUtcDate(dateInput);

    const settings = await db.accountingSettings.findUnique({
      where: { id: 'default' },
      select: { accountingStartDate: true },
    });

    if (settings?.accountingStartDate) {
      const minDateUtc = this.toUtcDateOnly(settings.accountingStartDate);
      if (dateUtc < minDateUtc) {
        const minIso = minDateUtc.toISOString().slice(0, 10);
        throw new ConflictException(
          `La fecha ${isoDate} es anterior al inicio contable del negocio (${minIso}). No se pueden registrar ni anular asientos previos a la apertura.`,
        );
      }
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

    const existing = await db.accountingPeriod.findUnique({
      where: { year_month: { year, month } },
    });

    if (existing && existing.status === AccountingPeriodStatus.cerrado) {
      throw new ConflictException(
        `El período contable ${this.getMonthLabel(month)} ${year} (${String(month).padStart(2, '0')}/${year}) está cerrado. No se pueden registrar ni anular asientos en ese mes.`,
      );
    }

    if (!existing) {
      try {
        await db.accountingPeriod.upsert({
          where: { year_month: { year, month } },
          create: {
            year,
            month,
            status: AccountingPeriodStatus.abierto,
          },
          update: {},
        });
      } catch (err) {
        // Revalidación ante condición de carrera concurrente
        const raced = await db.accountingPeriod.findUnique({
          where: { year_month: { year, month } },
        });
        if (raced?.status === AccountingPeriodStatus.cerrado) {
          throw new ConflictException(
            `El período contable ${this.getMonthLabel(month)} ${year} (${String(month).padStart(2, '0')}/${year}) está cerrado.`,
          );
        }
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')) {
          throw err;
        }
      }
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
    const [closedPeriods, activeClosings, settings] = await Promise.all([
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
      this.prisma.accountingSettings.findUnique({
        where: { id: 'default' },
        select: { accountingStartDate: true },
      }),
    ]);

    return {
      closedMonthKeys: new Set(closedPeriods.map((p) => `${p.year}-${p.month}`)),
      closedYears: new Set(
        activeClosings
          .map((e) => e.closingYear)
          .filter((y): y is number => typeof y === 'number'),
      ),
      accountingStartDate: settings?.accountingStartDate
        ? settings.accountingStartDate.toISOString().slice(0, 10)
        : null,
    };
  }

  async checkDate(dateStr: string) {
    const { year, month, dateUtc } = this.extractUtcDate(dateStr);

    const [annualClosing, period, settings] = await Promise.all([
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
      this.prisma.accountingSettings.findUnique({
        where: { id: 'default' },
        select: { accountingStartDate: true },
      }),
    ]);

    const startIso = settings?.accountingStartDate
      ? settings.accountingStartDate.toISOString().slice(0, 10)
      : null;
    const minDateUtc = settings?.accountingStartDate
      ? this.toUtcDateOnly(settings.accountingStartDate)
      : null;

    const isBeforeAccountingStart = Boolean(minDateUtc && dateUtc < minDateUtc);
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
      status: isOpen ? AccountingPeriodStatus.abierto : AccountingPeriodStatus.cerrado,
      isOpen,
      isYearClosed,
      isBeforeAccountingStart,
      accountingStartDate: startIso,
      reason,
    };
  }

  async getYearOverview(yearInput?: number) {
    const year = yearInput ?? new Date().getUTCFullYear();
    const yearStart = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [persistedPeriods, yearEntries, pendingSales, closingEntry, settings] = await Promise.all([
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
      this.prisma.posSale.findMany({
        where: {
          accountingStatus: 'pending',
          soldAt: {
            gte: yearStart,
            lte: yearEnd,
          },
        },
        select: {
          id: true,
          soldAt: true,
        },
      }),
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
      this.prisma.accountingSettings.findUnique({
        where: { id: 'default' },
        select: { accountingStartDate: true },
      }),
    ]);

    const startIso = settings?.accountingStartDate
      ? settings.accountingStartDate.toISOString().slice(0, 10)
      : null;

    const periodByMonth = new Map(persistedPeriods.map((p) => [p.month, p]));

    const entriesCountByMonth = new Map<number, { total: number; active: number }>();
    for (const entry of yearEntries) {
      const m = entry.entryDate.getUTCMonth() + 1;
      const cur = entriesCountByMonth.get(m) ?? { total: 0, active: 0 };
      cur.total += 1;
      if (entry.status === 'active') cur.active += 1;
      entriesCountByMonth.set(m, cur);
    }

    const pendingByMonth = new Map<number, number>();
    for (const sale of pendingSales) {
      const m = sale.soldAt.getUTCMonth() + 1;
      pendingByMonth.set(m, (pendingByMonth.get(m) ?? 0) + 1);
    }

    const periods = Array.from({ length: 12 }, (_, idx) => {
      const month = idx + 1;
      const persisted = periodByMonth.get(month);
      const entryStats = entriesCountByMonth.get(month) ?? { total: 0, active: 0 };
      const pendingCount = pendingByMonth.get(month) ?? 0;
      const monthEndIso = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      const isBeforeAccountingStart = Boolean(startIso && monthEndIso < startIso);

      return {
        id: persisted?.id ?? null,
        year,
        month,
        monthLabel: this.getMonthLabel(month),
        status:
          (persisted?.status as AccountingPeriodStatus) ?? AccountingPeriodStatus.abierto,
        closedAt: persisted?.closedAt ? persisted.closedAt.toISOString() : null,
        closedBy: persisted?.closedBy ?? null,
        reopenedAt: persisted?.reopenedAt ? persisted.reopenedAt.toISOString() : null,
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

  async closePeriod(dto: PeriodIdentifierDto, userId?: string) {
    const { year, month } = dto;
    const range = this.getMonthDateRangeUtc(year, month);
    const monthEndIso = range.end.toISOString().slice(0, 10);

    await this.prisma.$transaction(async (tx) => {
      const settings = await tx.accountingSettings.findUnique({
        where: { id: 'default' },
        select: { accountingStartDate: true },
      });

      if (settings?.accountingStartDate) {
        const startIso = settings.accountingStartDate.toISOString().slice(0, 10);
        if (monthEndIso < startIso) {
          throw new BadRequestException(
            `El período ${this.getMonthLabel(month)} ${year} es completamente anterior al inicio contable (${startIso}) y ya está bloqueado automáticamente.`,
          );
        }
      }

      const existing = await tx.accountingPeriod.findUnique({
        where: { year_month: { year, month } },
      });

      if (existing?.status === AccountingPeriodStatus.cerrado) {
        throw new ConflictException(
          `El período ${this.getMonthLabel(month)} ${year} ya se encuentra cerrado.`,
        );
      }

      const pendingSales = await tx.posSale.count({
        where: {
          accountingStatus: 'pending',
          soldAt: {
            gte: range.start,
            lte: range.end,
          },
        },
      });

      if (pendingSales > 0) {
        throw new ConflictException(
          `Hay ${pendingSales} venta(s) POS pendientes de contabilizar en ${this.getMonthLabel(month)} ${year}. Sincronízalas desde el Libro Diario antes de cerrar el período.`,
        );
      }

      const now = new Date();
      await tx.accountingPeriod.upsert({
        where: { year_month: { year, month } },
        create: {
          year,
          month,
          status: AccountingPeriodStatus.cerrado,
          closedAt: now,
          closedById: userId ?? null,
          notes: dto.notes?.trim() || null,
        },
        update: {
          status: AccountingPeriodStatus.cerrado,
          closedAt: now,
          closedById: userId ?? null,
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        },
      });
    });

    const overview = await this.getYearOverview(year);
    return overview.periods.find((p) => p.month === month);
  }

  async reopenPeriod(dto: PeriodIdentifierDto, userId?: string) {
    const { year, month } = dto;

    await this.prisma.$transaction(async (tx) => {
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

      await tx.accountingPeriod.update({
        where: { id: existing.id },
        data: {
          status: AccountingPeriodStatus.abierto,
          reopenedAt: new Date(),
          reopenedById: userId ?? null,
          ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
        },
      });
    });

    const overview = await this.getYearOverview(year);
    return overview.periods.find((p) => p.month === month);
  }

  private async buildAnnualClosingData(
    year: number,
    db: Prisma.TransactionClient | PrismaService,
  ): Promise<AnnualClosingPreview> {
    const closingDate = `${year}-12-31`;
    const cutoffEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    const [
      existingClosing,
      laterYearClosing,
      closedPeriodsCount,
      pendingSalesCount,
      equityAccount,
      nominalAccounts,
      settings,
    ] = await Promise.all([
      db.accountingEntry.findFirst({
        where: {
          origin: AccountingEntryOrigin.closing,
          closingYear: year,
          status: 'active',
        },
        select: { id: true },
      }),
      db.accountingEntry.findFirst({
        where: {
          origin: AccountingEntryOrigin.closing,
          status: 'active',
          closingYear: { gt: year },
        },
        select: { id: true, closingYear: true },
      }),
      db.accountingPeriod.count({
        where: {
          year,
          status: AccountingPeriodStatus.cerrado,
        },
      }),
      db.posSale.count({
        where: {
          accountingStatus: 'pending',
          soldAt: { lte: cutoffEnd },
        },
      }),
      db.accountingAccount.findFirst({
        where: {
          isActive: true,
          accountType: 'patrimonio',
        },
        orderBy: [
          // Priorizar explícitamente la cuenta 3102 Resultado del Ejercicio
          { code: 'desc' },
        ],
        select: { id: true, code: true, name: true },
      }),
      db.accountingAccount.findMany({
        where: {
          accountType: { in: ['ingreso', 'costo', 'gasto'] },
        },
        include: {
          entryItems: {
            where: {
              entry: {
                entryDate: { lte: cutoffEnd },
              },
            },
          },
        },
        orderBy: { code: 'asc' },
      }),
      db.accountingSettings.findUnique({
        where: { id: 'default' },
        select: { accountingStartDate: true },
      }),
    ]);

    // Priorizar exactamente la cuenta 3102 si existen múltiples cuentas patrimoniales (ej. 3101 y 3102)
    const exactEquity =
      (await db.accountingAccount.findFirst({
        where: { code: '3102', isActive: true, accountType: 'patrimonio' },
        select: { id: true, code: true, name: true },
      })) ?? equityAccount;

    const openMonthsCount = Math.max(0, 12 - closedPeriodsCount);
    const lines: AnnualClosingLinePreview[] = [];

    let totalIngresos = 0;
    let totalCostos = 0;
    let totalGastos = 0;

    for (const acc of nominalAccounts) {
      const totalDebit = acc.entryItems.reduce((sum, it) => sum + Number(it.debit), 0);
      const totalCredit = acc.entryItems.reduce((sum, it) => sum + Number(it.credit), 0);

      if (acc.accountType === 'ingreso') {
        const netCredit = this.round2(totalCredit - totalDebit);
        if (Math.abs(netCredit) < 0.01) continue;

        totalIngresos = this.round2(totalIngresos + netCredit);
        lines.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: 'ingreso',
          currentBalance: netCredit,
          debit: netCredit > 0 ? netCredit : 0,
          credit: netCredit < 0 ? this.round2(Math.abs(netCredit)) : 0,
          description: `Refundición saldo de ingreso ${year}`,
        });
      } else {
        const type = acc.accountType as 'costo' | 'gasto';
        const netDebit = this.round2(totalDebit - totalCredit);
        if (Math.abs(netDebit) < 0.01) continue;

        if (type === 'costo') {
          totalCostos = this.round2(totalCostos + netDebit);
        } else {
          totalGastos = this.round2(totalGastos + netDebit);
        }

        lines.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: type,
          currentBalance: netDebit,
          debit: netDebit < 0 ? this.round2(Math.abs(netDebit)) : 0,
          credit: netDebit > 0 ? netDebit : 0,
          description: `Refundición saldo de ${type} ${year}`,
        });
      }
    }

    const sumNominalDebit = this.round2(lines.reduce((s, l) => s + l.debit, 0));
    const sumNominalCredit = this.round2(lines.reduce((s, l) => s + l.credit, 0));
    const resultadoEjercicio = this.round2(sumNominalDebit - sumNominalCredit);

    if (exactEquity && Math.abs(resultadoEjercicio) >= 0.01) {
      lines.push({
        accountId: exactEquity.id,
        accountCode: exactEquity.code,
        accountName: exactEquity.name,
        accountType: 'patrimonio',
        currentBalance: 0,
        debit: resultadoEjercicio < 0 ? this.round2(Math.abs(resultadoEjercicio)) : 0,
        credit: resultadoEjercicio > 0 ? resultadoEjercicio : 0,
        description:
          resultadoEjercicio >= 0
            ? `Utilidad del ejercicio ${year}`
            : `Pérdida del ejercicio ${year}`,
      });
    }

    const startIso = settings?.accountingStartDate
      ? settings.accountingStartDate.toISOString().slice(0, 10)
      : null;
    const isBeforeAccountingStartYear = Boolean(
      startIso && year < Number(startIso.slice(0, 4)),
    );

    let blockingReason: string | null = null;
    if (existingClosing) {
      blockingReason = `El año ${year} ya cuenta con un Asiento de Cierre Anual activo.`;
    } else if (laterYearClosing) {
      blockingReason = `Existe un cierre anual posterior activo (año ${laterYearClosing.closingYear}). Reversa primero años posteriores.`;
    } else if (isBeforeAccountingStartYear && startIso) {
      blockingReason = `El año ${year} es completamente anterior al inicio contable configurado (${startIso}).`;
    } else if (pendingSalesCount > 0) {
      blockingReason = `Hay ${pendingSalesCount} venta(s) POS pendientes de contabilizar hasta el ${closingDate}. Sincronízalas antes de ejecutar el cierre anual.`;
    } else if (!exactEquity) {
      blockingReason =
        'No existe una cuenta patrimonial activa (ej. 3102 Resultado del Ejercicio) para recibir la refundición.';
    } else if (lines.length === 0) {
      blockingReason = `No existen saldos pendientes en cuentas de ingresos, costos o gastos al ${closingDate}.`;
    }

    return {
      year,
      closingDate,
      alreadyClosed: Boolean(existingClosing),
      existingClosingEntryId: existingClosing?.id ?? null,
      hasLaterYearClosed: Boolean(laterYearClosing),
      totalIngresos,
      totalCostos,
      totalGastos,
      resultadoEjercicio,
      equityAccount: exactEquity,
      openMonthsCount,
      pendingSalesCount,
      canExecute: blockingReason === null,
      blockingReason,
      lines,
    };
  }

  async previewAnnualClosing(yearInput?: number): Promise<AnnualClosingPreview> {
    const year = yearInput ?? new Date().getUTCFullYear();
    return this.buildAnnualClosingData(year, this.prisma);
  }

  async executeAnnualClosing(dto: ExecuteAnnualClosingDto, userId?: string) {
    const { year } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const preview = await this.buildAnnualClosingData(year, tx);
        if (!preview.canExecute) {
          throw new ConflictException(
            preview.blockingReason || `No es posible ejecutar el cierre anual de ${year}.`,
          );
        }

        const closingDateUtc = new Date(Date.UTC(year, 11, 31));
        const closingEntry = await tx.accountingEntry.create({
          data: {
            entryDate: closingDateUtc,
            concept: `Asiento de Cierre Anual (Refundición de Cuentas) - Ejercicio ${year}`,
            origin: AccountingEntryOrigin.closing,
            status: 'active',
            closingYear: year,
            items: {
              create: preview.lines.map((line) => ({
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
                description: line.description,
              })),
            },
          },
          include: {
            items: {
              include: { account: true },
            },
          },
        });

        const now = new Date();
        for (let month = 1; month <= 12; month++) {
          const existingPeriod = await tx.accountingPeriod.findUnique({
            where: { year_month: { year, month } },
          });

          const closingNotes =
            month === 12 && dto.notes?.trim()
              ? dto.notes.trim()
              : existingPeriod?.notes ?? null;

          if (!existingPeriod) {
            await tx.accountingPeriod.create({
              data: {
                year,
                month,
                status: AccountingPeriodStatus.cerrado,
                closedAt: now,
                closedById: userId ?? null,
                closingEntryId: month === 12 ? closingEntry.id : null,
                notes: closingNotes,
              },
            });
          } else {
            await tx.accountingPeriod.update({
              where: { id: existingPeriod.id },
              data: {
                status: AccountingPeriodStatus.cerrado,
                closedAt: existingPeriod.closedAt ?? now,
                closedById: existingPeriod.closedById ?? (userId ?? null),
                ...(month === 12 ? { closingEntryId: closingEntry.id } : {}),
                ...(closingNotes !== null ? { notes: closingNotes } : {}),
              },
            });
          }
        }

        return {
          success: true,
          year,
          closingDate: `${year}-12-31`,
          resultadoEjercicio: preview.resultadoEjercicio,
          entry: {
            id: closingEntry.id,
            entryNumber: Number(closingEntry.entryNumber),
            entryDate: closingEntry.entryDate.toISOString().slice(0, 10),
            concept: closingEntry.concept,
            origin: closingEntry.origin,
            itemsCount: closingEntry.items.length,
          },
        };
      });
    } catch (error) {
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`El año ${year} ya posee un cierre anual activo.`);
      }
      console.error('[AccountingPeriodService] Error en cierre anual:', error);
      throw new InternalServerErrorException('No se pudo ejecutar el asiento de cierre anual.');
    }
  }

  async reverseAnnualClosing(dto: ReverseAnnualClosingDto, userId?: string) {
    const { year, reason } = dto;

    return this.prisma.$transaction(async (tx) => {
      const laterClosing = await tx.accountingEntry.findFirst({
        where: {
          origin: AccountingEntryOrigin.closing,
          status: 'active',
          closingYear: { gt: year },
        },
        select: { closingYear: true },
      });

      if (laterClosing) {
        throw new ConflictException(
          `No se puede reversar el cierre de ${year} porque el ejercicio ${laterClosing.closingYear} ya fue cerrado.`,
        );
      }

      const original = await tx.accountingEntry.findFirst({
        where: {
          origin: AccountingEntryOrigin.closing,
          closingYear: year,
          status: 'active',
        },
        include: { items: true },
      });

      if (!original) {
        throw new NotFoundException(`No existe un Asiento de Cierre Anual activo para ${year}.`);
      }

      const now = new Date();
      await tx.accountingEntry.update({
        where: { id: original.id },
        data: {
          status: 'voided',
          voidedAt: now,
          voidedById: userId ?? null,
          voidReason: reason.trim(),
        },
      });

      const reversal = await tx.accountingEntry.create({
        data: {
          entryDate: original.entryDate,
          concept: `Reverso Cierre Anual ${year} (#${Number(original.entryNumber)}): ${reason.trim()}`,
          origin: AccountingEntryOrigin.reversal,
          status: 'active',
          reversedEntryId: original.id,
          items: {
            create: original.items.map((it) => ({
              accountId: it.accountId,
              debit: Number(it.credit),
              credit: Number(it.debit),
              description: it.description
                ? `Reverso: ${it.description}`
                : `Reverso cierre ${year}`,
            })),
          },
        },
      });

      await tx.accountingPeriod.updateMany({
        where: {
          year,
          closingEntryId: original.id,
        },
        data: {
          closingEntryId: null,
        },
      });

      return {
        success: true,
        year,
        voidedEntryId: original.id,
        reversalEntryId: reversal.id,
        reversalEntryNumber: Number(reversal.entryNumber),
        message: `Cierre anual ${year} reversado correctamente. Los meses permanecen cerrados hasta que decidas reabrir alguno.`,
      };
    });
  }
}
