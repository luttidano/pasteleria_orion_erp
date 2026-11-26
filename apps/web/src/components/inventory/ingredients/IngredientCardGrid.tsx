import React from 'react';
import { Edit2, Minus, Plus as PlusIcon, Trash2 } from 'lucide-react';
import type { Ingredient } from '../../../types';
import { formatQuantity } from '../../../utils/formatters';
import {
  getIngredientStockFlags,
  IngredientStockStatusBadge,
} from './IngredientStockStatusBadge';

interface IngredientCardGridProps {
  items: Ingredient[];
  isAdmin: boolean;
  onAdjustStock: (item: Ingredient, delta: number) => void;
  onEdit: (item: Ingredient) => void;
  onDelete: (item: Ingredient) => void;
}

/**
 * Vista en tarjetas espaciales para la despensa de ingredientes.
 */
export const IngredientCardGrid: React.FC<IngredientCardGridProps> = ({
  items,
  isAdmin,
  onAdjustStock,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const { isOutOfStock, isLowStock } = getIngredientStockFlags(
          item.stock,
          item.minStock,
        );
        const maxRef = Math.max(item.minStock * 2.5, item.stock, 1);
        const percent = Math.min(100, Math.round((item.stock / maxRef) * 100));

        return (
          <div
            key={item.id}
            className={`bg-white dark:bg-[#16100E] rounded-[22px] p-5 border transition-all flex flex-col justify-between hover:shadow-md ${
              isOutOfStock
                ? 'border-rose-300 dark:border-rose-900 bg-rose-50/20 dark:bg-rose-950/15'
                : isLowStock
                ? 'border-amber-300 dark:border-amber-900 bg-amber-50/20 dark:bg-amber-950/15'
                : 'border-[#DFCAA9]/80 dark:border-[#35251F]'
            }`}
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FAF5ED] dark:bg-[#221713] border border-[#EADBCE] dark:border-[#3A2822] flex items-center justify-center text-2xl select-none shadow-xs">
                  {item.icon || '🌾'}
                </div>
                <IngredientStockStatusBadge
                  stock={item.stock}
                  minStock={item.minStock}
                />
              </div>

              <h4 className="font-bold text-stone-900 dark:text-[#FAF3EC] text-base leading-snug">
                {item.name}
              </h4>
              <span className="text-[11px] text-stone-500 dark:text-stone-400 font-medium mt-0.5 block">
                {item.category}
              </span>

              {item.description && (
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-2 line-clamp-1 italic">
                  "{item.description}"
                </p>
              )}

              <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#281C17]">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
                    Disponible:
                  </span>
                  <div className="text-right">
                    <span
                      className={`text-2xl font-black font-sans ${
                        isOutOfStock
                          ? 'text-rose-600 dark:text-rose-400'
                          : isLowStock
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-stone-900 dark:text-white'
                      }`}
                    >
                      {formatQuantity(item.stock)}
                    </span>{' '}
                    <span className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">
                      {item.unit}
                    </span>
                  </div>
                </div>

                <div className="w-full bg-stone-100 dark:bg-[#251A15] rounded-full h-2 mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isOutOfStock
                        ? 'bg-rose-500'
                        : isLowStock
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.max(4, percent)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-stone-400 dark:text-stone-500 mt-1">
                  <span>Mínimo para avisar:</span>
                  <span className="font-semibold text-stone-700 dark:text-stone-300">
                    {formatQuantity(item.minStock)} {item.unit}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-5 pt-3 border-t border-stone-100 dark:border-[#281C17] flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-[#201613] p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => onAdjustStock(item, -1)}
                  disabled={item.stock <= 0}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-[#2C1E19] hover:bg-stone-50 dark:hover:bg-[#382620] text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-[#3A2822] flex items-center justify-center shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                  title={`Descontar / Registrar merma (${item.unit})`}
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs font-bold text-stone-700 dark:text-stone-300 px-1">
                  1 {item.unit}
                </span>
                <button
                  type="button"
                  onClick={() => onAdjustStock(item, 1)}
                  className="w-8 h-8 rounded-lg bg-white dark:bg-[#2C1E19] hover:bg-stone-50 dark:hover:bg-[#382620] text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-[#3A2822] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                  title={`Ingresar compra / sobrante (${item.unit})`}
                >
                  <PlusIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onEdit(item)}
                    className="p-2 rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#221713] transition-colors cursor-pointer"
                    title="Modificar ingrediente"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(item)}
                    className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                    title="Eliminar de la despensa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
