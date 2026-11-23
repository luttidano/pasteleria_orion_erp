import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Lock, Plus, Trash2, X } from 'lucide-react';
import type { AccountingAccount, PeriodCheckResult } from '../../types';
import { formatMoney } from '../../utils/formatters';

export interface EntryFormLine {
  accountId: string;
  debit: number;
  credit: number;
  desc: string;
}

interface AccountingEntryModalProps {
  isOpen: boolean;
  accounts: AccountingAccount[];
  entryDate: string;
  onEntryDateChange: (value: string) => void;
  concept: string;
  onConceptChange: (value: string) => void;
  formLines: EntryFormLine[];
  onFormLinesChange: React.Dispatch<React.SetStateAction<EntryFormLine[]>>;
  periodCheck: PeriodCheckResult | null;
  checkingPeriod: boolean;
  isSelectedPeriodClosed: boolean;
  formError: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const AccountingEntryModal: React.FC<AccountingEntryModalProps> = ({
  isOpen,
  accounts,
  entryDate,
  onEntryDateChange,
  concept,
  onConceptChange,
  formLines,
  onFormLinesChange,
  periodCheck,
  checkingPeriod,
  isSelectedPeriodClosed,
  formError,
  saving,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const sumDebit = formLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const sumCredit = formLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isSquare = Math.abs(sumDebit - sumCredit) <= 0.01 && sumDebit > 0;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1C1411] w-full max-w-3xl rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
          <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif">
            Nuevo Asiento Contable (Partida Doble)
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isSelectedPeriodClosed && periodCheck && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 text-xs border border-amber-300 dark:border-amber-800 flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <b>Período bloqueado:</b>{' '}
              {periodCheck.reason ||
                `${periodCheck.monthLabel} ${periodCheck.year} está cerrado.`}{' '}
              Cambia la fecha a un mes abierto para registrar este asiento.
            </span>
          </div>
        )}

        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
            {formError}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-bold text-stone-600 block mb-1">Fecha</label>
              <input
                type="date"
                value={entryDate}
                min={periodCheck?.accountingStartDate ?? undefined}
                onChange={(e) => onEntryDateChange(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F]"
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-stone-600 block mb-1">
                Concepto / Glosa
              </label>
              <input
                type="text"
                value={concept}
                onChange={(e) => onConceptChange(e.target.value)}
                placeholder="Ej.: Compra de sacos de harina en efectivo"
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F]"
                required
              />
            </div>
          </div>

          {/* Grilla de Líneas Debe y Haber */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-stone-700 block">Líneas del Asiento</span>
            {formLines.map((line, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <select
                  value={line.accountId}
                  onChange={(e) =>
                    onFormLinesChange((prev) =>
                      prev.map((item, i) =>
                        i === idx ? { ...item, accountId: e.target.value } : item,
                      ),
                    )
                  }
                  className="flex-1 text-xs p-2 rounded-xl border border-stone-200 dark:border-[#35251F]"
                  required
                >
                  <option value="">Selecciona cuenta...</option>
                  {accounts.map((a) => {
                    const level = a.level ?? 1;
                    const isGroup = a.isGroup;

                    // Prefijo visual de árbol con espacios no separables para evitar colapso en HTML
                    const indent =
                      level === 1
                        ? ''
                        : level === 2
                          ? '\u00A0\u00A0└── '
                          : level === 3
                            ? '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0├── '
                            : '\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0\u00A0└── ';
                    const icon = isGroup ? '📁 ' : '📄 ';

                    return (
                      <option
                        key={a.id}
                        value={a.id}
                        disabled={isGroup}
                        className={isGroup ? 'font-bold bg-stone-100 text-stone-500' : ''}
                      >
                        {indent}
                        {icon}
                        [{a.code}] {a.name} {isGroup ? '(Totalizadora)' : ''}
                      </option>
                    );
                  })}
                </select>
                <input
                  type="number"
                  placeholder="DEBE"
                  value={line.debit || ''}
                  onChange={(e) => {
                    const debitVal = parseFloat(e.target.value) || 0;
                    onFormLinesChange((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, debit: debitVal } : item)),
                    );
                  }}
                  className="w-28 text-xs p-2 rounded-xl border border-stone-200 text-right font-mono"
                />
                <input
                  type="number"
                  placeholder="HABER"
                  value={line.credit || ''}
                  onChange={(e) => {
                    const creditVal = parseFloat(e.target.value) || 0;
                    onFormLinesChange((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, credit: creditVal } : item)),
                    );
                  }}
                  className="w-28 text-xs p-2 rounded-xl border border-stone-200 text-right font-mono"
                />
                {formLines.length > 2 && (
                  <button
                    type="button"
                    onClick={() =>
                      onFormLinesChange((prev) => prev.filter((_, i) => i !== idx))
                    }
                    className="text-stone-400 hover:text-rose-500 cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                onFormLinesChange((prev) => [
                  ...prev,
                  { accountId: '', debit: 0, credit: 0, desc: '' },
                ])
              }
              className="text-xs text-[#8C1F25] font-bold flex items-center gap-1 mt-2 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar línea
            </button>
          </div>

          {/* Verificación de Cuadre */}
          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#201613] flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              {isSquare ? (
                <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                  <CheckCircle2 className="w-4 h-4" /> Asiento Cuadrado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-rose-600 font-bold">
                  <AlertTriangle className="w-4 h-4" /> Descuadre:{' '}
                  {formatMoney(Math.abs(sumDebit - sumCredit))}
                </span>
              )}
            </div>
            <div className="font-mono space-x-4">
              <span>
                Debe: <b>{formatMoney(sumDebit)}</b>
              </span>
              <span>
                Haber: <b>{formatMoney(sumCredit)}</b>
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-stone-500 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!isSquare || saving || isSelectedPeriodClosed || checkingPeriod}
              className="px-5 py-2 rounded-xl bg-[#8C1F25] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {saving ? 'Guardando...' : 'Asentar en Diario'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

