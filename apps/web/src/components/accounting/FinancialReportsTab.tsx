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
  Boxes,
  ShieldCheck,
  CreditCard,
  FileSpreadsheet,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import type { ToastMessage } from '../../types';

interface FinancialReportsTabProps {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

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

const formatMoney = (val: number): string =>
  Math.round(val).toLocaleString('es-CL');

function getPresetRange(type: 'month' | 'quarter' | 'year' | 'all') {
  const now = new Date();
  if (type === 'all') {
    return { start: '', end: '' };
  }
  if (type === 'month') {
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = new Date(year, month, 1).toISOString().slice(0, 10);
    const end = new Date(year, month + 1, 0).toISOString().slice(0, 10);
    return { start, end };
  }
  if (type === 'quarter') {
    const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
    const start = new Date(now.getFullYear(), quarterMonth, 1).toISOString().slice(0, 10);
    const end = new Date(now.getFullYear(), quarterMonth + 3, 0).toISOString().slice(0, 10);
    return { start, end };
  }
  // year
  const start = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10);
  const end = new Date(now.getFullYear(), 11, 31).toISOString().slice(0, 10);
  return { start, end };
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
      const pnlParams = new URLSearchParams();
      if (startDate) pnlParams.append('startDate', startDate);
      if (endDate) pnlParams.append('endDate', endDate);
      const pnlQuery = pnlParams.toString() ? `?${pnlParams.toString()}` : '';

      const bsParams = new URLSearchParams();
      if (endDate) bsParams.append('asOfDate', endDate);
      const bsQuery = bsParams.toString() ? `?${bsParams.toString()}` : '';

      const [pnlRes, bsRes] = await Promise.all([
        apiFetch<IncomeStatementData>(`/accounting/reports/income-statement${pnlQuery}`),
        apiFetch<BalanceSheetData>(`/accounting/reports/balance-sheet${bsQuery}`),
      ]);

      setIncomeStatement(pnlRes);
      setBalanceSheet(bsRes);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al consultar estados financieros',
        message: err instanceof Error ? err.message : 'No se pudieron calcular los reportes contables.',
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
              Estado de Resultados (P&L), Balance General y Valorización de Inventario conforme a principios contables y PCGA/IFRS.
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
              onClick={fetchReports}
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

          {/* Botones Rápidos (Presets) */}
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
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Margen Bruto</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-2xl font-bold font-mono text-stone-900 dark:text-white">
                  ${formatMoney(incomeStatement.margenBruto)}
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
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Utilidad Neta</span>
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
                  ${formatMoney(incomeStatement.utilidadNeta)}
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
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Activo Total</span>
                  <Building2 className="w-4 h-4 text-[#8C1F25]" />
                </div>
                <div className="text-2xl font-bold font-mono text-stone-900 dark:text-white">
                  ${formatMoney(balanceSheet.activos.total)}
                </div>
                <div className="text-[11px] text-stone-500 flex items-center justify-between pt-1 border-t border-stone-100 dark:border-stone-800">
                  <span>Disponible en Caja/Banco:</span>
                  <span className="font-bold text-stone-700 dark:text-stone-300 font-mono">
                    ${formatMoney(balanceSheet.activos.disponible.total)}
                  </span>
                </div>
              </div>

