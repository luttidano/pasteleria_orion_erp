import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  CheckCircle2,
  ShoppingCart,
  AlertTriangle,
  AlertCircle,
  Plus,
  Minus,
  Receipt,
} from 'lucide-react';
import type {
  InventoryPurchasePaymentMethod,
  ShoppingItem,
} from '../../../types';

export interface ConfirmPurchaseDetails {
  totalCost: number;
  hasInvoice: boolean;
  paymentMethod: InventoryPurchasePaymentMethod;
}

interface PurchaseItemModalProps {
  isOpen: boolean;
  item: ShoppingItem | null;
  onClose: () => void;
  onConfirmPurchase: (
    item: ShoppingItem,
    quantityBought: number,
    details: ConfirmPurchaseDetails,
  ) => Promise<void>;
}

const PAYMENT_METHOD_OPTIONS: Array<{
  value: InventoryPurchasePaymentMethod;
  label: string;
}> = [
  { value: 'efectivo', label: 'Efectivo (Caja 1101)' },
  { value: 'banco', label: 'Tarjeta / POS Mercado Pago (1102)' },
  { value: 'transferencia', label: 'Transferencia / Mercado Pago (1102)' },
  { value: 'credito_proveedor', label: 'Crédito / Por Pagar Proveedor (2101)' },
];

export const PurchaseItemModal: React.FC<PurchaseItemModalProps> = ({
  isOpen,
  item,
  onClose,
  onConfirmPurchase,
}) => {
  if (!isOpen || !item) return null;
  return (
    <PurchaseItemModalContent
      key={item.id}
      item={item}
      onClose={onClose}
      onConfirmPurchase={onConfirmPurchase}
    />
  );
};

interface PurchaseItemModalContentProps {
  item: ShoppingItem;
  onClose: () => void;
  onConfirmPurchase: (
    item: ShoppingItem,
    quantityBought: number,
    details: ConfirmPurchaseDetails,
  ) => Promise<void>;
}

