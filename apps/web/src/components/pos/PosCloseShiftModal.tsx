import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, Printer, X } from 'lucide-react';
import { formatMoney } from '../../utils/formatters';

interface PosCloseShiftModalProps {
  isOpen: boolean;
  isClosing: boolean;
  savedOpeningCash: number;
  cashSalesTotal: number;
  expectedCashPreview: number;
  electronicSalesTotal: number;
  countedCashInput: string;
  onCountedCashChange: (value: string) => void;
  modalCashDiff: number;
  closeNotes: string;
  onCloseNotesChange: (value: string) => void;
  printOnClose: boolean;
  onPrintOnCloseChange: (value: boolean) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export const PosCloseShiftModal: React.FC<PosCloseShiftModalProps> = ({
  isOpen,
  isClosing,
  savedOpeningCash,
  cashSalesTotal,
  expectedCashPreview,
  electronicSalesTotal,
  countedCashInput,
  onCountedCashChange,
  modalCashDiff,
  closeNotes,
  onCloseNotesChange,
  printOnClose,
  onPrintOnCloseChange,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="w-full max-w-lg my-auto bg-white dark:bg-[#16100E] rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
          <div>
            <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Confirmar Arqueo y Cierre de Turno
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Cuenta el efectivo físico en la gaveta. Al confirmar, el turno se cerrará y los
              indicadores volverán a $0.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isClosing) onClose();
            }}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-[#261A16] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-stone-600 dark:text-stone-400">Fondo Inicial:</span>
            <span className="font-mono font-semibold">{formatMoney(savedOpeningCash)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-stone-600 dark:text-stone-400">(+) Ventas en Efectivo:</span>
            <span className="font-mono font-semibold">{formatMoney(cashSalesTotal)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-[#EADBCE] dark:border-[#35251F] text-sm font-bold text-stone-900 dark:text-white">
            <span>(=) Efectivo Esperado en Gaveta:</span>
            <span className="font-mono text-emerald-700 dark:text-emerald-400">
              {formatMoney(expectedCashPreview)}
            </span>
          </div>
          <div className="flex justify-between pt-1 text-[11px] text-stone-500">
            <span>Tarjetas POS y Transferencias (referencia):</span>
            <span className="font-mono">{formatMoney(electronicSalesTotal)}</span>
          </div>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-200">
            Efectivo Físico Contado en Gaveta ($)
          </label>
          <input
            type="number"
            min={0}
            step={100}
            value={countedCashInput}
            onChange={(e) => onCountedCashChange(e.target.value)}
            className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-base font-mono font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
          />

          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
              Math.abs(modalCashDiff) < 0.01
                ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                : modalCashDiff > 0
                  ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/40 text-sky-800 dark:text-sky-300'
                  : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300'
            }`}
          >
            {Math.abs(modalCashDiff) < 0.01 ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold">
                {Math.abs(modalCashDiff) < 0.01
                  ? 'Cuadratura exacta ($0 de diferencia)'
                  : modalCashDiff > 0
                    ? `Sobrante de caja: +${formatMoney(modalCashDiff)}`
                    : `Faltante de caja: ${formatMoney(-Math.abs(modalCashDiff))}`}
              </p>
              {Math.abs(modalCashDiff) >= 0.01 && (
                <p className="text-[11px] opacity-90 mt-0.5">
                  Al confirmar, se contabilizará automáticamente el ajuste entre 1.1.01.01 Caja
                  Efectivo y{' '}
                  {modalCashDiff > 0
                    ? '4.1.02.01 Sobrantes de Caja.'
                    : '6.1.02.01 Faltantes y Diferencias de Caja.'}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-200">
            Observaciones del cierre (opcional)
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={closeNotes}
            onChange={(e) => onCloseNotesChange(e.target.value)}
            placeholder="Ej: Retiro de efectivo a caja fuerte, cambio entregado al turno tarde..."
            className="w-full px-3 py-2 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-xs text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={printOnClose}
            onChange={(e) => onPrintOnCloseChange(e.target.checked)}
            className="rounded border-stone-300 text-[#8C1F25] focus:ring-[#8C1F25]"
          />
          <span>Imprimir / descargar comprobante de arqueo automáticamente</span>
        </label>

        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EADBCE] dark:border-[#35251F]">
          <button
            type="button"
            onClick={onClose}
            disabled={isClosing}
            className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#261A16] cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isClosing}
            className="px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-bold shadow-btn cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>{isClosing ? 'Cerrando turno...' : 'Confirmar Cierre y Reiniciar Caja'}</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