              {/* Cuadre Contable */}
              <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-1">
                <div className="flex items-center justify-between text-stone-400 text-xs">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Ecuación Contable</span>
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
                      Descuadre: ${formatMoney(Math.abs(balanceSheet.difference))}
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-stone-500 pt-1 border-t border-stone-100 dark:border-stone-800 font-mono">
                  Activo (${formatMoney(balanceSheet.activos.total)}) = Pasivo (${formatMoney(balanceSheet.pasivos.total)}) + Patr. (${formatMoney(balanceSheet.patrimonio.total)})
                </p>
              </div>
            </div>
          )}

          {/* 3. SECCIÓN: ESTADO DE RESULTADOS (P&L) */}
          {(activeTab === 'overview' || activeTab === 'pnl') && incomeStatement && (
            <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
                <div>
                  <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                    Estado de Resultados (P&L / Pérdidas y Ganancias)
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Estructura contable formal: Ingresos − Costos = Margen Bruto − Gastos = Utilidad Neta
                  </p>
                </div>
                <div className="text-xs text-stone-500 font-mono">
                  Período: {incomeStatement.period.startDate || 'Inicio'} al {incomeStatement.period.endDate || 'Hoy'}
                </div>
              </div>

              {/* Cascada Financiera */}
              <div className="space-y-4">
                {/* 1. Ingresos Operacionales */}
                <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                  <div className="bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 flex items-center justify-center font-bold text-xs">
                        +
                      </span>
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        1. Ingresos Operacionales
                      </span>
                    </div>
                    <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400">
                      ${formatMoney(incomeStatement.ingresosOperacionales.total)}
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                    {incomeStatement.ingresosOperacionales.accounts.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-stone-400 italic">
                        No se registran movimientos de ingresos en el período.
                      </div>
                    ) : (
                      incomeStatement.ingresosOperacionales.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-stone-400 text-[11px]">{acc.code}</span>
                            <span className="font-medium text-stone-800 dark:text-stone-200">{acc.name}</span>
                          </div>
                          <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                            ${formatMoney(acc.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* 2. Costos de Materias Primas */}
                <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                  <div className="bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 flex items-center justify-center font-bold text-xs">
                        −
                      </span>
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        2. Costos de Materias Primas e Insumos
                      </span>
                    </div>
                    <span className="font-mono font-bold text-base text-amber-700 dark:text-amber-400">
                      ${formatMoney(incomeStatement.costosMateriasPrimas.total)}
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                    {incomeStatement.costosMateriasPrimas.accounts.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-stone-400 italic">
                        No se registran costos de materias primas directos en el período.
                      </div>
                    ) : (
                      incomeStatement.costosMateriasPrimas.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-stone-400 text-[11px]">{acc.code}</span>
                            <span className="font-medium text-stone-800 dark:text-stone-200">{acc.name}</span>
                          </div>
                          <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                            ${formatMoney(acc.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Subtotal: MARGEN BRUTO */}
                <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border-2 border-[#EADBCE] dark:border-[#35251F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs uppercase font-bold text-stone-500 tracking-wider">
                      (=) Margen Bruto Operacional
                    </span>
                    <p className="text-xs text-stone-500">
                      Ingresos Operacionales − Costos de Materias Primas
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-[#8C1F25] dark:text-[#E8A598]">
                      ${formatMoney(incomeStatement.margenBruto)}
                    </span>
                    <span className="block text-[11px] font-bold text-stone-500 font-mono">
                      {incomeStatement.margenBrutoPercentage}% de las ventas
                    </span>
                  </div>
                </div>

                {/* 3. Gastos Operacionales */}
                <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                  <div className="bg-rose-50/60 dark:bg-rose-950/20 px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 flex items-center justify-center font-bold text-xs">
                        −
                      </span>
                      <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                        3. Gastos Operacionales (Sueldos, Luz, Arriendo, Servicios)
                      </span>
                    </div>
                    <span className="font-mono font-bold text-base text-rose-700 dark:text-rose-400">
                      ${formatMoney(incomeStatement.gastosOperacionales.total)}
                    </span>
                  </div>

                  <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                    {incomeStatement.gastosOperacionales.accounts.length === 0 ? (
                      <div className="px-4 py-3 text-xs text-stone-400 italic">
                        No se registran gastos operativos en el período.
                      </div>
                    ) : (
                      incomeStatement.gastosOperacionales.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2.5 flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-stone-400 text-[11px]">{acc.code}</span>
                            <span className="font-medium text-stone-800 dark:text-stone-200">{acc.name}</span>
                          </div>
                          <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                            ${formatMoney(acc.amount)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Total Final: UTILIDAD NETA */}
                <div
                  className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    incomeStatement.utilidadNeta >= 0
                      ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
                      : 'bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-100'
                  }`}
                >
                  <div>
                    <span className="text-xs uppercase font-extrabold tracking-wider block">
                      (=) Utilidad Neta del Ejercicio
                    </span>
                    <p className="text-xs opacity-80 mt-0.5">
                      Margen Bruto − Gastos Operacionales (Superávit contable final)
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-3xl font-black font-mono block ${
                        incomeStatement.utilidadNeta >= 0
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-rose-700 dark:text-rose-400'
                      }`}
                    >
                      ${formatMoney(incomeStatement.utilidadNeta)}
                    </span>
                    <span className="text-xs font-bold font-mono opacity-80">
                      Margen Neto: {incomeStatement.margenNetoPercentage}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. SECCIÓN: BALANCE GENERAL (SITUACIÓN FINANCIERA) */}
          {(activeTab === 'overview' || activeTab === 'balance') && balanceSheet && (
            <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
                <div>
                  <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                    Balance General / Estado de Situación Financiera
                  </h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400">
                    Agrupación formal: Activo = Pasivo + Patrimonio (Permite saber cuánto vale la empresa y cuánto se debe)
                  </p>
                </div>
                <div className="text-xs text-stone-500 font-mono">
                  Corte al: {balanceSheet.asOfDate}
                </div>
              </div>

              {/* Grid 2 Columnas: ACTIVOS vs PASIVOS + PATRIMONIO */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LADO IZQUIERDO: ACTIVOS */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-100 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-5 h-5 text-emerald-600" />
                      <span className="font-bold text-sm text-stone-900 dark:text-white uppercase">
                        TOTAL ACTIVOS
                      </span>
                    </div>
                    <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      ${formatMoney(balanceSheet.activos.total)}
                    </span>
                  </div>

                  {/* Grupo Disponible */}
                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                    <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                      <span>Activo Disponible (Caja y Bancos)</span>
                      <span className="font-mono">${formatMoney(balanceSheet.activos.disponible.total)}</span>
                    </div>
                    <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                      {balanceSheet.activos.disponible.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                          <span className="text-stone-600 dark:text-stone-400 font-medium">
                            <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                            {acc.name}
                          </span>
                          <span className="font-mono font-semibold">${formatMoney(acc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Grupo Inventarios */}
                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                    <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                      <span>Inventarios Contables (Materias Primas y Terminado)</span>
                      <span className="font-mono">${formatMoney(balanceSheet.activos.inventarios.total)}</span>
                    </div>
                    <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                      {balanceSheet.activos.inventarios.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                          <span className="text-stone-600 dark:text-stone-400 font-medium">
                            <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                            {acc.name}
                          </span>
                          <span className="font-mono font-semibold">${formatMoney(acc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* LADO DERECHO: PASIVOS Y PATRIMONIO */}
                <div className="space-y-4">
                  {/* Pasivos */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-100 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-rose-600" />
                      <span className="font-bold text-sm text-stone-900 dark:text-white uppercase">
                        TOTAL PASIVOS (DEUDAS)
                      </span>
                    </div>
                    <span className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400">
                      ${formatMoney(balanceSheet.pasivos.total)}
                    </span>
                  </div>

                  {/* Desglose Pasivos */}
                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                    <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                      <span>Obligaciones con Proveedores e Impuestos</span>
                      <span className="font-mono">${formatMoney(balanceSheet.pasivos.total)}</span>
                    </div>
                    <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                      {balanceSheet.pasivos.obligaciones.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                          <span className="text-stone-600 dark:text-stone-400 font-medium">
                            <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                            {acc.name}
                          </span>
                          <span className="font-mono font-semibold">${formatMoney(acc.amount)}</span>
                        </div>
                      ))}
                      {balanceSheet.pasivos.impuestos.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                          <span className="text-stone-600 dark:text-stone-400 font-medium">
                            <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                            {acc.name}
                          </span>
                          <span className="font-mono font-semibold">${formatMoney(acc.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Patrimonio */}
                  <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-100 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-blue-600" />
                      <span className="font-bold text-sm text-stone-900 dark:text-white uppercase">
                        PATRIMONIO NETO
                      </span>
                    </div>
                    <span className="text-xl font-bold font-mono text-blue-700 dark:text-blue-400">
                      ${formatMoney(balanceSheet.patrimonio.total)}
                    </span>
                  </div>

                  {/* Desglose Patrimonio */}
                  <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                    <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                      <span>Composición del Patrimonio</span>
                      <span className="font-mono">${formatMoney(balanceSheet.patrimonio.total)}</span>
                    </div>
                    <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                      {balanceSheet.patrimonio.capital.accounts.map((acc) => (
                        <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                          <span className="text-stone-600 dark:text-stone-400 font-medium">
                            <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                            {acc.name}
                          </span>
                          <span className="font-mono font-semibold">${formatMoney(acc.amount)}</span>
                        </div>
                      ))}
                      <div className="px-4 py-2.5 flex items-center justify-between text-xs bg-blue-50/40 dark:bg-blue-950/20">
                        <span className="font-semibold text-blue-900 dark:text-blue-300">
                          Resultado Acumulado del Ejercicio
                        </span>
                        <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                          ${formatMoney(balanceSheet.patrimonio.resultadoEjercicio)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Total Pasivo + Patrimonio */}
                  <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border-2 border-stone-300 dark:border-stone-700 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold uppercase text-stone-600 dark:text-stone-300">
                        Total Pasivo + Patrimonio
                      </span>
                      <p className="text-[11px] text-stone-400">Pasivo ($) + Patrimonio ($)</p>
                    </div>
                    <span className="text-2xl font-black font-mono text-stone-900 dark:text-white">
                      ${formatMoney(balanceSheet.totalPasivoMasPatrimonio)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 5. SECCIÓN: VALORIZACIÓN EN TIEMPO REAL DE BODEGA E INVENTARIOS */}
          {(activeTab === 'overview' || activeTab === 'balance') && balanceSheet && (
            <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
              <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <Boxes className="w-5 h-5 text-[#8C1F25]" />
                    <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                      Valorización de Inventario Físico en Bodega & Mostrador
                    </h4>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Muestra en tiempo real cuánta harina, materias primas e insumos hay almacenados y cuánto producto terminado está listo para venta.
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-xs uppercase font-bold text-stone-400 block">Total Inventario Valorizado</span>
                  <span className="text-xl font-bold font-mono text-[#8C1F25] dark:text-[#E8A598]">
                    ${formatMoney(balanceSheet.inventoryValuation.totalWarehouseValue)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Materias Primas */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200">
                    <span className="font-bold text-xs">
                      Harina e Insumos en Bodega (Materia Prima)
                    </span>
                    <span className="font-mono font-bold text-sm">
                      ${formatMoney(balanceSheet.inventoryValuation.rawMaterialsValue)}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-50 dark:bg-[#1E1512] text-[10px] uppercase font-bold text-stone-500">
                          <th className="py-2 px-3">Insumo</th>
                          <th className="py-2 px-3 text-right">Stock</th>
                          <th className="py-2 px-3 text-right">Costo Unit.</th>
                          <th className="py-2 px-3 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                        {balanceSheet.inventoryValuation.topRawMaterials.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-stone-400">
                              Sin materias primas registradas.
                            </td>
                          </tr>
                        ) : (
                          balanceSheet.inventoryValuation.topRawMaterials.map((ing) => (
                            <tr key={ing.id} className="hover:bg-stone-50/50">
                              <td className="py-2 px-3 font-medium text-stone-800 dark:text-stone-200">
                                {ing.name}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-stone-600 dark:text-stone-400">
                                {ing.stock} {ing.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-stone-600 dark:text-stone-400">
                                ${formatMoney(ing.unitCost)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-stone-900 dark:text-stone-100">
                                ${formatMoney(ing.totalValue)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Productos Terminados */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200">
                    <span className="font-bold text-xs">
                      Productos Terminados Listos para Venta
                    </span>
                    <span className="font-mono font-bold text-sm">
                      ${formatMoney(balanceSheet.inventoryValuation.finishedProductsValue)}
                    </span>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-stone-50 dark:bg-[#1E1512] text-[10px] uppercase font-bold text-stone-500">
                          <th className="py-2 px-3">Producto</th>
                          <th className="py-2 px-3 text-right">Stock</th>
                          <th className="py-2 px-3 text-right">Costo Unit.</th>
                          <th className="py-2 px-3 text-right">Valor Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800">
                        {balanceSheet.inventoryValuation.topProducts.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-4 text-center text-stone-400">
                              Sin productos en catálogo.
                            </td>
                          </tr>
                        ) : (
                          balanceSheet.inventoryValuation.topProducts.map((prod) => (
                            <tr key={prod.id} className="hover:bg-stone-50/50">
                              <td className="py-2 px-3 font-medium text-stone-800 dark:text-stone-200">
                                {prod.name}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-stone-600 dark:text-stone-400">
                                {prod.stock} {prod.unit}
                              </td>
                              <td className="py-2 px-3 text-right font-mono text-stone-600 dark:text-stone-400">
                                ${formatMoney(prod.unitCost)}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-stone-900 dark:text-stone-100">
                                ${formatMoney(prod.totalValue)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

