import React from 'react';
import { Ban, Lock, Plus } from 'lucide-react';
import type { AccountingEntry, AccountingEntryOrigin } from '../../types';
import { formatMoney } from '../../utils/formatters';

interface AccountingJournalTabProps {
  entries: AccountingEntry[];
  onOpenNewEntryModal: () => void;
  onSelectVoidEntry: (entry: AccountingEntry) => void;
}

function resolveOriginBadge(origin: AccountingEntryOrigin): { label: string; cls: string } {
  switch (origin) {
    case 'pos':
      return {
        label: 'Venta POS',
        cls: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
      };
    case 'inventory':
      return {
        label: 'Inventario / Producción',
        cls: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300',
      };
    case 'closing':
      return {
        label: 'Cierre Anual',
        cls: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
      };
    case 'reversal':
      return {
        label: 'Reverso / Anulación',
        cls: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
      };
    case 'manual':
    default:
      return {
        label: 'Manual',
        cls: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300',
      };
  }
}

export const AccountingJournalTab: React.FC<AccountingJournalTabProps> = ({
  entries,
  onOpenNewEntryModal,
  onSelectVoidEntry,
}) => {
  return (
    <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
        <div>
          <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
            Libro Diario (Partida Doble)
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Registro cronológico formal de asientos contables. Cada asiento valida balance estricto
            Debe = Haber.
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenNewEntryModal}
          className="px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          Nuevo Asiento Manual
        </button>
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-12 text-stone-400 text-xs">
          No hay asientos registrados en el Libro Diario.
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map((entry) => {
            const isVoided = entry.status === 'voided';
            const canVoid =
              !isVoided && entry.origin !== 'reversal' && entry.origin !== 'closing';
            const originBadge = resolveOriginBadge(entry.origin);

            return (
              <div
                key={entry.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  isVoided
                    ? 'border-rose-200/70 dark:border-rose-900/40 bg-rose-50/20 dark:bg-rose-950/10 opacity-80'
                    : 'border-stone-200/80 dark:border-[#35251F] bg-stone-50/40 dark:bg-[#1C1411]/50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 dark:border-[#2C1F1A] pb-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-stone-500">
                      #{entry.entryNumber}
                    </span>
                    <span
                      className={`font-bold text-[#2A1B16] dark:text-[#FDF5EE] ${
                        isVoided ? 'line-through opacity-75' : ''
                      }`}
                    >
                      {entry.concept}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${originBadge.cls}`}
                    >
                      {originBadge.label}
                    </span>
                    {isVoided && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                        Anulado
                      </span>
                    )}
                    {entry.isPeriodLocked && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200/80 text-stone-600 dark:bg-[#2C1F1A] dark:text-stone-300"
                        title="Mes contable cerrado"
                      >
                        <Lock className="w-2.5 h-2.5" /> Cerrado
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-stone-500 text-[11px]">
                    <span>{entry.entryDate}</span>
                    <span>Total: {formatMoney(entry.totalAmount)}</span>
                    {canVoid && (
                      <button
                        type="button"
                        disabled={Boolean(entry.isPeriodLocked)}
                        onClick={() => onSelectVoidEntry(entry)}
                        title={
                          entry.isPeriodLocked
                            ? 'Período contable cerrado: no se puede anular este asiento.'
                            : 'Anular mediante contra-asiento'
                        }
                        className="px-2.5 py-1 rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40 font-sans font-bold text-[11px] flex items-center gap-1 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                      >
                        <Ban className="w-3 h-3" />
                        Anular
                      </button>
                    )}
                  </div>
                </div>
                {isVoided && entry.voidReason && (
                  <p className="text-[11px] text-rose-700 dark:text-rose-300 italic">
                    Motivo de anulación: {entry.voidReason}
                  </p>
                )}

                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-stone-100 dark:border-[#281C17] text-stone-400 uppercase text-[10px]">
                      <th className="py-2 px-4">Código</th>
                      <th className="py-2 px-4">Cuenta Contable</th>
                      <th className="py-2 px-4 text-right">DEBE</th>
                      <th className="py-2 px-4 text-right">HABER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-50 dark:divide-[#1C1411]">
                    {entry.items.map((it) => (
                      <tr key={it.id}>
                        <td className="py-2 px-4 font-mono text-stone-500">{it.accountCode}</td>
                        <td className="py-2 px-4 font-semibold text-stone-700 dark:text-stone-200">
                          {it.accountName}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-stone-900 dark:text-white">
                          {it.debit > 0 ? formatMoney(it.debit) : '-'}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-stone-900 dark:text-white">
                          {it.credit > 0 ? formatMoney(it.credit) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

