import React, { useMemo } from 'react';
import { Calendar, User } from 'lucide-react';
import { formatChileDate, formatMoney } from '../../utils/formatters';
import { DataTable, type DataTableColumn } from '../common/DataTable';
import type { SaleTicket } from './posPrint';

interface PosSalesHistoryTabProps {
  tickets: SaleTicket[];
  isLoading: boolean;
  isAdmin: boolean;
}

export const PosSalesHistoryTab: React.FC<PosSalesHistoryTabProps> = ({
  tickets,
  isLoading,
  isAdmin,
}) => {
  const columns = useMemo<DataTableColumn<SaleTicket>[]>(
    () => [
      {
        key: 'ticket',
        header: 'Ticket',
        cellClassName: 'py-3 px-4 font-bold text-[#8C1F25] dark:text-[#E8A598]',
        render: (t) => t.ticketNumber,
      },
      {
        key: 'date',
        header: 'Fecha / Hora',
        cellClassName: 'py-3 px-4 text-xs text-stone-500 font-mono whitespace-nowrap',
        render: (t) => `${t.date} • ${t.time}`,
      },
      {
        key: 'cashier',
        header: 'Atendido por',
        cellClassName: 'py-3 px-4 text-xs text-stone-700 dark:text-stone-300',
        render: (t) => (
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
            <span className="font-semibold">{t.cashierName || 'Caja Mostrador'}</span>
          </div>
        ),
      },
      {
        key: 'items',
        header: 'Detalle de Compra',
        headerClassName: 'py-3 px-6',
        cellClassName: 'py-3 px-6 text-xs text-stone-700 dark:text-stone-300',
        render: (t) => t.itemsSummary,
      },
      {
        key: 'payment',
        header: 'Pago',
        cellClassName: 'py-3 px-4 text-xs font-semibold text-stone-600 dark:text-stone-400',
        render: (t) => t.paymentMethod,
      },
      {
        key: 'total',
        header: 'Total',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName: 'py-3 px-4 font-bold text-right font-sans',
        render: (t) => formatMoney(t.total),
      },
      {
        key: 'status',
        header: 'Estado',
        headerClassName: 'py-3 px-4 text-center',
        cellClassName: 'py-3 px-4 text-center',
        render: (t) => (
          <div className="flex flex-col items-center gap-1">
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                t.status === 'completada'
                  ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                  : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
              }`}
            >
              {t.status.toUpperCase()}
            </span>
            {isAdmin && t.accountingStatus === 'pending' && (
              <span
                title="Asiento contable pendiente de sincronización"
                className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
              >
                ⏳ CONTAB. PENDIENTE
              </span>
            )}
          </div>
        ),
      },
    ],
    [isAdmin],
  );

  return (
    <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
      <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
        <div>
          <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
            Historial de Boletas & Tickets de Venta
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Últimas 20 ventas registradas en mostrador.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
          <Calendar className="w-4 h-4 text-[#8C1F25]" />
          <span>Hoy: {formatChileDate(new Date())}</span>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={tickets}
        keyExtractor={(t) => t.id}
        isLoading={isLoading}
        loadingLabel="Cargando ventas registradas..."
        emptyState="No hay ventas registradas en la base de datos."
      />
    </div>
  );
};
