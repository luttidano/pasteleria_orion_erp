import { apiFetch } from '../lib/api';
import type {
  ReportAccountLine,
  IncomeStatementData,
  BalanceSheetData,
  FinancialSummaryData,
} from '../types';

export type {
  ReportAccountLine,
  IncomeStatementData,
  BalanceSheetData,
  FinancialSummaryData,
};

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
