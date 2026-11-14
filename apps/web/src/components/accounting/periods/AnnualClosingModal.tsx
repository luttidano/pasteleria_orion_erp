import React from 'react';
import { createPortal } from 'react-dom';
import { FileCheck2, X } from 'lucide-react';
import type { AnnualClosingPreview } from '../../../types';
import { formatMoney } from '../../../utils/formatters';

export interface AnnualClosingModalProps {
  isOpen: boolean;
  selectedYear: number;
  preview: AnnualClosingPreview | null;
  notes: string;
  submitting: boolean;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
}

export const AnnualClosingModal: React.FC<AnnualClosingModalProps> = ({
  isOpen,
  selectedYear,
  preview,
  notes,
  submitting,
  onNotesChange,
  onClose,
  onSubmit,
}) => {
  if (!isOpen || !preview) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1C1411] w-full max-w-lg rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
          <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#8C1F25]" />
            Confirmar Cierre Anual {selectedYear}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          <p className="font-bold">Se generará el asiento de refundición al 31-12-{selectedYear}:</p>
          <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
            <li>Todas las cuentas de ingresos, costos y gastos quedarán saldadas en $0.</li>
            <li>
              El resultado neto (<b>{formatMoney(preview.resultadoEjercicio)}</b>) se traspasará a{' '}
              <b>{preview.equityAccount?.code} {preview.equityAccount?.name}</b>.
            </li>
            {preview.openMonthsCount > 0 && (
              <li>
                Los <b>{preview.openMonthsCount}</b> meses aún abiertos de {selectedYear} se cerrarán automáticamente.
              </li>
            )}
          </ul>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
              Notas del Cierre Anual (opcional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder="Ej.: Cierre tributario y balance anual aprobado."
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
              disabled={submitting}
              className="px-5 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Ejecutando...' : `Confirmar Cierre Anual ${selectedYear}`}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