const PurchaseItemModalContent: React.FC<PurchaseItemModalContentProps> = ({
  item,
  onClose,
  onConfirmPurchase,
}) => {
  const deficit = Math.max(0, item.minStock - item.stock);
  const initialQty = deficit > 0 ? deficit : 1;
  const unitCost = item.price || 0;

  const [quantityBought, setQuantityBought] = useState<number | ''>(initialQty);
  const [totalCost, setTotalCost] = useState<number | ''>(
    unitCost > 0 ? Math.round(unitCost * initialQty * 1.19) : '',
  );
  const [hasCostManualEdit, setHasCostManualEdit] = useState(false);
  const [hasInvoice, setHasInvoice] = useState(true);
  const [paymentMethod, setPaymentMethod] =
    useState<InventoryPurchasePaymentMethod>('efectivo');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recalcSuggestedCost = (
    nextQty: number | '',
    nextHasInvoice: boolean,
    manualEdited: boolean,
  ) => {
    if (manualEdited) return;
    const qty = typeof nextQty === 'number' ? nextQty : 0;
    if (qty > 0 && unitCost > 0) {
      setTotalCost(Math.round(unitCost * qty * (nextHasInvoice ? 1.19 : 1)));
    }
  };

  const currentStock = item.stock;
  const minStock = item.minStock;
  const isOutOfStock = currentStock <= 0;
  const unit = item.unit || 'un';

  const numericBought = typeof quantityBought === 'number' ? quantityBought : 0;
  const numericTotalCost = typeof totalCost === 'number' ? totalCost : 0;
  const resultingStock = Math.max(0, currentStock + numericBought);
  const willBeSufficient = resultingStock > minStock;
  const willRemainLow = resultingStock <= minStock;
  const remainingDeficit = Math.max(0, minStock - resultingStock);

  const netAmount =
    numericTotalCost > 0
      ? hasInvoice
        ? Math.round(numericTotalCost / 1.19)
        : Math.round(numericTotalCost)
      : 0;
  const vatAmount = hasInvoice
    ? Math.max(0, Math.round(numericTotalCost) - netAmount)
    : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const handleAdjustDelta = (delta: number) => {
    const current = typeof quantityBought === 'number' ? quantityBought : 0;
    const nextVal = Math.max(0.1, Number((current + delta).toFixed(2)));
    setQuantityBought(nextVal);
    recalcSuggestedCost(nextVal, hasInvoice, hasCostManualEdit);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantityBought === '' || Number(quantityBought) <= 0) {
      setError('Por favor indica cuánto compraste (debe ser mayor a 0).');
      return;
    }
    if (totalCost === '' || Number(totalCost) <= 0) {
      setError(
        'Para la contabilidad completa debes indicar el monto total pagado (> $0).',
      );
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmPurchase(item, Number(quantityBought), {
        totalCost: Number(totalCost),
        hasInvoice,
        paymentMethod,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al actualizar el inventario y contabilidad. Inténtalo nuevamente.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative bg-[#FAF5ED] dark:bg-[#16100E] rounded-[28px] max-w-lg w-full shadow-2xl border-2 border-[#DFCAA9] dark:border-[#35251F] max-h-[92vh] flex flex-col overflow-hidden animate-modal-pop my-auto">
        <div className="relative px-6 py-4 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7] dark:bg-[#1F1512] shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#2A1B16] border border-[#DFCAA9]/70 dark:border-[#422B22] flex items-center justify-center text-2xl shadow-xs shrink-0">
              {item.icon || '🌾'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-[#DFCAA9]/70 dark:border-stone-700">
                  {item.category}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                    item.kind === 'ingredient'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : item.kind === 'resale'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      : item.kind === 'packaging'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                      : 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
                  }`}
                >
                  {item.kind === 'ingredient'
                    ? '🌾 Insumo'
                    : item.kind === 'resale'
                    ? '🥤 Reventa'
                    : item.kind === 'packaging'
                    ? '📦 Empaque'
                    : '🧤 Insumo General'}
                </span>
                {isOutOfStock ? (
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                    🚨 Agotado
                  </span>
                ) : (
                  <span className="text-[11px] font-extrabold px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                    ⚠️ Queda Poco
                  </span>
                )}
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif leading-tight mt-0.5 truncate">
                {item.name}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          id="purchase-form"
          className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4"
        >
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#1C1411] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Actual
              </span>
              <span
                className={`text-base font-black font-sans block mt-0.5 ${
                  isOutOfStock
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-amber-700 dark:text-amber-400'
                }`}
              >
                {currentStock} <span className="text-[10px] font-bold uppercase">{unit}</span>
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-white dark:bg-[#1C1411] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Mínimo
              </span>
              <span className="text-base font-black font-sans block mt-0.5 text-stone-800 dark:text-stone-200">
                {minStock} <span className="text-[10px] font-bold uppercase">{unit}</span>
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-[#2C1B10] border border-amber-300 dark:border-amber-900/80 ring-1 ring-amber-400/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 block">
                Falta comprar
              </span>
              <span className="text-base font-black font-sans block mt-0.5 text-amber-900 dark:text-amber-200">
                {deficit} <span className="text-[10px] font-bold uppercase">{unit}</span>
              </span>
            </div>
          </div>

          {/* Cantidad comprada */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#211612] border-2 border-[#8C1F25]/30 dark:border-[#8C1F25]/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
                <span>¿Cuánto compraste para reponer? *</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  const suggested = deficit > 0 ? deficit : 1;
                  setQuantityBought(suggested);
                  recalcSuggestedCost(suggested, hasInvoice, hasCostManualEdit);
                }}
                className="text-[11px] font-bold text-[#8C1F25] dark:text-[#E8A598] hover:underline cursor-pointer"
              >
                Poner sugerido ({deficit} {unit})
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleAdjustDelta(-1)}
                className="w-10 h-10 rounded-xl bg-white dark:bg-[#2D1E18] hover:bg-stone-100 dark:hover:bg-[#382620] text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-[#422D24] flex items-center justify-center font-bold text-lg shadow-xs transition-colors cursor-pointer"
                title="Restar 1"
              >
                <Minus className="w-4 h-4" />
              </button>

              <div className="relative flex-1">
                <input
                  type="number"
                  min="0.01"
                  step="any"
                  value={quantityBought}
                  onChange={(e) => {
                    const nextVal = e.target.value === '' ? '' : Number(e.target.value);
                    setQuantityBought(nextVal);
                    recalcSuggestedCost(nextVal, hasInvoice, hasCostManualEdit);
                  }}
                  placeholder="Ej: 5"
                  className="w-full text-center py-2 px-3 text-xl font-black font-sans rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                  autoFocus
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold uppercase text-stone-500 dark:text-stone-400 pointer-events-none">
                  {unit}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleAdjustDelta(1)}
                className="w-10 h-10 rounded-xl bg-white dark:bg-[#2D1E18] hover:bg-stone-100 dark:hover:bg-[#382620] text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-[#422D24] flex items-center justify-center font-bold text-lg shadow-xs transition-colors cursor-pointer"
                title="Sumar 1"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Datos contables y tributarios de la compra */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-[#EADBCE] dark:border-[#35251F] space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#8C1F25] dark:text-[#D4A373]">
              <Receipt className="w-3.5 h-3.5" />
              <span>Respaldo Contable y Tributario</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  Monto total pagado (CLP) *
                </label>
                <input
                  type="number"
                  min="1"
                  step="any"
                  required
                  value={totalCost}
                  onChange={(e) => {
                    setHasCostManualEdit(true);
                    setTotalCost(e.target.value === '' ? '' : Number(e.target.value));
                  }}
                  placeholder="Ej: 15000"
                  className="w-full py-2 px-3 text-sm font-bold font-mono rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-[#FAF5ED]/50 dark:bg-[#140E0C] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-stone-600 dark:text-stone-300 mb-1">
                  Medio de pago *
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as InventoryPurchasePaymentMethod)
                  }
                  className="w-full py-2 px-2.5 text-xs font-semibold rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-[#FAF5ED]/50 dark:bg-[#140E0C] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                >
                  {PAYMENT_METHOD_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setHasInvoice(true);
                  recalcSuggestedCost(quantityBought, true, hasCostManualEdit);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  hasInvoice
                    ? 'bg-[#8C1F25] text-white border-[#8C1F25]'
                    : 'bg-stone-50 dark:bg-[#140E0C] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                }`}
              >
                Con Factura (19% IVA Crédito)
              </button>
              <button
                type="button"
                onClick={() => {
                  setHasInvoice(false);
                  recalcSuggestedCost(quantityBought, false, hasCostManualEdit);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  !hasInvoice
                    ? 'bg-[#8C1F25] text-white border-[#8C1F25]'
                    : 'bg-stone-50 dark:bg-[#140E0C] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800'
                }`}
              >
                Boleta / Exento (Sin Crédito)
              </button>
            </div>

            {numericTotalCost > 0 && (
              <div className="pt-2 border-t border-stone-100 dark:border-[#2C1D18] text-[11px] space-y-1 text-stone-600 dark:text-stone-300">
                <div className="flex justify-between">
                  <span>
                    {item.kind === 'general_supply'
                      ? 'Gasto operativo (6101):'
                      : item.kind === 'resale'
                      ? 'Inventario prod. terminados (1106):'
                      : 'Inventario materias primas / empaques (1105):'}
                  </span>
                  <span className="font-mono font-bold text-stone-900 dark:text-white">
                    {formatCurrency(netAmount)}
                  </span>
                </div>
                {hasInvoice && (
                  <div className="flex justify-between">
                    <span>IVA Crédito Fiscal (1108):</span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {formatCurrency(vatAmount)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl transition-all border text-xs leading-relaxed">
            {willBeSufficient ? (
              <div className="flex items-start gap-2 text-emerald-900 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80 p-2.5 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">¡Stock quedará suficiente!</strong>
                  <p className="mt-0.5 text-emerald-800 dark:text-emerald-300 text-[11px]">
                    Subirá a <strong>{resultingStock} {unit}</strong> (supera el mínimo de {minStock} {unit}). Saldrá automáticamente de la lista de compras.
                  </p>
                </div>
              </div>
            ) : willRemainLow ? (
              <div className="flex items-start gap-2 text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/80 p-2.5 rounded-lg">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold">Compra parcial permitida</strong>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-300 text-[11px]">
                    El nuevo stock será <strong>{resultingStock} {unit}</strong>. Faltante restante: {remainingDeficit} {unit}.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </form>

        <div className="shrink-0 px-6 py-3.5 border-t border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7]/60 dark:bg-[#1A120F] flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-[#4A3B32] dark:text-[#D5C2B4] font-semibold text-xs sm:text-sm hover:bg-[#F3E7D7] dark:hover:bg-[#251A15] transition-colors cursor-pointer"
          >
            Cancelar
          </button>

          <button
            type="submit"
            form="purchase-form"
            disabled={isSubmitting || numericBought <= 0 || numericTotalCost <= 0}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white font-bold text-sm shadow-btn transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>✓ Registrar Compra</span>
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
