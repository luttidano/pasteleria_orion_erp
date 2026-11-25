import React from 'react';
import { FileCheck2 } from 'lucide-react';
import type { AnnualClosingPreview } from '../../../types';
import { formatMoney } from '../../../utils/formatters';
import { Modal } from '../../common/Modal';

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
  return (
    <Modal
      isOpen={Boolean(isOpen && preview)}
      onClose={onClose}
      closeDisabled={submitting}
      title={`Confirmar Cierre Anual ${selectedYear}`}
      icon={<FileCheck2 className="w-5 h-5" />}
      maxWidthClassName="max-w-lg"
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
            form="annual-closing-form"
            disabled={submitting}
            className="px-5 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? 'Ejecutando...'
              : `Confirmar Cierre Anual ${selectedYear}`}
          </button>
        </>
      }
    >
      {preview && (
        <>
          <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
            <p className="font-bold">
              Se generará el asiento de refundición al 31-12-{selectedYear}:
            </p>
            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
              <li>
                Todas las cuentas de ingresos, costos y gastos quedarán saldadas en
                $0.
              </li>
              {preview.priorEarningsTransferred &&
                Math.abs(preview.priorEarningsTransferred) >= 0.01 && (
                  <li>
                    El saldo histórico anterior (
                    <b>{formatMoney(preview.priorEarningsTransferred)}</b>) de la
                    cuenta 3.1.02.01 se traspasará a{' '}
                    <b>
                      {preview.retainedEarningsAccount?.code ?? '3.1.02.02'}{' '}
                      {preview.retainedEarningsAccount?.name ??
                        'Resultados Acumulados'}
                    </b>
                    .
                  </li>
                )}
              <li>
                El resultado neto (<b>{formatMoney(preview.resultadoEjercicio)}</b>
                ) se traspasará a{' '}
                <b>
                  {preview.equityAccount?.code} {preview.equityAccount?.name}
                </b>
                .
              </li>
              {preview.openMonthsCount > 0 && (
                <li>
                  Los <b>{preview.openMonthsCount}</b> meses aún abiertos de{' '}
                  {selectedYear} se cerrarán automáticamente.
                </li>
              )}
            </ul>
          </div>

          <form id="annual-closing-form" onSubmit={onSubmit} className="space-y-4">
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
          </form>
        </>
      )}
    </Modal>
  );
};
