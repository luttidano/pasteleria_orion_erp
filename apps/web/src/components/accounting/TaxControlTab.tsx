import React, { useState, useEffect, useCallback } from 'react';
import {
  Calculator,
  Download,
  RefreshCw,
  TrendingUp,
  ShoppingCart,
  FileCheck2,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Building2,
  FileSpreadsheet,
  Search,
} from 'lucide-react';
import type {
  PurchasesBookResponse,
  SalesBookResponse,
  ToastMessage,
  VatSummaryResponse,
} from '../../types';
import { taxService } from '../../services/taxService';
import { formatMoney } from '../../utils/formatters';

interface TaxControlTabProps {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const MONTHS = [
  { value: 1, label: 'Enero' },
  { value: 2, label: 'Febrero' },
  { value: 3, label: 'Marzo' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Mayo' },
  { value: 6, label: 'Junio' },
  { value: 7, label: 'Julio' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Septiembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' },
  { value: 12, label: 'Diciembre' },
];

export const TaxControlTab: React.FC<TaxControlTabProps> = ({ addToast }) => {
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);

  // Parámetros F29
  const [previousRemanent, setPreviousRemanent] = useState<number>(() => {
    const saved = localStorage.getItem(`tax_remanent_${currentDate.getFullYear()}_${currentDate.getMonth() + 1}`);
    return saved ? Number(saved) : 0;
  });
  const [ppmRate, setPpmRate] = useState<number>(() => {
    const saved = localStorage.getItem('tax_ppm_rate');
    return saved ? Number(saved) : 0.25;
  });

  // Estados de datos
  const [summaryData, setSummaryData] = useState<VatSummaryResponse | null>(null);
  const [salesBook, setSalesBook] = useState<SalesBookResponse | null>(null);
  const [purchasesBook, setPurchasesBook] = useState<PurchasesBookResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Filtros internos
  const [activeSubTab, setActiveSubTab] = useState<'f29' | 'ventas' | 'compras'>('f29');
  const [salesFilter, setSalesFilter] = useState('');
  const [purchasesFilter, setPurchasesFilter] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, salesRes, purchasesRes] = await Promise.all([
        taxService.getVatSummary({
          year: selectedYear,
          month: selectedMonth,
          previousRemanent,
          ppmRate,
        }),
        taxService.getSalesBook({ year: selectedYear, month: selectedMonth }),
        taxService.getPurchasesBook({ year: selectedYear, month: selectedMonth }),
      ]);

      setSummaryData(sumRes);
      setSalesBook(salesRes);
      setPurchasesBook(purchasesRes);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al cargar información tributaria.';
      addToast({ type: 'error', title: 'Error tributario', message: msg });
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedMonth, previousRemanent, ppmRate, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleRemanentChange = (val: number) => {
    const clean = Math.max(0, val);
    setPreviousRemanent(clean);
    localStorage.setItem(`tax_remanent_${selectedYear}_${selectedMonth}`, String(clean));
  };

  const handlePpmRateChange = (val: number) => {
    const clean = Math.max(0, val);
    setPpmRate(clean);
    localStorage.setItem('tax_ppm_rate', String(clean));
  };

  // Exportar CSV Libro de Ventas
  const exportSalesCsv = () => {
    if (!salesBook || salesBook.entries.length === 0) {
      addToast({ type: 'info', title: 'Exportación', message: 'No hay ventas para exportar en este período.' });
      return;
    }

    const headers = ['Fecha', 'Tipo Documento', 'N° Ticket', 'Medio de Pago', 'Monto Neto', 'IVA Débito (19%)', 'Total'];
    const rows = salesBook.entries.map((e) => [
      e.date,
      e.documentType,
      e.documentNumber,
      e.paymentMethod,
      e.netAmount,
      e.vatAmount,
      e.totalAmount,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Libro_Ventas_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', title: 'Libro de Ventas', message: 'Libro de Ventas exportado exitosamente.' });
  };

  // Exportar CSV Libro de Compras
  const exportPurchasesCsv = () => {
    if (!purchasesBook || purchasesBook.entries.length === 0) {
      addToast({ type: 'info', title: 'Exportación', message: 'No hay facturas de compras para exportar en este período.' });
      return;
    }

    const headers = ['Fecha', 'Tipo Documento', 'N° Factura', 'Proveedor', 'RUT', 'Monto Neto', 'IVA Crédito (19%)', 'Total'];
    const rows = purchasesBook.entries.map((e) => [
      e.date,
      e.documentType,
      e.documentNumber,
      `"${e.supplierName}"`,
      e.supplierRut || '',
      e.netAmount,
      e.vatAmount,
      e.totalAmount,
    ]);

    const csvContent = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Libro_Compras_${selectedYear}_${String(selectedMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    addToast({ type: 'success', title: 'Libro de Compras', message: 'Libro de Compras exportado exitosamente.' });
  };

  const f29 = summaryData?.f29;
  const isVatPayable = (f29?.netVatPayable ?? 0) > 0;

  // Filtrado de tablas
  const filteredSales = (salesBook?.entries ?? []).filter((s) => {
    if (!salesFilter.trim()) return true;
    const term = salesFilter.toLowerCase();
    return s.documentNumber.toLowerCase().includes(term) || s.paymentMethod.toLowerCase().includes(term);
  });

  const filteredPurchases = (purchasesBook?.entries ?? []).filter((p) => {
    if (!purchasesFilter.trim()) return true;
    const term = purchasesFilter.toLowerCase();
    return (
      p.documentNumber.toLowerCase().includes(term) ||
      p.supplierName.toLowerCase().includes(term) ||
      (p.supplierRut && p.supplierRut.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Barra Superior de Período y Parámetros */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-700 rounded-lg">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">Control Tributario / IVA y F29</h2>
            <p className="text-xs text-gray-500">
              Liquidación de IVA (Débito vs Crédito), cálculo de remanentes y libros oficiales SII
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Selector de Mes */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Mes:</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Año */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-600">Año:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* Remanente Mes Anterior */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-medium text-gray-500">Remanente Ant.: $</span>
            <input
              type="number"
              min="0"
              value={previousRemanent || ''}
              onChange={(e) => handleRemanentChange(Number(e.target.value) || 0)}
              placeholder="0"
              className="w-20 text-xs bg-transparent border-none p-0 focus:outline-none font-semibold text-gray-800"
            />
          </div>

          {/* Tasa PPM % */}
          <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1">
            <span className="text-[11px] font-medium text-gray-500">PPM %:</span>
            <input
              type="number"
              step="0.05"
              min="0"
              max="10"
              value={ppmRate}
              onChange={(e) => handlePpmRateChange(Number(e.target.value) || 0)}
              className="w-12 text-xs bg-transparent border-none p-0 focus:outline-none font-semibold text-gray-800"
            />
          </div>

          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-lg transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de Resumen Tributario */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* IVA Débito (Ventas) */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500">IVA Débito Fiscal (19%)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {formatMoney(f29?.sales.vatAmount ?? 0)}
              </h3>
            </div>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
            <span>Ventas Netas: {formatMoney(f29?.sales.netAmount ?? 0)}</span>
            <span className="font-semibold text-gray-700">{f29?.sales.documentCount ?? 0} tickets</span>
          </div>
        </div>

        {/* IVA Crédito (Compras) */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500">IVA Crédito Fiscal (19%)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {formatMoney(f29?.purchases.vatAmount ?? 0)}
              </h3>
            </div>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg">
              <ShoppingCart className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
            <span>Compras Netas: {formatMoney(f29?.purchases.netAmount ?? 0)}</span>
            <span className="font-semibold text-gray-700">{f29?.purchases.documentCount ?? 0} facturas</span>
          </div>
        </div>

        {/* Remanente Anterior y PPM */}
        <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-medium text-gray-500">PPM Estimado ({ppmRate}%)</p>
              <h3 className="text-2xl font-bold text-gray-900 mt-1">
                {formatMoney(f29?.ppmAmount ?? 0)}
              </h3>
            </div>
            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg">
              <FileCheck2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-50">
            <span>Remanente Anterior:</span>
            <span className="font-semibold text-gray-700">{formatMoney(previousRemanent)}</span>
          </div>
        </div>

        {/* Resultado F29: A Pagar o Remanente */}
        <div
          className={`p-5 rounded-xl border shadow-sm ${
            isVatPayable
              ? 'bg-rose-50 border-rose-200 text-rose-900'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider opacity-80">
                {isVatPayable ? 'IVA a Pagar al Fisco' : 'Remanente para Mes Sgte.'}
              </p>
              <h3 className="text-2xl font-black mt-1">
                {isVatPayable
                  ? formatMoney(f29?.netVatPayable ?? 0)
                  : formatMoney(f29?.newRemanent ?? 0)}
              </h3>
            </div>
            <div
              className={`p-2.5 rounded-lg ${
                isVatPayable ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
              }`}
            >
              {isVatPayable ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle2 className="w-5 h-5" />}
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between text-xs font-semibold pt-2 border-t border-black/10">
            <span>Total F29 (IVA + PPM):</span>
            <span className="text-sm font-black">{formatMoney(f29?.totalTaxToPay ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Alerta de Cuadratura con Libro Mayor */}
      {summaryData && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-lg border text-xs ${
            summaryData.accountingReconciliation.isReconciled
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {summaryData.accountingReconciliation.isReconciled ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
            )}
            <span>
              <strong>Auditoría Contable:</strong> {summaryData.accountingReconciliation.notes}
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Cta 2.1.02.01 Débito: {formatMoney(summaryData.accountingReconciliation.accountVatDebitBalance)}</span>
            <span>Cta 1.1.03.01 Crédito: {formatMoney(summaryData.accountingReconciliation.accountVatCreditBalance)}</span>
          </div>
        </div>
      )}

      {/* Selector de Sub-pestañas: F29 / Libro Ventas / Libro Compras */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveSubTab('f29')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'f29'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          Borrador Formulario 29 (F29)
        </button>

        <button
          onClick={() => setActiveSubTab('ventas')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'ventas'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Libro de Ventas ({salesBook?.totals.documentCount ?? 0})
        </button>

        <button
          onClick={() => setActiveSubTab('compras')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeSubTab === 'compras'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <Building2 className="w-4 h-4" />
          Libro de Compras ({purchasesBook?.totals.documentCount ?? 0})
        </button>
      </div>

      {/* CONTENIDO 1: Borrador F29 */}
      {activeSubTab === 'f29' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">
              Esquema de Liquidación Mensual — Período {f29?.period.label}
            </h3>
            <span className="text-xs text-gray-500 font-medium">Régimen General / ProPyme (SII Chile)</span>
          </div>

          <div className="p-6 divide-y divide-gray-100 space-y-4">
            {/* Sección Débito Fiscal */}
            <div className="pt-2">
              <h4 className="text-xs font-bold text-indigo-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-indigo-600"></span>
                1. Débito Fiscal (Ventas del Mes)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-gray-50 p-3.5 rounded-lg">
                <div>
                  <span className="text-gray-500 block">Base Imponible (Ventas Netas):</span>
                  <span className="text-sm font-bold text-gray-800">{formatMoney(f29?.sales.netAmount ?? 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">IVA Débito Fiscal Facturado (19%):</span>
                  <span className="text-sm font-bold text-blue-700">{formatMoney(f29?.sales.vatAmount ?? 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Total Bruto Recaudado en POS:</span>
                  <span className="text-sm font-bold text-gray-800">{formatMoney(f29?.sales.totalAmount ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Sección Crédito Fiscal */}
            <div className="pt-4">
              <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                2. Crédito Fiscal (Compras con Factura)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs bg-gray-50 p-3.5 rounded-lg">
                <div>
                  <span className="text-gray-500 block">Base Imponible (Compras Netas):</span>
                  <span className="text-sm font-bold text-gray-800">{formatMoney(f29?.purchases.netAmount ?? 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">IVA Crédito Fiscal Recuperable (19%):</span>
                  <span className="text-sm font-bold text-emerald-700">{formatMoney(f29?.purchases.vatAmount ?? 0)}</span>
                </div>
                <div>
                  <span className="text-gray-500 block">Total Facturado por Proveedores:</span>
                  <span className="text-sm font-bold text-gray-800">{formatMoney(f29?.purchases.totalAmount ?? 0)}</span>
                </div>
              </div>
            </div>

            {/* Liquidación de IVA */}
            <div className="pt-4">
              <h4 className="text-xs font-bold text-gray-800 uppercase tracking-wider mb-2">
                3. Determinación de Impuesto al Valor Agregado (IVA)
              </h4>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-600">Subtotal IVA (Débito Fiscal - Crédito Fiscal):</span>
                  <span className="font-semibold text-gray-900">{formatMoney(f29?.grossVatPayable ?? 0)}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-600">(-) Remanente de Crédito Fiscal Mes Anterior:</span>
                  <span className="font-semibold text-gray-700">- {formatMoney(previousRemanent)}</span>
                </div>
                <div className="flex justify-between py-2 text-sm font-bold bg-indigo-50/50 px-3 rounded-lg">
                  <span className="text-indigo-950">
                    {isVatPayable ? 'IVA Determinado a Pagar:' : 'Remanente de Crédito a Favor Siguiente Período:'}
                  </span>
                  <span className={isVatPayable ? 'text-rose-700' : 'text-emerald-700'}>
                    {isVatPayable ? formatMoney(f29?.netVatPayable ?? 0) : formatMoney(f29?.newRemanent ?? 0)}
                  </span>
                </div>
              </div>
            </div>

            {/* Pago Provisional Mensual (PPM) */}
            <div className="pt-4">
              <h4 className="text-xs font-bold text-purple-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                4. Pago Provisional Mensual (PPM)
              </h4>
              <div className="flex justify-between text-xs py-1">
                <span className="text-gray-600">
                  Tasa {ppmRate}% sobre Ventas Netas ({formatMoney(f29?.sales.netAmount ?? 0)}):
                </span>
                <span className="font-bold text-purple-700">{formatMoney(f29?.ppmAmount ?? 0)}</span>
              </div>
            </div>

            {/* TOTAL DETERMINADO F29 */}
            <div className="pt-4 bg-gray-900 text-white p-4 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                  Total a Pagar Formulario 29 (Línea de Caja Fisco)
                </p>
                <p className="text-xs text-gray-300 mt-0.5">
                  Vence el día 12 / 20 del mes siguiente ({selectedMonth === 12 ? 1 : selectedMonth + 1}/{selectedMonth === 12 ? selectedYear + 1 : selectedYear})
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black text-emerald-400">
                  {formatMoney(f29?.totalTaxToPay ?? 0)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO 2: Libro de Ventas */}
      {activeSubTab === 'ventas' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por ticket o medio de pago..."
                value={salesFilter}
                onChange={(e) => setSalesFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={exportSalesCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Tipo Doc</th>
                  <th className="py-2.5 px-3">N° Ticket</th>
                  <th className="py-2.5 px-3">Medio Pago</th>
                  <th className="py-2.5 px-3 text-right">Monto Neto</th>
                  <th className="py-2.5 px-3 text-right text-blue-600">IVA Débito (19%)</th>
                  <th className="py-2.5 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredSales.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-gray-600">{s.date}</td>
                    <td className="py-2.5 px-3 text-gray-700">{s.documentType}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{s.documentNumber}</td>
                    <td className="py-2.5 px-3 capitalize text-gray-600">{s.paymentMethod}</td>
                    <td className="py-2.5 px-3 text-right text-gray-700 font-mono">{formatMoney(s.netAmount)}</td>
                    <td className="py-2.5 px-3 text-right text-blue-600 font-mono font-medium">{formatMoney(s.vatAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{formatMoney(s.totalAmount)}</td>
                  </tr>
                ))}
                {filteredSales.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400">
                      No se encontraron ventas para este período o filtro.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-xs">
                <tr>
                  <td colSpan={4} className="py-3 px-3 text-gray-700">
                    TOTALES PERÍODO ({salesBook?.totals.documentCount ?? 0} docs):
                  </td>
                  <td className="py-3 px-3 text-right text-gray-900 font-mono">
                    {formatMoney(salesBook?.totals.netAmount ?? 0)}
                  </td>
                  <td className="py-3 px-3 text-right text-blue-700 font-mono">
                    {formatMoney(salesBook?.totals.vatAmount ?? 0)}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-900 font-mono">
                    {formatMoney(salesBook?.totals.totalAmount ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* CONTENIDO 3: Libro de Compras */}
      {activeSubTab === 'compras' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="relative min-w-[240px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar por N° factura, proveedor o RUT..."
                value={purchasesFilter}
                onChange={(e) => setPurchasesFilter(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <button
              onClick={exportPurchasesCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-900 hover:bg-gray-800 text-white font-medium text-xs rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Exportar CSV
            </button>
          </div>

          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600 font-semibold sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">N° Factura</th>
                  <th className="py-2.5 px-3">Proveedor</th>
                  <th className="py-2.5 px-3">RUT</th>
                  <th className="py-2.5 px-3">Origen</th>
                  <th className="py-2.5 px-3 text-right">Monto Neto</th>
                  <th className="py-2.5 px-3 text-right text-emerald-600">IVA Crédito (19%)</th>
                  <th className="py-2.5 px-3 text-right font-bold">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredPurchases.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/70 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-gray-600">{p.date}</td>
                    <td className="py-2.5 px-3 font-semibold text-gray-900">{p.documentNumber}</td>
                    <td className="py-2.5 px-3 text-gray-800 font-medium">{p.supplierName}</td>
                    <td className="py-2.5 px-3 text-gray-500 font-mono">
                      {p.supplierRut || <span className="text-gray-400 italic font-sans text-[11px]">Sin RUT</span>}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          p.source === 'supplier_invoice'
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {p.source === 'supplier_invoice' ? 'CxP Factura' : 'Insumo Directo'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right text-gray-700 font-mono">{formatMoney(p.netAmount)}</td>
                    <td className="py-2.5 px-3 text-right text-emerald-600 font-mono font-medium">{formatMoney(p.vatAmount)}</td>
                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-900">{formatMoney(p.totalAmount)}</td>
                  </tr>
                ))}
                {filteredPurchases.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-gray-400">
                      No se encontraron compras con factura para este período o filtro.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot className="bg-gray-50 font-bold border-t border-gray-200 text-xs">
                <tr>
                  <td colSpan={5} className="py-3 px-3 text-gray-700">
                    TOTALES PERÍODO ({purchasesBook?.totals.documentCount ?? 0} facturas):
                  </td>
                  <td className="py-3 px-3 text-right text-gray-900 font-mono">
                    {formatMoney(purchasesBook?.totals.netAmount ?? 0)}
                  </td>
                  <td className="py-3 px-3 text-right text-emerald-700 font-mono">
                    {formatMoney(purchasesBook?.totals.vatAmount ?? 0)}
                  </td>
                  <td className="py-3 px-3 text-right text-gray-900 font-mono">
                    {formatMoney(purchasesBook?.totals.totalAmount ?? 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
