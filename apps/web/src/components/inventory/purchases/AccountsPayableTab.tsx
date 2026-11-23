import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Search,
  Plus,
  RefreshCw,
  Building2,
  Ban,
  Receipt,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type {
  AccountsPayableSummary,
  CreateSupplierInvoicePayload,
  RecordSupplierPaymentPayload,
  Supplier,
  SupplierInvoice,
  User,
} from '../../../types';
import { purchaseService } from '../../../services/purchaseService';
import { formatMoney } from '../../../utils/formatters';
import { RecordPaymentModal } from './RecordPaymentModal';
import { CreateInvoiceModal } from './CreateInvoiceModal';

interface AccountsPayableTabProps {
  user: User;
  suppliers: Supplier[];
  onToast: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message?: string }) => void;
}

export const AccountsPayableTab: React.FC<AccountsPayableTabProps> = ({
  user,
  suppliers,
  onToast,
}) => {
  const [invoices, setInvoices] = useState<SupplierInvoice[]>([]);
  const [summary, setSummary] = useState<AccountsPayableSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);

  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [paymentModalInvoice, setPaymentModalInvoice] = useState<SupplierInvoice | null>(null);

  const isAdmin = user.role === 'admin';

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [invoicesData, summaryData] = await Promise.all([
        purchaseService.getInvoices({ status: statusFilter, search }),
        purchaseService.getSummary(),
      ]);
      setInvoices(invoicesData);
      setSummary(summaryData);
    } catch (err: any) {
      onToast({
        type: 'error',
        title: 'Error cargando cuentas por pagar',
        message: err?.message || 'No se pudieron obtener las facturas de proveedores.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, search, onToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handlers
  const handleCreateInvoice = async (payload: CreateSupplierInvoicePayload) => {
    await purchaseService.createInvoice(payload);
    onToast({
      type: 'success',
      title: 'Factura registrada',
      message: `Se guardó la factura #${payload.invoiceNumber} por pagar.`,
    });
    await loadData();
  };

  const handleRecordPayment = async (
    invoiceId: string,
    payload: RecordSupplierPaymentPayload,
  ) => {
    await purchaseService.recordPayment(invoiceId, payload);
    onToast({
      type: 'success',
      title: 'Pago registrado exitosamente',
      message: `Abono de ${formatMoney(payload.amount)} contabilizado correctamente.`,
    });
    await loadData();
  };

  const handleVoidInvoice = async (invoice: SupplierInvoice) => {
    if (!window.confirm(`¿Estás seguro de anular la factura #${invoice.invoiceNumber}?`)) {
      return;
    }

    try {
      await purchaseService.voidInvoice(invoice.id);
      onToast({
        type: 'info',
        title: 'Factura anulada',
        message: `La factura #${invoice.invoiceNumber} ha sido anulada.`,
      });
      await loadData();
    } catch (err: any) {
      onToast({
        type: 'error',
        title: 'No se pudo anular la factura',
        message: err?.message || 'Error al procesar la anulación.',
      });
    }
  };

  const getDueBadge = (dueDateStr: string, status: string) => {
    if (status === 'paid') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 rounded-xl">
          <CheckCircle2 className="w-3.5 h-3.5" /> Pagada
        </span>
      );
    }
    if (status === 'voided') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-xl">
          <Ban className="w-3.5 h-3.5" /> Anulada
        </span>
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${dueDateStr}T00:00:00`);
    const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 rounded-xl border border-rose-200 dark:border-rose-900/50">
          <AlertTriangle className="w-3.5 h-3.5" /> Vencida hace {Math.abs(diffDays)}d
        </span>
      );
    }
    if (diffDays === 0) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 rounded-xl border border-amber-200 dark:border-amber-900/50">
          <Clock className="w-3.5 h-3.5" /> Vence hoy
        </span>
      );
    }
    if (diffDays <= 7) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 rounded-xl">
          <Clock className="w-3.5 h-3.5" /> Vence en {diffDays}d
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-xl">
        Vence en {diffDays}d
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* 1. KPIs / TARJETAS DE LIQUIDEZ Y VENCIMIENTOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Deuda */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase text-stone-500">Deuda Total Proveedores</span>
            <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-stone-900 dark:text-white">
            {formatMoney(summary?.totalDebt ?? 0)}
          </span>
          <p className="text-[11px] text-stone-400 mt-1">
            {summary?.pendingInvoicesCount ?? 0} factura(s) por pagar
          </p>
        </div>

        {/* Vencidas */}
        <div className="p-4 rounded-3xl bg-rose-50/50 dark:bg-rose-950/15 border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-400">Facturas Vencidas</span>
            <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
            {formatMoney(summary?.overdueDebt ?? 0)}
          </span>
          <p className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-1">
            {summary?.overdueInvoicesCount ?? 0} vencida(s) - Prioridad pago
          </p>
        </div>

        {/* Por vencer (7 días) */}
        <div className="p-4 rounded-3xl bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/80 dark:border-amber-900/40 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400">Por Vencer (7 días)</span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-amber-800 dark:text-amber-400">
            {formatMoney(summary?.upcomingDebt ?? 0)}
          </span>
          <p className="text-[11px] text-amber-700 dark:text-amber-400/80 mt-1">
            Vencimientos de esta semana
          </p>
        </div>

        {/* Al día */}
        <div className="p-4 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-400">Al Día (&gt; 7 días)</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-400">
            {formatMoney(summary?.currentDebt ?? 0)}
          </span>
          <p className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-1">
            Crédito con plazo holgado
          </p>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS Y ACCIONES */}
      <div className="bg-white dark:bg-[#16100E] p-4 rounded-3xl border border-stone-200 dark:border-[#35251F] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Pestañas de Estado */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {[
            { id: 'pending', label: 'Pendientes / Con Saldo' },
            { id: 'all', label: 'Todas' },
            { id: 'partial', label: 'Abonadas' },
            { id: 'paid', label: 'Pagadas' },
            { id: 'voided', label: 'Anuladas' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer transition-all ${
                statusFilter === tab.id
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'bg-stone-100 hover:bg-stone-200/70 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Buscador y Botón Crear */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 md:w-64">
            <input
              type="text"
              placeholder="Buscar por N° factura o proveedor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50/50 dark:bg-[#201612]"
            />
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-2.5 pointer-events-none" />
          </div>

          <button
            onClick={() => loadData()}
            title="Refrescar facturas"
            className="p-2 rounded-xl border border-stone-200 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-[#8C1F25] hover:bg-[#73191E] text-white shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ingresar Factura</span>
          </button>
        </div>
      </div>

      {/* 3. TABLA DE FACTURAS POR PAGAR */}
      <div className="bg-white dark:bg-[#16100E] rounded-3xl border border-stone-200 dark:border-[#35251F] overflow-hidden shadow-xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-stone-400 flex flex-col items-center justify-center gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-[#8C1F25]" />
            <span>Cargando cuentas por pagar...</span>
          </div>
        ) : invoices.length === 0 ? (
          <div className="p-12 text-center text-stone-400 space-y-2">
            <Receipt className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700" />
            <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
              No hay facturas que coincidan con este filtro
            </p>
            <p className="text-xs text-stone-400">
              {statusFilter === 'pending'
                ? '¡Excelente! No tienes deudas pendientes con proveedores.'
                : 'Intenta cambiando el filtro de búsqueda o ingresa una nueva factura.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-stone-50 dark:bg-[#1F1613] text-[10px] font-bold uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-[#35251F]">
                  <th className="py-3 px-4">Proveedor</th>
                  <th className="py-3 px-4">Documento</th>
                  <th className="py-3 px-4">Emisión / Vencimiento</th>
                  <th className="py-3 px-4 text-right">Total Factura</th>
                  <th className="py-3 px-4 text-right">Abonado</th>
                  <th className="py-3 px-4 text-right">Saldo Deudor</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                {invoices.map((inv) => {
                  const isExpanded = expandedInvoiceId === inv.id;
                  const percentPaid = Math.min(
                    100,
                    Math.round((inv.paidAmount / inv.totalAmount) * 100),
                  );

                  return (
                    <React.Fragment key={inv.id}>
                      <tr className="hover:bg-stone-50/60 dark:hover:bg-[#1C1411]/50 transition-colors">
                        {/* Proveedor */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-[#FAF5ED] dark:bg-[#201612] text-[#8C1F25] flex items-center justify-center font-bold shrink-0">
                              <Building2 className="w-4 h-4" />
                            </div>
                            <div>
                              <span className="font-bold text-stone-900 dark:text-white block">
                                {inv.supplier?.name}
                              </span>
                              <div className="flex items-center gap-1.5 text-[11px] text-stone-400">
                                {inv.supplier?.rut ? (
                                  <span className="font-mono text-stone-600 dark:text-stone-300 font-medium">
                                    {inv.supplier.rut}
                                  </span>
                                ) : (
                                  <span className="italic text-stone-400">Sin RUT</span>
                                )}
                                <span>•</span>
                                <span className="truncate max-w-[140px]">
                                  {inv.supplier?.contactPerson || inv.supplier?.phone || 'Sin contacto'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Documento */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-stone-800 dark:text-stone-200 block">
                              #{inv.invoiceNumber}
                            </span>
                            <span className="text-[10px] text-stone-400 block">
                              {inv.hasInvoice ? 'Factura afecta (IVA)' : 'Boleta / Exento'}
                            </span>
                          </div>
                        </td>

                        {/* Fechas y Vencimiento */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {getDueBadge(inv.dueDate, inv.status)}
                            </div>
                            <span className="text-[10px] text-stone-400 block">
                              Emisión: {inv.issueDate} • Vence: {inv.dueDate}
                            </span>
                          </div>
                        </td>

                        {/* Total */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-stone-700 dark:text-stone-300">
                          {formatMoney(inv.totalAmount)}
                        </td>

                        {/* Abonado */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                            {formatMoney(inv.paidAmount)}
                          </span>
                          <span className="text-[10px] text-stone-400">
                            {percentPaid}% cubierto
                          </span>
                        </td>

                        {/* Saldo Deudor */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span
                            className={`text-sm font-black block ${
                              inv.remainingAmount > 0
                                ? 'text-rose-700 dark:text-rose-400'
                                : 'text-stone-400'
                            }`}
                          >
                            {formatMoney(inv.remainingAmount)}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Botón Pagar/Abonar */}
                            {isAdmin && inv.status !== 'paid' && inv.status !== 'voided' && (
                              <button
                                onClick={() => setPaymentModalInvoice(inv)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>Pagar</span>
                              </button>
                            )}

                            {/* Botón ver pagos */}
                            {inv.payments && inv.payments.length > 0 && (
                              <button
                                onClick={() =>
                                  setExpandedInvoiceId(isExpanded ? null : inv.id)
                                }
                                title="Ver historial de abonos"
                                className="p-1.5 rounded-lg border border-stone-200 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                              >
                                {isExpanded ? (
                                  <ChevronUp className="w-4 h-4" />
                                ) : (
                                  <ChevronDown className="w-4 h-4" />
                                )}
                              </button>
                            )}

                            {/* Botón Anular */}
                            {isAdmin && inv.paidAmount === 0 && inv.status !== 'voided' && (
                              <button
                                onClick={() => handleVoidInvoice(inv)}
                                title="Anular factura"
                                className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Historial desplegable de abonos */}
                      {isExpanded && inv.payments && inv.payments.length > 0 && (
                        <tr className="bg-stone-50/80 dark:bg-[#1A120F]">
                          <td colSpan={7} className="p-4">
                            <div className="rounded-2xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E] p-3.5 space-y-2">
                              <span className="text-[11px] font-bold uppercase text-stone-500 block">
                                Historial de Pagos y Abonos Registrados
                              </span>
                              <div className="divide-y divide-stone-100 dark:divide-[#281C17]">
                                {inv.payments.map((p) => (
                                  <div
                                    key={p.id}
                                    className="py-2 flex items-center justify-between text-xs"
                                  >
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span className="font-semibold text-stone-800 dark:text-stone-200">
                                        {p.paymentDate}
                                      </span>
                                      <span className="text-[11px] text-stone-400">
                                        • Método: {p.paymentMethod}
                                      </span>
                                      {p.reference && (
                                        <span className="text-[11px] text-stone-500 font-mono">
                                          ({p.reference})
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                      +{formatMoney(p.amount)}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALES */}
      <CreateInvoiceModal
        isOpen={isCreateModalOpen}
        suppliers={suppliers}
        onClose={() => setIsCreateModalOpen(false)}
        onConfirm={handleCreateInvoice}
      />

      <RecordPaymentModal
        isOpen={Boolean(paymentModalInvoice)}
        invoice={paymentModalInvoice}
        onClose={() => setPaymentModalInvoice(null)}
        onConfirm={handleRecordPayment}
      />
    </div>
  );
};
