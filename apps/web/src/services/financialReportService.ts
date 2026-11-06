import { apiFetch } from '../lib/api';

export interface ReportAccountLine {
  id: string;
  code: string;
  name: string;
  amount: number;
}

export interface IncomeStatementData {
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

export interface BalanceSheetData {
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
    packagingValue: number;
    finishedProductsValue: number;
    topRawMaterials: Array<{
      id: string;
      name: string;
      stock: number;
      unit: string;
      unitCost: number;
      totalValue: number;
    }>;
    topPackaging: Array<{
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

export interface FinancialSummaryData {
  period: {
    startDate: string | null;
    endDate: string | null;
  };
  asOfDate: string;
  kpis: {
    ingresosTotales: number;
    margenBruto: number;
    margenBrutoPercentage: number;
    gastosOperacionales: number;
    utilidadNeta: number;
    margenNetoPercentage: number;
    totalActivos: number;
    totalPasivos: number;
    totalPatrimonio: number;
    totalInventarioValorizado: number;
    deudaProveedores: number;
    isBalanceCuadrado: boolean;
  };
  incomeStatement: IncomeStatementData;
  balanceSheet: BalanceSheetData;
}

export const financialReportService = {
  /**
   * Obtiene el Estado de Resultados (P&L) en un rango de fechas
   */
  async getIncomeStatement(startDate?: string, endDate?: string): Promise<IncomeStatementData> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<IncomeStatementData>(`/accounting/reports/income-statement${query}`);
  },

  /**
   * Obtiene el Balance General / Estado de Situación Financiera a una fecha de corte
   */
  async getBalanceSheet(asOfDate?: string): Promise<BalanceSheetData> {
    const params = new URLSearchParams();
    if (asOfDate) params.append('asOfDate', asOfDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<BalanceSheetData>(`/accounting/reports/balance-sheet${query}`);
  },

  /**
   * Obtiene el Resumen Ejecutivo Financiero Consolidado
   */
  async getSummary(startDate?: string, endDate?: string): Promise<FinancialSummaryData> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<FinancialSummaryData>(`/accounting/reports/summary${query}`);
  },
};