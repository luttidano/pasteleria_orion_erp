import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Scale,
  Building2,
  Calendar,
  RefreshCw,
  Printer,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
} from 'lucide-react';
import type {
  BalanceSheetData,
  IncomeStatementData,
  ReportAccountLine,
  ToastMessage,
} from '../../types';
import { financialReportService } from '../../services/financialReportService';
import {
  formatMoney,
  getChileMonthRange,
  getChileQuarterRange,
  getChileYearRange,
} from '../../utils/formatters';
import { IncomeStatementSection } from './IncomeStatementSection';
import { BalanceSheetSection } from './BalanceSheetSection';

export type { ReportAccountLine, IncomeStatementData, BalanceSheetData };

interface FinancialReportsTabProps {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

function getPresetRange(type: 'month' | 'quarter' | 'year' | 'all') {
  if (type === 'all') {
    return { start: '', end: '' };
  }
  if (type === 'month') {
    return getChileMonthRange(0);
  }
  if (type === 'quarter') {
    return getChileQuarterRange();
  }
  return getChileYearRange();
}

export const FinancialReportsTab: React.FC<FinancialReportsTabProps> = ({ addToast }) => {
  const defaultRange = getPresetRange('month');
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [activeTab, setActiveTab] = useState<'pnl' | 'balance' | 'overview'>('overview');

  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const fetchReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pnlRes, bsRes] = await Promise.all([
        financialReportService.getIncomeStatement(startDate, endDate),
        financialReportService.getBalanceSheet(endDate),
      ]);

