import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Ban,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  Receipt,
} from 'lucide-react';
import type { SupplierInvoice } from '../../../types';
import { formatMoney } from '../../../utils/formatters';
import { DataTable, type DataTableColumn } from '../../common/DataTable';

function getDueBadge(dueDateStr: string, status: string) {
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
  const diffDays = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

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
}

interface AccountsPayableTableProps {
  invoices: SupplierInvoice[];
  isLoading: boolean;
  statusFilter: string;
  isAdmin: boolean;
  expandedInvoiceId: string | null;
  onToggleExpand: (invoiceId: string) => void;
  onOpenPayment: (invoice: SupplierInvoice) => void;
  onVoidInvoice: (invoice: SupplierInvoice) => void;
}

/**
 * Tabla expandible de facturas por pagar con historial de abonos.
 */
export const AccountsPayableTable: React.FC<AccountsPayableTableProps> = ({
  invoices,
  isLoading,
  statusFilter,
  isAdmin,
  expandedInvoiceId,
  onToggleExpand,
  onOpenPayment,
  onVoidInvoice,
}) => {
  const columns = useMemo<DataTableColumn<SupplierInvoice>[]>(
    () => [
      {
        key: 'supplier',
        header: 'Proveedor',
        headerClassName: 'py-3 px-4',
        cellClassName: 'py-3.5 px-4',
        render: (inv) => (
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
                  {inv.supplier?.contactPerson ||
                    inv.supplier?.phone ||
                    'Sin contacto'}
                </span>
              </div>
            </div>
          </div>
        ),
      },
      {
        key: 'document',
        header: 'Documento',
        headerClassName: 'py-3 px-4',
        cellClassName: 'py-3.5 px-4',
        render: (inv) => (
          <div className="space-y-0.5">
            <span className="font-mono font-bold text-stone-800 dark:text-stone-200 block">
              #{inv.invoiceNumber}
            </span>
            <span className="text-[10px] text-stone-400 block">
              {inv.hasInvoice ? 'Factura afecta (IVA)' : 'Boleta / Exento'}
            </span>
          </div>
        ),
      },
      {
        key: 'dueDate',
        header: 'Emisión / Vencimiento',
        headerClassName: 'py-3 px-4',
        cellClassName: 'py-3.5 px-4',
        render: (inv) => (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getDueBadge(inv.dueDate, inv.status)}
            </div>
            <span className="text-[10px] text-stone-400 block">
              Emisión: {inv.issueDate} • Vence: {inv.dueDate}
            </span>
          </div>
        ),
      },
      {
        key: 'total',
        header: 'Total Factura',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName:
          'py-3.5 px-4 text-right font-mono font-semibold text-stone-700 dark:text-stone-300',
        render: (inv) => formatMoney(inv.totalAmount),
      },
      {
        key: 'paid',
        header: 'Abonado',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName: 'py-3.5 px-4 text-right font-mono',
        render: (inv) => {
          const percentPaid = Math.min(
            100,
            Math.round((inv.paidAmount / inv.totalAmount) * 100),
          );
          return (
            <>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 block">
                {formatMoney(inv.paidAmount)}
              </span>
              <span className="text-[10px] text-stone-400">
                {percentPaid}% cubierto
              </span>
            </>
          );
        },
      },
      {
        key: 'remaining',
        header: 'Saldo Deudor',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName: 'py-3.5 px-4 text-right font-mono',
        render: (inv) => (
          <span
            className={`text-sm font-black block ${
              inv.remainingAmount > 0
                ? 'text-rose-700 dark:text-rose-400'
                : 'text-stone-400'
            }`}
          >
            {formatMoney(inv.remainingAmount)}
          </span>
        ),
      },
      {
        key: 'actions',
        header: 'Acciones',
        headerClassName: 'py-3 px-4 text-center',
        cellClassName: 'py-3.5 px-4',
        render: (inv) => {
          const isExpanded = expandedInvoiceId === inv.id;
          return (
            <div className="flex items-center justify-center gap-1.5">
              {isAdmin &&
                inv.status !== 'paid' &&
                inv.status !== 'voided' && (
                  <button
                    onClick={() => onOpenPayment(inv)}
                    className="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer flex items-center gap-1"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Pagar</span>
                  </button>
                )}

              {inv.payments && inv.payments.length > 0 && (
                <button
                  onClick={() => onToggleExpand(inv.id)}
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

              {isAdmin && inv.paidAmount === 0 && inv.status !== 'voided' && (
                <button
                  onClick={() => onVoidInvoice(inv)}
                  title="Anular factura"
                  className="p-1.5 rounded-lg border border-rose-200 dark:border-rose-900/40 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                >
                  <Ban className="w-4 h-4" />
                </button>
              )}
            </div>
          );
        },
      },
    ],
    [expandedInvoiceId, isAdmin, onOpenPayment, onToggleExpand, onVoidInvoice],
  );

  return (
    <div className="bg-white dark:bg-[#16100E] rounded-3xl border border-stone-200 dark:border-[#35251F] overflow-hidden shadow-xs">
      <DataTable
        columns={columns}
        data={invoices}
        keyExtractor={(inv) => inv.id}
        isLoading={isLoading}
        loadingLabel="Cargando cuentas por pagar..."
        tableClassName="w-full text-left text-xs border-collapse"
        headerRowClassName="bg-stone-50 dark:bg-[#1F1613] text-[10px] font-bold uppercase text-stone-500 dark:text-stone-400 border-b border-stone-200 dark:border-[#35251F]"
        rowClassName={() =>
          'hover:bg-stone-50/60 dark:hover:bg-[#1C1411]/50 transition-colors'
        }
        emptyState={
          <div className="py-4 text-center text-stone-400 space-y-2">
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
        }
        renderExpandedRow={(inv) => {
          if (
            expandedInvoiceId !== inv.id ||
            !inv.payments ||
            inv.payments.length === 0
          ) {
            return null;
          }
          return (
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
          );
        }}
      />
    </div>
  );
};
