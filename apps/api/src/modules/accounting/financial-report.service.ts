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
import { PrismaService } from '../../database/prisma.service';
import { InventoryValuationService } from '../inventory/inventory-valuation.service';
import {
  getZonedDateString,
  parseStrictUtcBounds,
  STORE_TIMEZONE,
} from '../../common/utils/chile-time.util';
import { roundMoney, roundPercentage } from '../../common/utils/money.util';
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

      const accounts = await this.prisma.accountingAccount.findMany({
        where: {
          isActive: true,
          accountType: { in: ['ingreso', 'costo', 'gasto'] },
        },
        include: {
          entryItems: {
            where: { entry: entryFilter },
          },
        },
        orderBy: { code: 'asc' },
      });

      const incomeAccounts: ReportAccountLine[] = [];
      const costAccounts: ReportAccountLine[] = [];
      const expenseAccounts: ReportAccountLine[] = [];

      let totalIngresos = 0;
      let totalCostos = 0;
      let totalGastos = 0;

      for (const acc of accounts) {
        const totalDebit = acc.entryItems.reduce(
          (sum, it) => sum + Number(it.debit),
          0,
        );
        const totalCredit = acc.entryItems.reduce(
          (sum, it) => sum + Number(it.credit),
          0,
        );

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

      const [allAccounts, inventoryValuation] = await Promise.all([
        this.prisma.accountingAccount.findMany({
          where: { isActive: true },
          include: {
            entryItems: {
              where: {
                entry: {
                  entryDate: { lte: cutoffDate },
                },
              },
            },
          },
          orderBy: { code: 'asc' },
        }),
        this.inventoryValuationService.getValuationSummary(),
      ]);

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

      let totalActivos = 0;
      let totalPasivos = 0;
      let totalCapital = 0;
      let totalIngresosHist = 0;
      let totalCostosHist = 0;
      let totalGastosHist = 0;

      for (const acc of allAccounts) {
        const totalDebit = acc.entryItems.reduce(
          (sum, it) => sum + Number(it.debit),
          0,
        );
        const totalCredit = acc.entryItems.reduce(
          (sum, it) => sum + Number(it.credit),
          0,
        );

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
          capitalAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: balance,
          });
          totalCapital += balance;
        } else if (acc.accountType === 'ingreso') {
          totalIngresosHist += totalCredit - totalDebit;
        } else if (acc.accountType === 'costo') {
          totalCostosHist += totalDebit - totalCredit;
        } else if (acc.accountType === 'gasto') {
          totalGastosHist += totalDebit - totalCredit;
        }
      }

      const resultadoEjercicio = roundMoney(
        totalIngresosHist - totalCostosHist - totalGastosHist,
      );
      const totalPatrimonio = roundMoney(totalCapital + resultadoEjercicio);

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
