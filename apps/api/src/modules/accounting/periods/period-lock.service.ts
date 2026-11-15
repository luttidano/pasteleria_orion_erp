import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { PeriodCheckResult } from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin, AccountingPeriodStatus } from '../../../common/enums';
import {
  extractUtcDate,
  extractYearMonth as extractYearMonthUtc,
} from '../../../common/utils/chile-time.util';
import { AccountingSettingsService } from './accounting-settings.service';

export const MONTH_NAMES = [
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

export function getMonthName(month: number): string {
  return MONTH_NAMES[month - 1] || `Mes ${month}`;
}

@Injectable()
export class PeriodLockService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: AccountingSettingsService,
  ) {}

  getMonthLabel(month: number): string {
    return getMonthName(month);
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
}
