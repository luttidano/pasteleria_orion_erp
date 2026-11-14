import React from 'react';
import { createPortal } from 'react-dom';
import { RotateCcw, X } from 'lucide-react';

export interface AnnualClosingReverseModalProps {
  isOpen: boolean;
  selectedYear: number;
  reason: string;
  submitting: boolean;
  onReasonChange: (reason: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
}

export const AnnualClosingReverseModal: React.FC<AnnualClosingReverseModalProps> = ({
  isOpen,
  selectedYear,
  reason,
  submitting,
  onReasonChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1C1411] w-full max-w-md rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
          <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-rose-600" />
            Reversar Cierre Anual {selectedYear}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-300">
          Se generará un contra-asiento contable para revertir la refundición del 31-12-{selectedYear}. Los 12 meses permanecerán cerrados hasta que decidas reabrir alguno manualmente.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
              Motivo del reverso *
            </label>
            <input
              type="text"
              required
              value={reason}
              onChange={(e) => onReasonChange(e.target.value)}
              placeholder="Ej.: Corrección de gasto omitido en diciembre"
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
              disabled={submitting || !reason.trim()}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Reversando...' : 'Confirmar Reverso'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

