import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Modal } from '../../common/Modal';

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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={submitting}
      title={`Reversar Cierre Anual ${selectedYear}`}
      icon={<RotateCcw className="w-5 h-5" />}
      iconWrapperClassName="bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-xl text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-[#261A16] cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="annual-closing-reverse-form"
            disabled={submitting || !reason.trim()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Reversando...' : 'Confirmar Reverso'}
          </button>
        </>
      }
    >
      <p className="text-xs text-stone-600 dark:text-stone-300">
        Se generará un contra-asiento contable para revertir la refundición del 31-12-{selectedYear}. Los 12 meses permanecerán cerrados hasta que decidas reabrir alguno manualmente.
      </p>

      <form id="annual-closing-reverse-form" onSubmit={onSubmit} className="space-y-4">
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
      </form>
    </Modal>
  );
};
