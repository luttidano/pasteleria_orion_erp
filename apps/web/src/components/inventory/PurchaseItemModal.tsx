import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, CheckCircle2, ShoppingCart, AlertTriangle, AlertCircle, Plus, Minus } from 'lucide-react';
import type { Ingredient } from '../../types';

interface PurchaseItemModalProps {
  isOpen: boolean;
  ingredient: Ingredient | null;
  onClose: () => void;
  onConfirmPurchase: (ingredient: Ingredient, quantityBought: number) => Promise<void>;
}

export const PurchaseItemModal: React.FC<PurchaseItemModalProps> = ({
  isOpen,
  ingredient,
  onClose,
  onConfirmPurchase,
}) => {
  const [quantityBought, setQuantityBought] = useState<number | ''>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cantidad faltante sugerida para cubrir el mínimo
  const deficit = ingredient ? Math.max(0, ingredient.minStock - ingredient.stock) : 0;

  useEffect(() => {
    if (ingredient) {
      setQuantityBought(deficit > 0 ? deficit : 1);
      setError(null);
    }
  }, [ingredient, deficit]);

  if (!isOpen || !ingredient) return null;

  const currentStock = ingredient.stock;
  const minStock = ingredient.minStock;
  const isOutOfStock = currentStock <= 0;
  const unit = ingredient.unit || 'un';

  const numericBought = typeof quantityBought === 'number' ? quantityBought : 0;
  const resultingStock = Math.max(0, currentStock + numericBought);
  const willBeSufficient = resultingStock > minStock;
  const willRemainLow = resultingStock <= minStock;
  const remainingDeficit = Math.max(0, minStock - resultingStock);

  // Cálculo de costo estimado referencial
  const unitPrice = ingredient.price || 0;
  const estimatedCost = unitPrice > 0 && numericBought > 0 ? unitPrice * numericBought : 0;

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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (quantityBought === '' || Number(quantityBought) <= 0) {
      setError('Por favor indica cuánto compraste (debe ser mayor a 0).');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onConfirmPurchase(ingredient, Number(quantityBought));
      onClose();
    } catch {
      setError('Ocurrió un error al actualizar el inventario. Inténtalo nuevamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Renderizado en document.body para que cubra la pantalla completa y nunca quede atrapado dentro de una tarjeta
  return createPortal(
    <div className="fixed inset-0 z-[100] bg-black/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="relative bg-[#FAF5ED] dark:bg-[#16100E] rounded-[28px] max-w-lg w-full shadow-2xl border-2 border-[#DFCAA9] dark:border-[#35251F] max-h-[92vh] flex flex-col overflow-hidden animate-modal-pop my-auto">
        
        {/* Cabecera fija en la parte superior del modal */}
        <div className="relative px-6 py-4 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7] dark:bg-[#1F1512] shrink-0">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-white dark:bg-[#2A1B16] border border-[#DFCAA9]/70 dark:border-[#422B22] flex items-center justify-center text-2xl shadow-xs shrink-0">
              {ingredient.icon || '🌾'}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-white/80 dark:bg-stone-800 text-stone-700 dark:text-stone-300 border border-[#DFCAA9]/70 dark:border-stone-700">
                  {ingredient.category}
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
                {ingredient.name}
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

        {/* Cuerpo del formulario scrolleable con padding adecuado */}
        <form onSubmit={handleSubmit} id="purchase-form" className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/70 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* 1. Descripción de lo que se debe comprar */}
          <div className="p-3.5 rounded-2xl bg-white dark:bg-[#1E1512] border border-[#EADBCE] dark:border-[#35251F] shadow-xs">
            <h4 className="text-[11px] font-bold text-[#8C1F25] dark:text-[#D4A373] uppercase tracking-wider mb-1">
              📋 Descripción del Insumo
            </h4>
            <p className="text-xs sm:text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
              {ingredient.description || 'Materia prima indispensable para la producción y repostería artesanal de Pastelería Orión.'}
            </p>
            {ingredient.price && ingredient.price > 0 && (
              <div className="mt-2 pt-2 border-t border-stone-100 dark:border-[#2C1D18] flex items-center justify-between text-xs text-stone-500 dark:text-stone-400">
                <span>Costo unitario aprox:</span>
                <span className="font-bold text-stone-800 dark:text-stone-200 font-mono">
                  {formatCurrency(ingredient.price)} por {unit}
                </span>
              </div>
            )}
          </div>

          {/* 2. Cuánto se debe comprar y diagnóstico de stock */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {/* Stock Actual */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#1C1411] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Actual
              </span>
              <span className={`text-base font-black font-sans block mt-0.5 ${
                isOutOfStock ? 'text-rose-600 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'
              }`}>
                {currentStock} <span className="text-[10px] font-bold uppercase">{unit}</span>
              </span>
            </div>

            {/* Mínimo de Seguridad */}
            <div className="p-2.5 rounded-xl bg-white dark:bg-[#1C1411] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Mínimo
              </span>
              <span className="text-base font-black font-sans block mt-0.5 text-stone-800 dark:text-stone-200">
                {minStock} <span className="text-[10px] font-bold uppercase">{unit}</span>
              </span>
            </div>

            {/* Cuánto falta comprar */}
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-[#2C1B10] border border-amber-300 dark:border-amber-900/80 ring-1 ring-amber-400/40">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300 block">
                Falta comprar
              </span>
              <span className="text-base font-black font-sans block mt-0.5 text-amber-900 dark:text-amber-200">
                {deficit} <span className="text-[10px] font-bold uppercase">{unit}</span>
              </span>
            </div>
          </div>

          {/* 3. Input interactivo: Cuánto se compró realmente */}
          <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#211612] border-2 border-[#8C1F25]/30 dark:border-[#8C1F25]/50 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] flex items-center gap-1.5">
                <ShoppingCart className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
                <span>¿Cuánto compraste para reponer? *</span>
              </label>
              <button
                type="button"
                onClick={() => setQuantityBought(deficit > 0 ? deficit : 1)}
                className="text-[11px] font-bold text-[#8C1F25] dark:text-[#E8A598] hover:underline cursor-pointer"
              >
                Poner sugerido ({deficit} {unit})
              </button>
            </div>

            {/* Selector de cantidad con botones rápidos */}
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
                  min="0.1"
                  step="any"
                  value={quantityBought}
                  onChange={(e) => setQuantityBought(e.target.value === '' ? '' : Number(e.target.value))}
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

            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5 text-xs">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 font-medium mr-1">Rápido:</span>
              <button
                type="button"
                onClick={() => handleAdjustDelta(0.5)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#2B1D18] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-[11px] font-semibold cursor-pointer"
              >
                +0.5
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDelta(1)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#2B1D18] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-[11px] font-semibold cursor-pointer"
              >
                +1
              </button>
              <button
                type="button"
                onClick={() => handleAdjustDelta(5)}
                className="px-2 py-0.5 rounded-lg bg-white dark:bg-[#2B1D18] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-50 text-[11px] font-semibold cursor-pointer"
              >
                +5
              </button>
              {deficit > 0 && (
                <button
                  type="button"
                  onClick={() => setQuantityBought(deficit)}
                  className="px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-bold cursor-pointer"
                >
                  Exacto: {deficit} {unit}
                </button>
              )}
            </div>

            {/* Costo estimado si aplica */}
            {estimatedCost > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-stone-200/80 dark:border-stone-800 text-stone-600 dark:text-stone-400">
                <span>Inversión estimada:</span>
                <span className="font-extrabold text-stone-900 dark:text-stone-100 font-mono">
                  {formatCurrency(estimatedCost)}
                </span>
              </div>
            )}
          </div>

          {/* 4. Explicación dinámica de la actualización */}
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
                    El nuevo stock será <strong>{resultingStock} {unit}</strong>. Como el mínimo es {minStock} {unit}, se actualizará y permanecerá en la lista con el faltante restante ({remainingDeficit} {unit}).
                  </p>
                </div>
              </div>
            ) : null}
          </div>
        </form>

        {/* Footer fijo e inamovible en la parte inferior */}
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
            disabled={isSubmitting || numericBought <= 0}
            className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white font-bold text-sm shadow-btn transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isSubmitting ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>✓ Listo / Marcar Comprado</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