      setIncomeStatement(pnlRes);
      setBalanceSheet(bsRes);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al consultar estados financieros',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudieron calcular los reportes contables.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, addToast]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  const handleApplyPreset = (type: 'month' | 'quarter' | 'year' | 'all') => {
    const range = getPresetRange(type);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 animate-fade-in print:p-0">
      {/* 1. Header y Barra de Filtros */}
      <div className="bg-white dark:bg-[#16100E] p-5 sm:p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4 print:border-none print:shadow-none">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E8A598]">
                <FileSpreadsheet className="w-5 h-5" />
              </span>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Estados Financieros Formales
              </h3>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Estado de Resultados (P&L), Balance General y Valorización de Inventario conforme a
              principios contables y PCGA/IFRS.
            </p>
          </div>

          <div className="flex items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201612] text-xs font-semibold text-stone-700 dark:text-stone-300 hover:bg-stone-100 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Imprimir informe"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / PDF</span>
            </button>
            <button
              type="button"
              onClick={() => void fetchReports()}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Recalcular</span>
            </button>
          </div>
        </div>

        {/* Selector de Rango de Fechas */}
        <div className="pt-3 border-t border-stone-100 dark:border-[#2C1F1A] flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-stone-500 font-semibold flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-[#8C1F25]" /> Período:
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-xs font-mono text-stone-800 dark:text-stone-200"
              />
              <span className="text-stone-400">al</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-xs font-mono text-stone-800 dark:text-stone-200"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[11px]">
            <button
              type="button"
              onClick={() => handleApplyPreset('month')}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#221713] hover:bg-[#8C1F25]/10 hover:text-[#8C1F25] text-stone-600 dark:text-stone-400 font-medium transition-colors cursor-pointer"
            >
              Mes Actual
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('quarter')}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#221713] hover:bg-[#8C1F25]/10 hover:text-[#8C1F25] text-stone-600 dark:text-stone-400 font-medium transition-colors cursor-pointer"
            >
              Trimestre
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('year')}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#221713] hover:bg-[#8C1F25]/10 hover:text-[#8C1F25] text-stone-600 dark:text-stone-400 font-medium transition-colors cursor-pointer"
            >
              Año Actual
            </button>
            <button
              type="button"
              onClick={() => handleApplyPreset('all')}
              className="px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#221713] hover:bg-[#8C1F25]/10 hover:text-[#8C1F25] text-stone-600 dark:text-stone-400 font-medium transition-colors cursor-pointer"
            >
              Histórico
            </button>
          </div>
        </div>

        {/* Pestañas de Vista */}
        <div className="flex items-center gap-2 pt-2 border-t border-stone-100 dark:border-[#2C1F1A] text-xs font-semibold print:hidden">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'overview'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            Vista Consolidada
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pnl')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'pnl'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            Estado de Resultados (P&L)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('balance')}
            className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer ${
              activeTab === 'balance'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            Balance General (Situación Financiera)
          </button>
        </div>
      </div>

      {isLoading && !incomeStatement ? (
        <div className="py-20 text-center text-stone-400 space-y-2">
          <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#8C1F25]" />
          <p className="text-xs">Calculando balances y estados contables...</p>
        </div>
      ) : (
        <>
          {/* 2. Tarjetas KPI Ejecutivas */}
          {incomeStatement && balanceSheet && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Margen Bruto */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-1">
                <div className="flex items-center justify-between text-stone-400 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Margen Bruto
                  </span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-stone-900 dark:text-white">
                  {formatMoney(incomeStatement.margenBruto)}
                </div>
                <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
                  <span>Rentabilidad s/ Ventas:</span>
                  <span className="font-bold text-emerald-600 font-mono">
                    {incomeStatement.margenBrutoPercentage}%
                  </span>
                </div>
              </div>

              {/* Utilidad Neta */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-1">
                <div className="flex items-center justify-between text-stone-400 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Utilidad Neta
                  </span>
                  {incomeStatement.utilidadNeta >= 0 ? (
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-rose-600" />
                  )}
                </div>
                <div
                  className={`text-2xl font-bold font-mono ${
                    incomeStatement.utilidadNeta >= 0
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {formatMoney(incomeStatement.utilidadNeta)}
                </div>
                <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
                  <span>Margen Neto:</span>
                  <span
                    className={`font-bold font-mono ${
                      incomeStatement.utilidadNeta >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {incomeStatement.margenNetoPercentage}%
                  </span>
                </div>
              </div>

              {/* Activos Totales */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-1">
                <div className="flex items-center justify-between text-stone-400 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Activo Total
                  </span>
                  <Building2 className="w-4 h-4 text-[#8C1F25]" />
                </div>
                <div className="text-2xl font-bold font-mono text-stone-900 dark:text-white">
                  {formatMoney(balanceSheet.activos.total)}
                </div>
                <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
                  <span>Disponible en Caja/Banco:</span>
                  <span className="font-bold text-stone-700 dark:text-stone-300 font-mono">
                    {formatMoney(balanceSheet.activos.disponible.total)}
                  </span>
                </div>
              </div>

              {/* Cuadre Contable */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-1">
                <div className="flex items-center justify-between text-stone-400 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">
                    Ecuación Contable
                  </span>
                  <Scale className="w-4 h-4 text-[#8C1F25]" />
                </div>
                <div className="pt-0.5">
                  {balanceSheet.isBalanced ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-100 dark:bg-emerald-950/80 text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Balance Cuadrado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 font-bold text-xs">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Descuadre: {formatMoney(Math.abs(balanceSheet.difference))}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-100 dark:border-stone-800 font-mono">
                  Activo ({formatMoney(balanceSheet.activos.total)}) = Pasivo (
                  {formatMoney(balanceSheet.pasivos.total)}) + Patr. (
                  {formatMoney(balanceSheet.patrimonio.total)})
                </p>
              </div>
            </div>
          )}

          {(activeTab === 'overview' || activeTab === 'pnl') && incomeStatement && (
            <IncomeStatementSection incomeStatement={incomeStatement} />
          )}

          {(activeTab === 'overview' || activeTab === 'balance') && balanceSheet && (
            <BalanceSheetSection balanceSheet={balanceSheet} />
          )}
        </>
      )}
    </div>
  );
};
