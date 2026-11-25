import React from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import type { Supplier, User } from '../../../types';
import { AccountsPayableSummaryCards } from './AccountsPayableSummaryCards';
import { AccountsPayableTable } from './AccountsPayableTable';
import { CreateInvoiceModal } from './CreateInvoiceModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import { useAccountsPayable } from './hooks/useAccountsPayable';

const STATUS_TABS = [
  { id: 'pending', label: 'Pendientes / Con Saldo' },
  { id: 'all', label: 'Todas' },
  { id: 'partial', label: 'Abonadas' },
  { id: 'paid', label: 'Pagadas' },
  { id: 'voided', label: 'Anuladas' },
] as const;

interface AccountsPayableTabProps {
  user: User;
  suppliers: Supplier[];
  onToast: (toast: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }) => void;
}

export const AccountsPayableTab: React.FC<AccountsPayableTabProps> = ({
  user,
  suppliers,
  onToast,
}) => {
  const {
    invoices,
    summary,
    isLoading,
    isRefreshing,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedInvoiceId,
    setExpandedInvoiceId,
    isCreateModalOpen,
    setIsCreateModalOpen,
    paymentModalInvoice,
    setPaymentModalInvoice,
    isAdmin,
    refreshData,
    handleCreateInvoice,
    handleRecordPayment,
    handleVoidInvoice,
  } = useAccountsPayable({ user, onToast });

  return (
    <div className="space-y-6">
      <AccountsPayableSummaryCards summary={summary} />

      {/* Barra de filtros y acciones */}
      <div className="bg-white dark:bg-[#16100E] p-4 rounded-3xl border border-stone-200 dark:border-[#35251F] shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {STATUS_TABS.map((tab) => (
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
            onClick={() => void refreshData()}
            title="Refrescar facturas"
            className="p-2 rounded-xl border border-stone-200 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-500 cursor-pointer"
          >
            <RefreshCw
              className={`w-4 h-4 ${isLoading || isRefreshing ? 'animate-spin' : ''}`}
            />
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

      <AccountsPayableTable
        invoices={invoices}
        isLoading={isLoading}
        statusFilter={statusFilter}
        isAdmin={isAdmin}
        expandedInvoiceId={expandedInvoiceId}
        onToggleExpand={(id) =>
          setExpandedInvoiceId(expandedInvoiceId === id ? null : id)
        }
        onOpenPayment={setPaymentModalInvoice}
        onVoidInvoice={handleVoidInvoice}
      />

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
