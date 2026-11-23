import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import type {
  BalanceSheetReport,
  FinancialSummaryReport,
  IncomeStatementReport,
  ReportAccountLine,
} from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin } from '../../../common/enums';
import { InventoryValuationService } from '../../inventory/valuation/inventory-valuation.service';
import {
  getZonedDateString,
  parseStrictUtcBounds,
  STORE_TIMEZONE,
} from '../../../common/utils/chile-time.util';
import { roundMoney, roundPercentage } from '../../../common/utils/money.util';
import {
  AssetBalanceBucket,
  classifyAssetBucket,
  classifyLiabilityBucket,
  LiabilityBalanceBucket,
} from './balance-sheet-classifier';

export type {
  BalanceSheetReport,
  FinancialSummaryReport,
  IncomeStatementReport,
  ReportAccountLine,
};

@Injectable()
export class FinancialReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryValuationService: InventoryValuationService,
  ) {}

  /**
   * Estado de Resultados (P&L / Pérdidas y Ganancias)
   * Ingresos Operacionales - Costos de Materias Primas = Margen Bruto
   * Margen Bruto - Gastos Operacionales (Sueldos, Luz, Arriendo) = Utilidad Neta
   */
  async getIncomeStatement(
    startDate?: string,
    endDate?: string,
  ): Promise<IncomeStatementReport> {
    try {
      const normalizedStart = startDate?.trim() || undefined;
      const normalizedEnd = endDate?.trim() || undefined;

      const startBounds = normalizedStart
        ? parseStrictUtcBounds(normalizedStart, 'startDate')
        : null;
      const endBounds = normalizedEnd
        ? parseStrictUtcBounds(normalizedEnd, 'endDate')
        : null;

      if (startBounds && endBounds && startBounds.isoDate > endBounds.isoDate) {
        throw new BadRequestException(
          'La fecha inicial (startDate) no puede ser posterior a la fecha final (endDate).',
        );
      }

      const dateFilter: { gte?: Date; lte?: Date } = {};
      if (startBounds) dateFilter.gte = startBounds.start;
      if (endBounds) dateFilter.lte = endBounds.end;

      const hasDateFilter = Boolean(startBounds || endBounds);

      const entryFilter = {
        origin: { not: 'closing' },
        OR: [
          { origin: { not: 'reversal' } },
          { reversedEntry: { is: { origin: { not: 'closing' } } } },
        ],
        ...(hasDateFilter ? { entryDate: dateFilter } : {}),
      };

      const [accounts, grouped] = await Promise.all([
        this.prisma.accountingAccount.findMany({
          where: {
            isActive: true,
            accountType: { in: ['ingreso', 'costo', 'gasto'] },
          },
          orderBy: { code: 'asc' },
        }),
        this.prisma.accountingEntryItem.groupBy({
          by: ['accountId'],
          where: {
            entry: entryFilter,
            account: {
              accountType: { in: ['ingreso', 'costo', 'gasto'] },
            },
          },
          _sum: { debit: true, credit: true },
        }),
      ]);

      const totalsByAccount = new Map<
        string,
        { totalDebit: number; totalCredit: number }
      >();
      for (const row of grouped) {
        totalsByAccount.set(row.accountId, {
          totalDebit: roundMoney(Number(row._sum.debit ?? 0)),
          totalCredit: roundMoney(Number(row._sum.credit ?? 0)),
        });
      }

      const incomeAccounts: ReportAccountLine[] = [];
      const costAccounts: ReportAccountLine[] = [];
      const expenseAccounts: ReportAccountLine[] = [];

      let totalIngresos = 0;
      let totalCostos = 0;
      let totalGastos = 0;

      for (const acc of accounts) {
        const totals = totalsByAccount.get(acc.id) ?? {
          totalDebit: 0,
          totalCredit: 0,
        };
        const totalDebit = totals.totalDebit;
        const totalCredit = totals.totalCredit;

        if (acc.accountType === 'ingreso') {
          const netAmount = roundMoney(totalCredit - totalDebit);
          incomeAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAmount,
          });
          totalIngresos += netAmount;
        } else if (acc.accountType === 'costo') {
          const netAmount = roundMoney(totalDebit - totalCredit);
          costAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAmount,
          });
          totalCostos += netAmount;
        } else if (acc.accountType === 'gasto') {
          const netAmount = roundMoney(totalDebit - totalCredit);
          expenseAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAmount,
          });
          totalGastos += netAmount;
        }
      }

      totalIngresos = roundMoney(totalIngresos);
      totalCostos = roundMoney(totalCostos);
      totalGastos = roundMoney(totalGastos);

      const margenBruto = roundMoney(totalIngresos - totalCostos);
      const margenBrutoPercentage =
        totalIngresos > 0 ? roundPercentage((margenBruto / totalIngresos) * 100) : 0;

      const utilidadNeta = roundMoney(margenBruto - totalGastos);
      const margenNetoPercentage =
        totalIngresos > 0
          ? roundPercentage((utilidadNeta / totalIngresos) * 100)
          : 0;

      return {
        period: {
          startDate: startBounds?.isoDate ?? null,
          endDate: endBounds?.isoDate ?? null,
        },
        ingresosOperacionales: {
          total: totalIngresos,
          accounts: incomeAccounts,
        },
        costosMateriasPrimas: {
          total: totalCostos,
          accounts: costAccounts,
        },
        margenBruto,
        margenBrutoPercentage,
        gastosOperacionales: {
          total: totalGastos,
          accounts: expenseAccounts,
        },
        utilidadNeta,
        margenNetoPercentage,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error(
        '[FinancialReportService] Error generando Estado de Resultados:',
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo generar el Estado de Resultados.',
      );
    }
  }

  /**
   * Balance General / Estado de Situación Financiera
   * Activo = Pasivo + Patrimonio
   * Incluye valorización en tiempo real del stock consultado vía InventoryValuationService.
   */
  async getBalanceSheet(asOfDate?: string): Promise<BalanceSheetReport> {
    try {
      const targetIso =
        asOfDate?.trim() || getZonedDateString(new Date(), STORE_TIMEZONE);
      const cutoffDate = parseStrictUtcBounds(targetIso, 'asOfDate').end;
      const queryYear = cutoffDate.getUTCFullYear();

      const [allAccounts, groupedItems, inventoryValuation, closedClosingEntry] =
        await Promise.all([
          this.prisma.accountingAccount.findMany({
            where: { isActive: true },
            orderBy: { code: 'asc' },
          }),
          this.prisma.accountingEntryItem.groupBy({
            by: ['accountId'],
            where: {
              entry: {
                entryDate: { lte: cutoffDate },
                status: 'active',
              },
            },
            _sum: { debit: true, credit: true },
          }),
          this.inventoryValuationService.getValuationSummary(),
          typeof this.prisma.accountingEntry?.findFirst === 'function'
            ? this.prisma.accountingEntry.findFirst({
                where: {
                  origin: AccountingEntryOrigin.closing,
                  closingYear: queryYear,
                  status: 'active',
                  entryDate: { lte: cutoffDate },
                },
                select: { id: true },
              })
            : Promise.resolve(null),
        ]);

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

      const assetBuckets: Record<AssetBalanceBucket, ReportAccountLine[]> = {
        disponible: [],
        inventarios: [],
        otrosActivos: [],
      };
      const liabilityBuckets: Record<
        LiabilityBalanceBucket,
        ReportAccountLine[]
      > = {
        obligaciones: [],
        impuestos: [],
        otrosPasivos: [],
      };
      const capitalAccounts: ReportAccountLine[] = [];
      const retainedEarningsAccounts: ReportAccountLine[] = [];

      let totalActivos = 0;
      let totalPasivos = 0;
      let totalCapital = 0;
      let totalRetainedEarnings = 0;
      let totalIngresosHist = 0;
      let totalCostosHist = 0;
      let totalGastosHist = 0;
      let balance3102 = 0;
      let account3102Info: { id: string; code: string; name: string } | null =
        null;

      for (const acc of allAccounts) {
        if (acc.isGroup) {
          continue;
        }

        const totals = totalsByAccount.get(acc.id) ?? {
          totalDebit: 0,
          totalCredit: 0,
        };
        const totalDebit = totals.totalDebit;
        const totalCredit = totals.totalCredit;

        if (acc.accountType === 'activo') {
          const balance = roundMoney(totalDebit - totalCredit);
          totalActivos += balance;
          const bucket = classifyAssetBucket(acc.code, acc.name);
          assetBuckets[bucket].push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: balance,
          });
        } else if (acc.accountType === 'pasivo') {
          const balance = roundMoney(totalCredit - totalDebit);
          totalPasivos += balance;
          const bucket = classifyLiabilityBucket(acc.code, acc.name);
          liabilityBuckets[bucket].push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: balance,
          });
        } else if (acc.accountType === 'patrimonio') {
          const balance = roundMoney(totalCredit - totalDebit);
          if (
            acc.code === '3.1.02.02' ||
            acc.name.toLowerCase().includes('acumulado') ||
            acc.name.toLowerCase().includes('anterior')
          ) {
            retainedEarningsAccounts.push({
              id: acc.id,
              code: acc.code,
              name: acc.name,
              amount: balance,
            });
            totalRetainedEarnings += balance;
          } else if (acc.code === '3.1.02.01') {
            balance3102 = balance;
            account3102Info = { id: acc.id, code: acc.code, name: acc.name };
          } else {
            capitalAccounts.push({
              id: acc.id,
              code: acc.code,
              name: acc.name,
              amount: balance,
            });
            totalCapital += balance;
          }
        } else if (acc.accountType === 'ingreso') {
          totalIngresosHist += totalCredit - totalDebit;
        } else if (acc.accountType === 'costo') {
          totalCostosHist += totalDebit - totalCredit;
        } else if (acc.accountType === 'gasto') {
          totalGastosHist += totalDebit - totalCredit;
        }
      }

      const isYearClosed = Boolean(closedClosingEntry);
      let resultadoEjercicio = 0;

      if (isYearClosed) {
        resultadoEjercicio = balance3102;
      } else {
        resultadoEjercicio = roundMoney(
          totalIngresosHist - totalCostosHist - totalGastosHist,
        );
        if (Math.abs(balance3102) >= 0.01 && account3102Info) {
          retainedEarningsAccounts.push({
            id: account3102Info.id,
            code: account3102Info.code,
            name: `${account3102Info.name} (Ejercicios Anteriores)`,
            amount: balance3102,
          });
          totalRetainedEarnings += balance3102;
        }
      }

      totalCapital = roundMoney(totalCapital);
      totalRetainedEarnings = roundMoney(totalRetainedEarnings);
      resultadoEjercicio = roundMoney(resultadoEjercicio);

      const totalPatrimonio = roundMoney(
        totalCapital + totalRetainedEarnings + resultadoEjercicio,
      );

      totalActivos = roundMoney(totalActivos);
      totalPasivos = roundMoney(totalPasivos);
      const totalPasivoMasPatrimonio = roundMoney(totalPasivos + totalPatrimonio);

      const difference = roundMoney(totalActivos - totalPasivoMasPatrimonio);
      const isBalanced = Math.abs(difference) < 0.01;

      const buildGroup = (accounts: ReportAccountLine[]) => ({
        total: roundMoney(accounts.reduce((sum, line) => sum + line.amount, 0)),
        accounts,
      });

      return {
        asOfDate: cutoffDate.toISOString().slice(0, 10),
        activos: {
          total: totalActivos,
          disponible: buildGroup(assetBuckets.disponible),
          inventarios: buildGroup(assetBuckets.inventarios),
          otrosActivos: buildGroup(assetBuckets.otrosActivos),
        },
        pasivos: {
          total: totalPasivos,
          obligaciones: buildGroup(liabilityBuckets.obligaciones),
          impuestos: buildGroup(liabilityBuckets.impuestos),
          otrosPasivos: buildGroup(liabilityBuckets.otrosPasivos),
        },
        patrimonio: {
          total: totalPatrimonio,
          capital: {
            total: roundMoney(totalCapital),
            accounts: capitalAccounts,
          },
          resultadosAcumulados: {
            total: roundMoney(totalRetainedEarnings),
            accounts: retainedEarningsAccounts,
          },
          resultadoEjercicio,
        },
        totalPasivoMasPatrimonio,
        isBalanced,
        difference,
        inventoryValuation,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error(
        '[FinancialReportService] Error generando Balance General:',
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo generar el Balance General.',
      );
    }
  }

  /**
   * Resumen Ejecutivo Financiero Combinado
   */
  async getFinancialSummary(
    startDate?: string,
    endDate?: string,
  ): Promise<FinancialSummaryReport> {
    const [incomeStatement, balanceSheet] = await Promise.all([
      this.getIncomeStatement(startDate, endDate),
      this.getBalanceSheet(endDate),
    ]);

    return {
      period: incomeStatement.period,
      asOfDate: balanceSheet.asOfDate,
      kpis: {
        ingresosTotales: incomeStatement.ingresosOperacionales.total,
        margenBruto: incomeStatement.margenBruto,
        margenBrutoPercentage: incomeStatement.margenBrutoPercentage,
        gastosOperacionales: incomeStatement.gastosOperacionales.total,
        utilidadNeta: incomeStatement.utilidadNeta,
        margenNetoPercentage: incomeStatement.margenNetoPercentage,
        totalActivos: balanceSheet.activos.total,
        totalPasivos: balanceSheet.pasivos.total,
        totalPatrimonio: balanceSheet.patrimonio.total,
        totalInventarioValorizado:
          balanceSheet.inventoryValuation.totalWarehouseValue,
        deudaProveedores: balanceSheet.pasivos.obligaciones.total,
        isBalanceCuadrado: balanceSheet.isBalanced,
      },
      incomeStatement,
      balanceSheet,
    };
  }
}
