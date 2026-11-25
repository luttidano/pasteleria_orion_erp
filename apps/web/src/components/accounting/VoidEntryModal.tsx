import React from 'react';
import { Ban } from 'lucide-react';
import type { AccountingEntry } from '../../types';
import { formatMoney } from '../../utils/formatters';
import { Modal } from '../common/Modal';

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
  return (
    <Modal
      isOpen={Boolean(entry)}
      onClose={onClose}
      closeDisabled={isVoiding}
      title={entry ? `Anular Asiento #${entry.entryNumber}` : 'Anular Asiento'}
      icon={<Ban className="w-5 h-5" />}
      iconWrapperClassName="bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
      maxWidthClassName="max-w-md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isVoiding}
            className="px-4 py-2 rounded-xl text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-[#261A16] cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="void-entry-form"
            disabled={isVoiding || !voidReason.trim()}
            className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {isVoiding ? 'Anulando...' : 'Confirmar Anulación'}
          </button>
        </>
      }
    >
      {entry && (
        <>
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

          <form id="void-entry-form" onSubmit={onSubmit} className="space-y-4">
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
          </form>
        </>
      )}
    </Modal>
  );
};
