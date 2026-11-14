import React from 'react';
import { createPortal } from 'react-dom';
import { Lock, LockOpen, X } from 'lucide-react';
import type { AccountingPeriod } from '../../../types';

export interface MonthPeriodActionModalProps {
  modalData: {
    action: 'close' | 'reopen';
    period: AccountingPeriod;
  };
  notes: string;
  submitting: boolean;
  onNotesChange: (notes: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
}

export const MonthPeriodActionModal: React.FC<MonthPeriodActionModalProps> = ({
  modalData,
  notes,
  submitting,
  onNotesChange,
  onClose,
  onSubmit,
}) => {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1C1411] w-full max-w-md rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
          <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
            {modalData.action === 'close' ? (
              <>
                <Lock className="w-4 h-4 text-[#8C1F25]" />
                Cerrar {modalData.period.monthLabel} {modalData.period.year}
              </>
            ) : (
              <>
                <LockOpen className="w-4 h-4 text-emerald-600" />
                Reabrir {modalData.period.monthLabel} {modalData.period.year}
              </>
            )}
          </h4>
          <button
            type="button"
            onClick={onClose}
            className="text-stone-400 hover:text-stone-600 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
          {modalData.action === 'close'
            ? `Una vez cerrado ${modalData.period.monthLabel} ${modalData.period.year}, ningún usuario podrá registrar nuevos asientos ni anular asientos existentes con fecha dentro de este mes.`
            : `Al reabrir ${modalData.period.monthLabel} ${modalData.period.year}, volverá a permitirse el registro y la anulación de asientos en este mes.`}
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
              Observación / Nota contable (opcional)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => onNotesChange(e.target.value)}
              placeholder={
                modalData.action === 'close'
                  ? 'Ej.: Conciliación bancaria y F29 revisados.'
                  : 'Ej.: Ajuste solicitado por auditoría.'
              }
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
              className={`px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50 cursor-pointer ${
                modalData.action === 'close'
                  ? 'bg-[#8C1F25] hover:bg-[#73191E]'
                  : 'bg-emerald-600 hover:bg-emerald-700'
              }`}
            >
              {submitting
                ? 'Procesando...'
                : modalData.action === 'close'
                ? 'Confirmar Cierre'
                : 'Confirmar Reapertura'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

