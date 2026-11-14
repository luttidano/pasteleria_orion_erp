import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, ClipboardEdit, X } from 'lucide-react';
import type {
  AdjustStockPayload,
  InventoryAdjustmentReasonType,
  InventoryPurchasePaymentMethod,
  StockMovementItemType,
} from '../../types';

export interface StockAdjustmentTarget {
  id: string;
  name: string;
  itemType: StockMovementItemType;
  currentStock: number;
  unit: string;
  unitCost?: number;
  initialDelta: number;
}

interface StockAdjustmentModalProps {
  target: StockAdjustmentTarget | null;
  onClose: () => void;
  onConfirm: (id: string, payload: AdjustStockPayload) => Promise<void>;
}

const PAYMENT_OPTIONS: Array<{
  value: InventoryPurchasePaymentMethod;
  label: string;
}> = [
  { value: 'efectivo', label: 'Efectivo (Caja 1101)' },
  { value: 'banco', label: 'Tarjeta / POS Mercado Pago (1102)' },
  { value: 'transferencia', label: 'Transferencia / Mercado Pago (1102)' },
  { value: 'credito_proveedor', label: 'Crédito Proveedor (2101)' },
];

export const StockAdjustmentModal: React.FC<StockAdjustmentModalProps> = ({
  target,
  onClose,
  onConfirm,
}) => {
  if (!target) return null;
  return (
    <StockAdjustmentModalContent
      key={`${target.id}-${target.initialDelta}`}
      target={target}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

interface StockAdjustmentModalContentProps {
  target: StockAdjustmentTarget;
  onClose: () => void;
  onConfirm: (id: string, payload: AdjustStockPayload) => Promise<void>;
}

const StockAdjustmentModalContent: React.FC<StockAdjustmentModalContentProps> = ({
  target,
  onClose,
  onConfirm,
}) => {
  const isPositive = target.initialDelta > 0;
  const initialQty = Math.abs(target.initialDelta) || 1;
  const initialUnitCost = target.unitCost ?? 0;

  const [quantity, setQuantity] = useState<number | ''>(initialQty);
  const [reasonType, setReasonType] = useState<InventoryAdjustmentReasonType>(
    isPositive
      ? 'purchase'
      : target.itemType === 'general_supply'
      ? 'internal_use'
      : 'waste',
  );
  const [reason, setReason] = useState('');
  const [totalCost, setTotalCost] = useState<number | ''>(
    isPositive && initialUnitCost > 0
      ? Math.round(initialUnitCost * initialQty * 1.19)
      : '',
  );
  const [hasCostManualEdit, setHasCostManualEdit] = useState(false);
  const [hasInvoice, setHasInvoice] = useState(true);
  const [paymentMethod, setPaymentMethod] =
    useState<InventoryPurchasePaymentMethod>('efectivo');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recalcSuggestedCost = (
    nextQty: number | '',
    nextHasInvoice: boolean,
    manualEdited: boolean,
    nextReasonType: InventoryAdjustmentReasonType,
  ) => {
    if (!isPositive || nextReasonType !== 'purchase' || manualEdited) return;
    const qty = typeof nextQty === 'number' ? nextQty : 0;
    const unitCost = target.unitCost ?? 0;
    if (qty > 0 && unitCost > 0) {
      setTotalCost(Math.round(unitCost * qty * (nextHasInvoice ? 1.19 : 1)));
    }
  };

  const numericQty = typeof quantity === 'number' ? quantity : 0;
  const signedDelta = isPositive ? numericQty : -numericQty;
  const resultingStock = Number((target.currentStock + signedDelta).toFixed(3));
  const exceedsStock = !isPositive && numericQty > target.currentStock + 1e-9;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isFinite(numericQty) || numericQty <= 0) {
      setError('La cantidad del ajuste debe ser mayor a 0.');
      return;
    }
    if (exceedsStock) {
      setError(
        `No puedes descontar ${numericQty} ${target.unit}: solo hay ${target.currentStock} ${target.unit} disponibles.`,
      );
      return;
    }
    if (
      isPositive &&
      reasonType === 'purchase' &&
      (totalCost === '' || Number(totalCost) <= 0)
    ) {
      setError('Para registrar una compra debes ingresar el monto total pagado (> $0).');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(target.id, {
        delta: signedDelta,
        reasonType,
        ...(reason.trim() ? { reason: reason.trim() } : {}),
        ...(isPositive && reasonType === 'purchase'
          ? {
              totalCost: Number(totalCost),
              hasInvoice,
              paymentMethod,
            }
          : {}),
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudo aplicar el ajuste de inventario.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative bg-[#FAF5ED] dark:bg-[#16100E] rounded-[26px] max-w-md w-full shadow-2xl border-2 border-[#DFCAA9] dark:border-[#35251F] overflow-hidden animate-modal-pop my-auto">
        <div className="px-5 py-4 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7] dark:bg-[#1F1512] flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <ClipboardEdit className="w-5 h-5 text-[#8C1F25] shrink-0" />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif truncate">
                {isPositive ? 'Ingreso / Ajuste (+)' : 'Salida / Merma (-)'}:{' '}
                {target.name}
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Stock actual: <b>{target.currentStock} {target.unit}</b>
                {numericQty > 0 && (
                  <>
                    {' '}
                    → Nuevo: <b>{Math.max(0, resultingStock)} {target.unit}</b>
                  </>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-stone-500 hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Cantidad ({target.unit}) *
              </label>
              <input
                type="number"
                min="0.001"
                step="any"
                required
                value={quantity}
                onChange={(e) => {
                  const nextQty = e.target.value === '' ? '' : Number(e.target.value);
                  setQuantity(nextQty);
                  recalcSuggestedCost(nextQty, hasInvoice, hasCostManualEdit, reasonType);
                }}
                className="w-full py-2 px-3 text-sm font-bold font-mono rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-stone-700 dark:text-stone-300 mb-1">
                Motivo Contable *
              </label>
              <select
                value={reasonType}
                onChange={(e) => {
                  const nextReason = e.target.value as InventoryAdjustmentReasonType;
                  setReasonType(nextReason);
                  recalcSuggestedCost(quantity, hasInvoice, hasCostManualEdit, nextReason);
                }}
                className="w-full py-2 px-2.5 text-xs font-semibold rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              >
                {isPositive ? (
                  <>
                    <option value="purchase">Compra / Reposición</option>
                    <option value="recount_surplus">Sobrante de Conteo</option>
                  </>
                ) : (
                  <>
                    <option value="waste">Merma / Vencimiento</option>
                    <option value="internal_use">Uso Interno / Degustación</option>
                    <option value="recount_shortage">Faltante de Conteo</option>
                  </>
                )}
              </select>
            </div>
          </div>

          {isPositive && reasonType === 'purchase' && (
            <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1512] border border-[#EADBCE] dark:border-[#35251F] space-y-2.5">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                    Total Pagado (CLP) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="any"
                    required
                    value={totalCost}
                    onChange={(e) => {
                      setHasCostManualEdit(true);
                      setTotalCost(
                        e.target.value === '' ? '' : Number(e.target.value),
                      );
                    }}
                    className="w-full py-1.5 px-2.5 text-sm font-bold font-mono rounded-lg border border-[#DFCAA9] dark:border-[#3D2C24] bg-[#FAF5ED]/50 dark:bg-[#140E0C] text-stone-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                    Medio de Pago *
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) =>
                      setPaymentMethod(
                        e.target.value as InventoryPurchasePaymentMethod,
                      )
                    }
                    className="w-full py-1.5 px-2 text-xs font-semibold rounded-lg border border-[#DFCAA9] dark:border-[#3D2C24] bg-[#FAF5ED]/50 dark:bg-[#140E0C] text-stone-900 dark:text-white"
                  >
                    {PAYMENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-stone-700 dark:text-stone-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasInvoice}
                  onChange={(e) => {
                    const nextChecked = e.target.checked;
                    setHasInvoice(nextChecked);
                    recalcSuggestedCost(quantity, nextChecked, hasCostManualEdit, reasonType);
                  }}
                  className="rounded accent-[#8C1F25]"
                />
                <span>Con Factura (desglosar 19% IVA Crédito Fiscal 1108)</span>
              </label>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
              Nota / Respaldo (opcional)
            </label>
            <input
              type="text"
              maxLength={250}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                isPositive
                  ? 'Ej: Factura #1234 proveedor / conteo semanal'
                  : 'Ej: Tortas vencidas / uso cocina'
              }
              className="w-full py-2 px-3 text-xs rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-stone-900 dark:text-white"
            />
          </div>

          <p className="text-[11px] text-stone-500 dark:text-stone-400 bg-white/70 dark:bg-[#1E1512] px-3 py-2 rounded-xl border border-[#EADBCE]/70 dark:border-[#2C1D18]">
            {target.itemType === 'general_supply' && reasonType !== 'purchase'
              ? 'Insumo general: registra trazabilidad física en Kardex (su gasto ya se contabilizó en 6101 al comprarse).'
              : reasonType === 'purchase'
              ? target.itemType === 'general_supply'
                ? 'Contabilidad: cargará 6101 Gasto Operativo (+ 1108 IVA Crédito si aplica) contra Caja/Banco/Proveedor.'
                : 'Contabilidad: cargará Inventario (+ 1108 IVA Crédito si aplica) y recalculará el costo promedio.'
              : reasonType === 'recount_surplus'
              ? 'Contabilidad: aumentará Inventario contra 4102 Sobrantes de Inventario.'
              : reasonType === 'internal_use'
              ? 'Contabilidad: rebajará Inventario cargando 6101 Gastos Operativos.'
              : 'Contabilidad: rebajará Inventario cargando 6104 Pérdidas por Merma / Ajustes.'}
          </p>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#E8D7BE] dark:border-[#2C1D18]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-xs font-semibold text-stone-700 dark:text-stone-300 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || numericQty <= 0 || exceedsStock}
              className="px-5 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {submitting ? 'Guardando...' : 'Confirmar Ajuste'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
