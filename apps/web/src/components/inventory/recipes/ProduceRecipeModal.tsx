import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { ChefHat, X, AlertTriangle, CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';
import type { Recipe, ProductionResult } from '../../../types';
import { recipeService } from '../../../services/recipeService';

interface ProduceRecipeModalProps {
  recipe: Recipe | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (result: ProductionResult) => void;
}

export const ProduceRecipeModal: React.FC<ProduceRecipeModalProps> = ({
  recipe,
  isOpen,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !recipe) return null;

  const products = recipe.products || [];
  const [selectedProductId, setSelectedProductId] = useState<string>(
    products.length > 0 ? products[0].id : '',
  );
  const [batches, setBatches] = useState<number | string>(1);
  const [customUnits, setCustomUnits] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedProduct = useMemo(() => {
    return products.find((p) => p.id === selectedProductId) || products[0] || null;
  }, [products, selectedProductId]);

  const numericBatches = typeof batches === 'number' ? batches : parseFloat(batches) || 0;

  const defaultCalculatedUnits = (recipe.yieldServings || 1) * numericBatches;
  const finalUnitsToAdd = customUnits !== '' && Number(customUnits) > 0
    ? Number(customUnits)
    : defaultCalculatedUnits;

  // Verificar en tiempo real disponibilidad de cada insumo
  const ingredientStatus = useMemo(() => {
    return (recipe.ingredients || []).map((item) => {
      const required = item.quantity * numericBatches;
      const available = item.availableStock ?? 0;
      // Comparación aproximada (el backend hace conversión exacta de masa/volumen)
      const hasEnough = available >= required || item.availableStock === undefined;
      return {
        ...item,
        required,
        available,
        hasEnough,
      };
    });
  }, [recipe, numericBatches]);

  const hasAnyInsufficient = ingredientStatus.some((i) => !i.hasEnough && (recipe.maxBatches !== undefined && numericBatches > recipe.maxBatches));

  const handleProduce = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (numericBatches <= 0) {
      setError('Por favor indica una cantidad válida de tandas a producir (mayor a 0).');
      return;
    }

    if (!selectedProduct && products.length === 0) {
      setError('Debes tener al menos un producto comercial asignado a esta receta para producirla.');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await recipeService.produce(recipe.id, {
        quantity: numericBatches,
        productId: selectedProduct?.id,
        producedUnits: customUnits !== '' ? Number(customUnits) : undefined,
      });
      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al procesar la orden de producción.');
    } finally {
      setIsSubmitting(false);
    }
  };
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1A120F] rounded-3xl max-w-lg w-full max-h-[92vh] overflow-y-auto border border-[#EADBCE] dark:border-[#2C1D18] shadow-2xl p-5 sm:p-6 space-y-5 animate-modal-pop">
        {/* Encabezado */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E07A5F] flex items-center justify-center">
              <ChefHat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900 dark:text-stone-100 font-serif leading-tight">
                Elaborar Tanda: {recipe.name}
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Rinde {recipe.yieldServings} porciones por tanda base
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerta de disponibilidad máxima */}
        {recipe.maxBatches !== undefined && (
          <div
            className={`p-3 rounded-2xl text-xs flex items-center justify-between border ${
              recipe.maxBatches > 0
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800/50'
                : 'bg-rose-50 dark:bg-rose-950/30 text-rose-900 dark:text-rose-200 border-rose-200 dark:border-rose-800/50'
            }`}
          >
            <span className="flex items-center gap-1.5 font-medium">
              {recipe.maxBatches > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600" />
              )}
              {recipe.maxBatches > 0
                ? `Insumos disponibles en despensa:`
                : 'Stock insuficiente para elaborar una tanda'}
            </span>
            <span className="font-extrabold px-2 py-0.5 rounded-lg bg-white/70 dark:bg-black/30 font-mono">
              Máx. {recipe.maxBatches} {recipe.maxBatches === 1 ? 'tanda' : 'tandas'}
            </span>
          </div>
        )}

        {/* Error form */}
        {error && (
          <div className="p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleProduce} className="space-y-4">
          {/* Selector de Producto Asignado */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Producto comercial a incrementar <span className="text-[#8C1F25]">*</span>
            </label>
            {products.length === 0 ? (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 text-xs">
                ⚠️ Esta receta no tiene ningún producto comercial de elaboración propia vinculado. Ve a la sección <strong>Catálogo de productos</strong> y asóciala a un producto antes de producir.
              </div>
            ) : products.length === 1 ? (
              <div className="p-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#35251F] bg-[#FAF5ED]/50 dark:bg-[#201612]/50 text-xs flex items-center justify-between">
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  🧁 {selectedProduct?.name}
                </span>
                <span className="text-stone-500 font-mono text-[11px]">
                  Stock actual: {selectedProduct?.stock} {selectedProduct?.unit}
                </span>
              </div>
            ) : (
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#201612] text-xs font-medium"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    🧁 {p.name} (Stock actual: {p.stock} {p.unit})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Cantidad de Tandas */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300">
                Cantidad de tandas a elaborar <span className="text-[#8C1F25]">*</span>
              </label>
              {recipe.maxBatches !== undefined && recipe.maxBatches > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setBatches(recipe.maxBatches || 1);
                    setCustomUnits('');
                  }}
                  className="text-[11px] font-bold text-[#8C1F25] dark:text-[#E07A5F] hover:underline cursor-pointer"
                >
                  Usar máximo ({recipe.maxBatches})
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setBatches((b) => Math.max(1, (Number(b) || 1) - 1));
                  setCustomUnits('');
                }}
                className="w-10 h-10 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201612] font-bold text-base hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                -
              </button>
              <input
                type="number"
                min="0.01"
                step="any"
                value={batches}
                onChange={(e) => {
                  setBatches(e.target.value);
                  setCustomUnits('');
                }}
                onBlur={() => {
                  if (batches === '' || Number(batches) <= 0) {
                    setBatches(1);
                  }
                }}
                className="flex-1 py-2 text-center text-lg font-black font-mono rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#201612] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
              <button
                type="button"
                onClick={() => {
                  setBatches((b) => (Number(b) || 0) + 1);
                  setCustomUnits('');
                }}
                className="w-10 h-10 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201612] font-bold text-base hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
              >
                +
              </button>
            </div>
          </div>

          {/* Resumen del incremento en stock comercial */}
          {selectedProduct && (
            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs space-y-1">
              <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Incremento de stock estimado:
                </span>
                <span className="font-black text-sm font-mono text-[#8C1F25] dark:text-[#E07A5F]">
                  +{finalUnitsToAdd} {selectedProduct.unit}
                </span>
              </div>
              <div className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1">
                <span>Stock actual: {selectedProduct.stock}</span>
                <ArrowRight className="w-3 h-3 text-stone-400" />
                <span className="font-bold text-stone-700 dark:text-stone-200">
                  Nuevo stock: {selectedProduct.stock + finalUnitsToAdd} {selectedProduct.unit}
                </span>
              </div>
            </div>
          )}

          {/* Desglose de Insumos que se descontarán */}
          <div className="space-y-1.5 pt-1">
            <span className="text-xs font-bold text-stone-700 dark:text-stone-300 block">
              Insumos a descontar de bodega ({numericBatches} {numericBatches === 1 ? 'tanda' : 'tandas'}):
            </span>
            <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
              {ingredientStatus.map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-xl bg-stone-50 dark:bg-[#201612] border border-stone-100 dark:border-stone-800"
                >
                  <span className="font-medium text-stone-800 dark:text-stone-200">
                    {item.ingredientName}
                  </span>
                  <div className="text-right">
                    <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
                      -{item.required.toFixed(item.required % 1 === 0 ? 0 : 2)} {item.unit}
                    </span>
                    {item.availableStock !== undefined && (
                      <span className="text-[10px] text-stone-400 block">
                        Disponibles: {item.availableStock}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || products.length === 0 || (hasAnyInsufficient && numericBatches > (recipe.maxBatches || 0))}
              className="px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
            >
              <ChefHat className="w-4 h-4" />
              <span>{isSubmitting ? 'Registrando...' : `Confirmar y Producir (${numericBatches} ${numericBatches === 1 ? 'tanda' : 'tandas'})`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
);
};

