import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface ReportAccountLine {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatementReport {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  ingresosOperacionales: {
    total: number;
    accounts: ReportAccountLine[];
  };
  costosMateriasPrimas: {
    total: number;
    accounts: ReportAccountLine[];
  };
  margenBruto: number;
  margenBrutoPercentage: number;
  gastosOperacionales: {
    total: number;
    accounts: ReportAccountLine[];
  };
  utilidadNeta: number;
  margenNetoPercentage: number;
}

export interface BalanceSheetReport {
  asOfDate: string;
  activos: {
    total: number;
    disponible: {
      total: number;
      accounts: ReportAccountLine[];
    };
    inventarios: {
      total: number;
      accounts: ReportAccountLine[];
    };
    otrosActivos: {
      total: number;
      accounts: ReportAccountLine[];
    };
  };
  pasivos: {
    total: number;
    obligaciones: {
      total: number;
      accounts: ReportAccountLine[];
    };
    impuestos: {
      total: number;
      accounts: ReportAccountLine[];
    };
    otrosPasivos: {
      total: number;
      accounts: ReportAccountLine[];
    };
  };
  patrimonio: {
    total: number;
    capital: {
      total: number;
      accounts: ReportAccountLine[];
    };
    resultadoEjercicio: number;
  };
  totalPasivoMasPatrimonio: number;
  isBalanced: boolean;
  difference: number;
  inventoryValuation: {
    totalWarehouseValue: number;
    rawMaterialsValue: number;
    finishedProductsValue: number;
    topRawMaterials: Array<{
      id: string;
      name: string;
      stock: number;
      unit: string;
      unitCost: number;
      totalValue: number;
    }>;
    topProducts: Array<{
      id: string;
      name: string;
      stock: number;
      unit: string;
      unitCost: number;
      totalValue: number;
    }>;
  };
}

@Injectable()
export class FinancialReportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Estado de Resultados (P&L / Pérdidas y Ganancias)
   * Ingresos Operacionales - Costos de Materias Primas = Margen Bruto
   * Margen Bruto - Gastos Operacionales (Sueldos, Luz, Arriendo) = Utilidad Neta
   */
  async getIncomeStatement(startDate?: string, endDate?: string): Promise<IncomeStatementReport> {
    try {
      const dateFilter: Record<string, Date> = {};
      if (startDate) {
        dateFilter.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }

      const hasDateFilter = Boolean(startDate || endDate);

      const accounts = await this.prisma.accountingAccount.findMany({
        where: {
          isActive: true,
          accountType: { in: ['ingreso', 'costo', 'gasto'] },
        },
        include: {
          entryItems: {
            where: hasDateFilter ? { entry: { entryDate: dateFilter } } : undefined,
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
        const totalDebit = acc.entryItems.reduce((sum, it) => sum + Number(it.debit), 0);
        const totalCredit = acc.entryItems.reduce((sum, it) => sum + Number(it.credit), 0);

        if (acc.accountType === 'ingreso') {
          // Saldo acreedor normal
          const netAmount = Math.round((totalCredit - totalDebit) * 100) / 100;
          incomeAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAmount,
          });
          totalIngresos += netAmount;
        } else if (acc.accountType === 'costo') {
          // Saldo deudor normal
          const netAmount = Math.round((totalDebit - totalCredit) * 100) / 100;
          costAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAmount,
          });
          totalCostos += netAmount;
        } else if (acc.accountType === 'gasto') {
          // Saldo deudor normal
          const netAmount = Math.round((totalDebit - totalCredit) * 100) / 100;
          expenseAccounts.push({
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: netAmount,
          });
          totalGastos += netAmount;
        }
      }

      totalIngresos = Math.round(totalIngresos * 100) / 100;
      totalCostos = Math.round(totalCostos * 100) / 100;
      totalGastos = Math.round(totalGastos * 100) / 100;

      const margenBruto = Math.round((totalIngresos - totalCostos) * 100) / 100;
      const margenBrutoPercentage =
        totalIngresos > 0 ? Math.round((margenBruto / totalIngresos) * 1000) / 10 : 0;

      const utilidadNeta = Math.round((margenBruto - totalGastos) * 100) / 100;
      const margenNetoPercentage =
        totalIngresos > 0 ? Math.round((utilidadNeta / totalIngresos) * 1000) / 10 : 0;

      return {
        period: {
          startDate: startDate || null,
          endDate: endDate || null,
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
      console.error('[FinancialReportService] Error generando Estado de Resultados:', error);
      throw new InternalServerErrorException('No se pudo generar el Estado de Resultados.');
    }
  }

  /**
   * Balance General / Estado de Situación Financiera
   * Activo = Pasivo + Patrimonio
   * Incluye valorización en tiempo real del stock de materias primas y productos terminados.
   */
  async getBalanceSheet(asOfDate?: string): Promise<BalanceSheetReport> {
    try {
      const cutoffDate = asOfDate ? new Date(asOfDate) : new Date();
      cutoffDate.setHours(23, 59, 59, 999);

      const allAccounts = await this.prisma.accountingAccount.findMany({
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
      });

      // 1. Clasificación de cuentas de Activo
      const disponibleAccounts: ReportAccountLine[] = [];
      const inventariosAccounts: ReportAccountLine[] = [];
      const otrosActivosAccounts: ReportAccountLine[] = [];
      let totalActivos = 0;

      // 2. Clasificación de cuentas de Pasivo
      const obligacionesAccounts: ReportAccountLine[] = [];
      const impuestosAccounts: ReportAccountLine[] = [];
      const otrosPasivosAccounts: ReportAccountLine[] = [];
      let totalPasivos = 0;

      // 3. Clasificación de cuentas de Patrimonio
      const capitalAccounts: ReportAccountLine[] = [];
      let totalCapital = 0;

      // 4. Acumulación de cuentas de resultado para determinar Utilidad Neta del Ejercicio
      let totalIngresosHist = 0;
      let totalCostosHist = 0;
      let totalGastosHist = 0;

      for (const acc of allAccounts) {
        const totalDebit = acc.entryItems.reduce((sum, it) => sum + Number(it.debit), 0);
        const totalCredit = acc.entryItems.reduce((sum, it) => sum + Number(it.credit), 0);

        if (acc.accountType === 'activo') {
          const balance = Math.round((totalDebit - totalCredit) * 100) / 100;
          const line: ReportAccountLine = {
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: balance,
          };
          totalActivos += balance;

          if (['1101', '1102', '1103', '1104'].includes(acc.code) || /caja|banco|transbank|transferencia/i.test(acc.name)) {
            disponibleAccounts.push(line);
          } else if (['1105', '1106'].includes(acc.code) || /inventario|materia|terminado/i.test(acc.name)) {
            inventariosAccounts.push(line);
          } else {
            otrosActivosAccounts.push(line);
          }
        } else if (acc.accountType === 'pasivo') {
          const balance = Math.round((totalCredit - totalDebit) * 100) / 100;
          const line: ReportAccountLine = {
            id: acc.id,
            code: acc.code,
            name: acc.name,
            amount: balance,
          };
          totalPasivos += balance;

          if (acc.code === '2101' || /proveedor|por pagar/i.test(acc.name)) {
            obligacionesAccounts.push(line);
          } else if (acc.code === '2102' || /iva|impuesto|retenc/i.test(acc.name)) {
            impuestosAccounts.push(line);
          } else {
            otrosPasivosAccounts.push(line);
          }
        } else if (acc.accountType === 'patrimonio') {
          const balance = Math.round((totalCredit - totalDebit) * 100) / 100;
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

      // Utilidad Neta Histórica que nutre el Patrimonio (Resultado del Ejercicio)
      const resultadoEjercicio = Math.round((totalIngresosHist - totalCostosHist - totalGastosHist) * 100) / 100;
      const totalPatrimonio = Math.round((totalCapital + resultadoEjercicio) * 100) / 100;

      totalActivos = Math.round(totalActivos * 100) / 100;
      totalPasivos = Math.round(totalPasivos * 100) / 100;
      const totalPasivoMasPatrimonio = Math.round((totalPasivos + totalPatrimonio) * 100) / 100;

      const difference = Math.round((totalActivos - totalPasivoMasPatrimonio) * 100) / 100;
      const isBalanced = Math.abs(difference) < 0.01;

      // 5. Valorización física de inventario en bodega (harina/materias primas y productos listos para venta)
      const [ingredients, products] = await Promise.all([
        this.prisma.ingredient.findMany({
          select: { id: true, name: true, stock: true, unit: true, price: true },
          orderBy: { stock: 'desc' },
        }),
        this.prisma.product.findMany({
          select: { id: true, name: true, stock: true, unit: true, costPrice: true, salePrice: true },
          orderBy: { stock: 'desc' },
        }),
      ]);

      let rawMaterialsValue = 0;
      const topRawMaterials = ingredients.map((ing) => {
        const stockNum = Number(ing.stock ?? 0);
        const unitCost = Number(ing.price ?? 0);
        const totalValue = Math.round(stockNum * unitCost * 100) / 100;
        rawMaterialsValue += totalValue;
        return {
          id: ing.id,
          name: ing.name,
          stock: stockNum,
          unit: ing.unit || 'kg',
          unitCost,
          totalValue,
        };
      }).sort((a, b) => b.totalValue - a.totalValue).slice(0, 8);

      let finishedProductsValue = 0;
      const topProducts = products.map((prod) => {
        const stockNum = Number(prod.stock ?? 0);
        const unitCost = Number(prod.costPrice ?? prod.salePrice ?? 0);
        const totalValue = Math.round(stockNum * unitCost * 100) / 100;
        finishedProductsValue += totalValue;
        return {
          id: prod.id,
          name: prod.name,
          stock: stockNum,
          unit: prod.unit || 'un',
          unitCost,
          totalValue,
        };
      }).sort((a, b) => b.totalValue - a.totalValue).slice(0, 8);

      rawMaterialsValue = Math.round(rawMaterialsValue * 100) / 100;
      finishedProductsValue = Math.round(finishedProductsValue * 100) / 100;
      const totalWarehouseValue = Math.round((rawMaterialsValue + finishedProductsValue) * 100) / 100;

      return {
        asOfDate: cutoffDate.toISOString().slice(0, 10),
        activos: {
          total: totalActivos,
          disponible: {
            total: Math.round(disponibleAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100,
            accounts: disponibleAccounts,
          },
          inventarios: {
            total: Math.round(inventariosAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100,
            accounts: inventariosAccounts,
          },
          otrosActivos: {
            total: Math.round(otrosActivosAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100,
            accounts: otrosActivosAccounts,
          },
        },
        pasivos: {
          total: totalPasivos,
          obligaciones: {
            total: Math.round(obligacionesAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100,
            accounts: obligacionesAccounts,
          },
          impuestos: {
            total: Math.round(impuestosAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100,
            accounts: impuestosAccounts,
          },
          otrosPasivos: {
            total: Math.round(otrosPasivosAccounts.reduce((s, a) => s + a.amount, 0) * 100) / 100,
            accounts: otrosPasivosAccounts,
          },
        },
        patrimonio: {
          total: totalPatrimonio,
          capital: {
            total: Math.round(totalCapital * 100) / 100,
            accounts: capitalAccounts,
          },
          resultadoEjercicio,
        },
        totalPasivoMasPatrimonio,
        isBalanced,
        difference,
        inventoryValuation: {
          totalWarehouseValue,
          rawMaterialsValue,
          finishedProductsValue,
          topRawMaterials,
          topProducts,
        },
      };
    } catch (error) {
      console.error('[FinancialReportService] Error generando Balance General:', error);
      throw new InternalServerErrorException('No se pudo generar el Balance General.');
    }
  }

  /**
   * Resumen Ejecutivo Financiero Combinado
   */
  async getFinancialSummary(startDate?: string, endDate?: string) {
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
        totalInventarioValorizado: balanceSheet.inventoryValuation.totalWarehouseValue,
        deudaProveedores: balanceSheet.pasivos.obligaciones.total,
        isBalanceCuadrado: balanceSheet.isBalanced,
      },
      incomeStatement,
      balanceSheet,
    };
  }
}

