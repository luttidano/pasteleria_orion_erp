import React from 'react';
import { Lock, LockOpen } from 'lucide-react';
import type { AccountingPeriod } from '../../../types';
import { Modal } from '../../common/Modal';

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
  const isClose = modalData.action === 'close';

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeDisabled={submitting}
      title={`${isClose ? 'Cerrar' : 'Reabrir'} ${modalData.period.monthLabel} ${modalData.period.year}`}
      icon={
        isClose ? (
          <Lock className="w-5 h-5" />
        ) : (
          <LockOpen className="w-5 h-5" />
        )
      }
      iconWrapperClassName={
        isClose
          ? 'bg-[#8C1F25]/10 text-[#8C1F25] dark:bg-[#8C1F25]/25 dark:text-[#E8A598]'
          : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
      }
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
            form="month-period-action-form"
            disabled={submitting}
            className={`px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50 cursor-pointer ${
              isClose
                ? 'bg-[#8C1F25] hover:bg-[#73191E]'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {submitting
              ? 'Procesando...'
              : isClose
              ? 'Confirmar Cierre'
              : 'Confirmar Reapertura'}
          </button>
        </>
      }
    >
      <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
        {isClose
          ? `Una vez cerrado ${modalData.period.monthLabel} ${modalData.period.year}, ningún usuario podrá registrar nuevos asientos ni anular asientos existentes con fecha dentro de este mes.`
          : `Al reabrir ${modalData.period.monthLabel} ${modalData.period.year}, volverá a permitirse el registro y la anulación de asientos en este mes.`}
      </p>

      <form id="month-period-action-form" onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
            Observación / Nota contable (opcional)
          </label>
          <textarea
            rows={3}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder={
              isClose
                ? 'Ej.: Conciliación bancaria y F29 revisados.'
                : 'Ej.: Ajuste solicitado por auditoría.'
            }
            className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
          />
        </div>
      </form>
    </Modal>
  );
};
