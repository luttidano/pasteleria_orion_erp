import {
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  AnnualClosingExecutionResult,
  AnnualClosingLinePreview,
  AnnualClosingPreview,
  ReverseClosingResult,
} from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin, AccountingPeriodStatus } from '../../../common/enums';
import { roundMoney } from '../../../common/utils/money.util';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../../common/utils/prisma-error.util';
import { AccountingSettingsService } from './accounting-settings.service';
import { AccountingOutboxService } from '../outbox/accounting-outbox.service';
import {
  ExecuteAnnualClosingDto,
  ReverseAnnualClosingDto,
} from '../dto/accounting-period.dto';

@Injectable()
export class AnnualClosingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: AccountingSettingsService,
    private readonly outboxService: AccountingOutboxService,
  ) {}

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
      groupedItems,
      startInfo,
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
      this.outboxService.countPendingUpTo(cutoffEnd, db),
      db.accountingAccount.findFirst({
        where: {
          isActive: true,
          accountType: 'patrimonio',
        },
        orderBy: [{ code: 'desc' }],
        select: { id: true, code: true, name: true },
      }),
      db.accountingAccount.findMany({
        where: {
          accountType: { in: ['ingreso', 'costo', 'gasto'] },
        },
        orderBy: { code: 'asc' },
      }),
      db.accountingEntryItem.groupBy({
        by: ['accountId'],
        where: {
          entry: {
            entryDate: { lte: cutoffEnd },
            status: 'active',
          },
        },
        _sum: { debit: true, credit: true },
      }),
      this.settingsService.getStartDateUtc(db),
    ]);

    const exactEquity =
      (await db.accountingAccount.findFirst({
        where: { code: '3102', isActive: true, accountType: 'patrimonio' },
        select: { id: true, code: true, name: true },
      })) ?? equityAccount;

    const exact3103 = await db.accountingAccount.findFirst({
      where: { code: '3103', isActive: true, accountType: 'patrimonio' },
      select: { id: true, code: true, name: true },
    });
    const retainedEarningsAccount =
      exact3103 && exact3103.id !== exactEquity?.id ? exact3103 : null;

    let prior3102Net = 0;
    const yearStartUtc = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
    if (exactEquity && typeof db.accountingEntryItem?.aggregate === 'function') {
      const priorAgg = await db.accountingEntryItem.aggregate({
        where: {
          accountId: exactEquity.id,
          entry: {
            entryDate: { lt: yearStartUtc },
            status: 'active',
          },
        },
        _sum: { debit: true, credit: true },
      });
      const priorDebit = roundMoney(Number(priorAgg._sum.debit ?? 0));
      const priorCredit = roundMoney(Number(priorAgg._sum.credit ?? 0));
      prior3102Net = roundMoney(priorCredit - priorDebit);
    }

    const openMonthsCount = Math.max(0, 12 - closedPeriodsCount);
    const lines: AnnualClosingLinePreview[] = [];

    if (Math.abs(prior3102Net) >= 0.01 && retainedEarningsAccount && exactEquity) {
      if (prior3102Net > 0) {
        lines.push({
          accountId: exactEquity.id,
          accountCode: exactEquity.code,
          accountName: exactEquity.name,
          accountType: 'patrimonio',
          currentBalance: prior3102Net,
          debit: prior3102Net,
          credit: 0,
          description: `Traspaso saldo ejercicios anteriores a cuenta ${retainedEarningsAccount.code}`,
        });
        lines.push({
          accountId: retainedEarningsAccount.id,
          accountCode: retainedEarningsAccount.code,
          accountName: retainedEarningsAccount.name,
          accountType: 'patrimonio',
          currentBalance: 0,
          debit: 0,
          credit: prior3102Net,
          description: `Reclasificación utilidades acumuladas ejercicios anteriores`,
        });
      } else {
        const absPrior = roundMoney(Math.abs(prior3102Net));
        lines.push({
          accountId: exactEquity.id,
          accountCode: exactEquity.code,
          accountName: exactEquity.name,
          accountType: 'patrimonio',
          currentBalance: prior3102Net,
          debit: 0,
          credit: absPrior,
          description: `Traspaso saldo ejercicios anteriores a cuenta ${retainedEarningsAccount.code}`,
        });
        lines.push({
          accountId: retainedEarningsAccount.id,
          accountCode: retainedEarningsAccount.code,
          accountName: retainedEarningsAccount.name,
          accountType: 'patrimonio',
          currentBalance: 0,
          debit: absPrior,
          credit: 0,
          description: `Reclasificación pérdidas acumuladas ejercicios anteriores`,
        });
      }
    }

    let totalIngresos = 0;
    let totalCostos = 0;
    let totalGastos = 0;

    const totalsByAccount = new Map<
      string,
      { totalDebit: number; totalCredit: number }
    >();
    for (const row of groupedItems) {
      totalsByAccount.set(row.accountId, {
        totalDebit: roundMoney(Number(row._sum.debit ?? 0)),
        totalCredit: roundMoney(Number(row._sum.credit ?? 0)),
      });
    }

    for (const acc of nominalAccounts) {
      const totals = totalsByAccount.get(acc.id) ?? {
        totalDebit: 0,
        totalCredit: 0,
      };
      const totalDebit = totals.totalDebit;
      const totalCredit = totals.totalCredit;

      if (acc.accountType === 'ingreso') {
        const netCredit = roundMoney(totalCredit - totalDebit);
        if (Math.abs(netCredit) < 0.01) continue;

        totalIngresos = roundMoney(totalIngresos + netCredit);
        lines.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: 'ingreso',
          currentBalance: netCredit,
          debit: netCredit > 0 ? netCredit : 0,
          credit: netCredit < 0 ? roundMoney(Math.abs(netCredit)) : 0,
          description: `Refundición saldo de ingreso ${year}`,
        });
      } else {
        const type = acc.accountType as 'costo' | 'gasto';
        const netDebit = roundMoney(totalDebit - totalCredit);
        if (Math.abs(netDebit) < 0.01) continue;

        if (type === 'costo') {
          totalCostos = roundMoney(totalCostos + netDebit);
        } else {
          totalGastos = roundMoney(totalGastos + netDebit);
        }

        lines.push({
          accountId: acc.id,
          accountCode: acc.code,
          accountName: acc.name,
          accountType: type,
          currentBalance: netDebit,
          debit: netDebit < 0 ? roundMoney(Math.abs(netDebit)) : 0,
          credit: netDebit > 0 ? netDebit : 0,
          description: `Refundición saldo de ${type} ${year}`,
        });
      }
    }

    const sumNominalDebit = roundMoney(lines.reduce((s, l) => s + l.debit, 0));
    const sumNominalCredit = roundMoney(lines.reduce((s, l) => s + l.credit, 0));
    const resultadoEjercicio = roundMoney(sumNominalDebit - sumNominalCredit);

    if (exactEquity && Math.abs(resultadoEjercicio) >= 0.01) {
      lines.push({
        accountId: exactEquity.id,
        accountCode: exactEquity.code,
        accountName: exactEquity.name,
        accountType: 'patrimonio',
        currentBalance: 0,
        debit:
          resultadoEjercicio < 0
            ? roundMoney(Math.abs(resultadoEjercicio))
            : 0,
        credit: resultadoEjercicio > 0 ? resultadoEjercicio : 0,
        description:
          resultadoEjercicio >= 0
            ? `Utilidad del ejercicio ${year}`
            : `Pérdida del ejercicio ${year}`,
      });
    }

    const startIso = startInfo.startIso;
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
    } else if (Math.abs(prior3102Net) >= 0.01 && !retainedEarningsAccount) {
      blockingReason =
        'No existe la cuenta patrimonial activa 3103 Resultados Acumulados (Ejercicios Anteriores) para recibir el traspaso de años anteriores.';
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
      retainedEarningsAccount,
      priorEarningsTransferred:
        Math.abs(prior3102Net) >= 0.01 ? prior3102Net : undefined,
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

  async executeAnnualClosing(
    dto: ExecuteAnnualClosingDto,
    userId?: string,
  ): Promise<AnnualClosingExecutionResult> {
    const { year } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const preview = await this.buildAnnualClosingData(year, tx);
        if (!preview.canExecute) {
          throw new ConflictException(
            preview.blockingReason ||
              `No es posible ejecutar el cierre anual de ${year}.`,
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
              : (existingPeriod?.notes ?? null);

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
                closedById: existingPeriod.closedById ?? userId ?? null,
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
      if (error instanceof HttpException) {
        throw error;
      }
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `El año ${year} ya posee un cierre anual activo.`,
        );
      }
      console.error('[AnnualClosingService] Error en cierre anual:', error);
      throw new InternalServerErrorException(
        'No se pudo ejecutar el asiento de cierre anual.',
      );
    }
  }

  async reverseAnnualClosing(
    dto: ReverseAnnualClosingDto,
    userId?: string,
  ): Promise<ReverseClosingResult> {
    const { year, reason } = dto;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.accounting_entry
          WHERE origin = 'closing'
            AND closing_year = ${year}
            AND status = 'active'
          FOR UPDATE
        `;

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
          throw new NotFoundException(
            `No existe un Asiento de Cierre Anual activo para ${year}.`,
          );
        }

        const now = new Date();
        const voided = await tx.accountingEntry.updateMany({
          where: { id: original.id, status: 'active' },
          data: {
            status: 'voided',
            voidedAt: now,
            voidedById: userId ?? null,
            voidReason: reason.trim(),
          },
        });

        if (voided.count === 0) {
          throw new ConflictException(
            `El cierre anual de ${year} ya fue reversado por otra operación simultánea.`,
          );
        }

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
    } catch (error) {
      rethrowPrismaError(error, {
        fallback: `No se pudo reversar el cierre anual de ${year}.`,
      });
    }
  }
}
