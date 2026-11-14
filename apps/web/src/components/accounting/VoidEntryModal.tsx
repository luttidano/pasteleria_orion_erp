import React from 'react';
import { createPortal } from 'react-dom';
import { Ban, X } from 'lucide-react';
import type { AccountingEntry } from '../../types';
import { formatMoney } from '../../utils/formatters';

interface VoidEntryModalProps {
  entry: AccountingEntry | null;
  voidReason: string;
  onVoidReasonChange: (value: string) => void;
  isVoiding: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const VoidEntryModal: React.FC<VoidEntryModalProps> = ({
  entry,
  voidReason,
  onVoidReasonChange,
  isVoiding,
  onClose,
  onSubmit,
}) => {
  if (!entry) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1C1411] w-full max-w-md rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
          <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
            <Ban className="w-4 h-4 text-rose-600" />
            Anular Asiento #{entry.entryNumber}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-xs text-stone-600 dark:text-stone-300 space-y-1">
          <p>
            <b>Concepto:</b> {entry.concept}
          </p>
          <p>
            <b>Fecha:</b> {entry.entryDate} &bull; <b>Total:</b>{' '}
            {formatMoney(entry.totalAmount)}
          </p>
          <p className="text-[11px] text-stone-500 pt-1">
            Se generará automáticamente un contra-asiento de reversión para mantener trazabilidad
            contable intacta.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
              Motivo de anulación *
            </label>
            <input
              type="text"
              required
              value={voidReason}
              onChange={(e) => onVoidReasonChange(e.target.value)}
              placeholder="Ej.: Error de digitación en monto o cuenta"
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-[#2C1F1A]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs text-stone-500 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isVoiding || !voidReason.trim()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {isVoiding ? 'Anulando...' : 'Confirmar Anulación'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

