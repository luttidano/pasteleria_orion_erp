import React from 'react';
import { Calendar, User } from 'lucide-react';
import { formatChileDate, formatMoney } from '../../utils/formatters';
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-sm">
          <thead>
            <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300">
              <th className="py-3 px-4">Ticket</th>
              <th className="py-3 px-4">Fecha / Hora</th>
              <th className="py-3 px-4">Atendido por</th>
              <th className="py-3 px-6">Detalle de Compra</th>
              <th className="py-3 px-4">Pago</th>
              <th className="py-3 px-4 text-right">Total</th>
              <th className="py-3 px-4 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
            {isLoading ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-stone-500 text-sm">
                  Cargando ventas registradas...
                </td>
              </tr>
            ) : tickets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-stone-500 text-sm">
                  No hay ventas registradas en la base de datos.
                </td>
              </tr>
            ) : (
              tickets.map((t) => (
                <tr
                  key={t.id}
                  className="hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors"
                >
                  <td className="py-3 px-4 font-bold text-[#8C1F25] dark:text-[#E8A598]">
                    {t.ticketNumber}
                  </td>

                  <td className="py-3 px-4 text-xs text-stone-500 font-mono whitespace-nowrap">
                    {t.date} • {t.time}
                  </td>

                  <td className="py-3 px-4 text-xs text-stone-700 dark:text-stone-300">
                    <div className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
                      <span className="font-semibold">{t.cashierName || 'Caja Mostrador'}</span>
                    </div>
                  </td>

                  <td className="py-3 px-6 text-xs text-stone-700 dark:text-stone-300">
                    {t.itemsSummary}
                  </td>

                  <td className="py-3 px-4 text-xs font-semibold text-stone-600 dark:text-stone-400">
                    {t.paymentMethod}
                  </td>

                  <td className="py-3 px-4 font-bold text-right font-sans">
                    {formatMoney(t.total)}
                  </td>

                  <td className="py-3 px-4 text-center">
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
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

