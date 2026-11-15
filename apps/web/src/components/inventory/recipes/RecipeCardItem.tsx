import React from 'react';
import { AlertTriangle, CheckCircle2, ChefHat, Trash2 } from 'lucide-react';
import type { Recipe, UserRole } from '../../../../types';

interface RecipeCardItemProps {
  recipe: Recipe;
  userRole: UserRole;
  massUnit: 'g' | 'kg';
  onProduce: (recipe: Recipe) => void;
  onDelete: (recipe: Recipe) => void;
}

export function formatRecipeQuantity(
  quantity: number,
  unit: string,
  massUnit: 'g' | 'kg',
): string {
  const u = unit.toLowerCase().trim();
  if (['g', 'gr', 'gramos', 'gramo'].includes(u)) {
    if (massUnit === 'kg') {
      const val = quantity / 1000;
      return `${val < 0.01 ? val.toFixed(3) : val.toFixed(2)} kg`;
    }
    return `${quantity} g`;
  }
  if (['kg', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) {
    if (massUnit === 'g') {
      return `${quantity * 1000} g`;
    }
    return `${quantity} kg`;
  }
  return `${quantity} ${unit}`;
}

export const RecipeCardItem: React.FC<RecipeCardItemProps> = ({
  recipe,
  userRole,
  massUnit,
  onProduce,
  onDelete,
}) => {
  const isAdmin = userRole === 'admin';

  return (
    <div
      className={`bg-white dark:bg-[#16100E] rounded-2xl p-5 border flex flex-col justify-between transition-all shadow-xs ${
        recipe.canProduce
          ? 'border-emerald-200 dark:border-emerald-950/60 hover:border-emerald-400'
          : 'border-stone-200/80 dark:border-[#35251F] hover:border-amber-300'
      }`}
    >
      <div>
        {/* Header de la tarjeta */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400">
              {recipe.category || 'Pastelería'}
            </span>
            <h4 className="font-bold text-base text-[#2A1B16] dark:text-[#FDF5EE] mt-1.5">
              {recipe.name}
            </h4>
            {recipe.description && (
              <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5">
                {recipe.description}
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => onDelete(recipe)}
              className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-50 dark:hover:bg-[#201612] cursor-pointer"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Badge de disponibilidad de producción */}
        <div className="mt-4">
          {recipe.canProduce ? (
            <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Lista para producir
              </span>
              <span className="font-extrabold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                {recipe.maxBatches} {recipe.maxBatches === 1 ? 'tanda' : 'tandas'}
              </span>
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs">
              <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Faltan insumos en bodega
              </div>
              {recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                  Faltan: {recipe.missingIngredients.map((m) => m.name).join(', ')}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lista de ingredientes requeridos */}
        <div className="mt-4 space-y-1.5">
          <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
            Fórmula / Ingredientes:
          </div>
          <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
            {recipe.ingredients.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#FAF5ED]/50 dark:bg-[#201612]/50 border border-[#EADBCE]/40 dark:border-[#35251F]/40"
              >
                <span className="text-stone-700 dark:text-stone-300 font-medium">
                  {item.ingredientName}
                </span>
                <span className="font-mono font-bold text-[#8C1F25] dark:text-[#E07A5F]">
                  {formatRecipeQuantity(item.quantity, item.unit, massUnit)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Botón de Producción */}
      <button
        type="button"
        onClick={() => onProduce(recipe)}
        className="w-full mt-3.5 py-2 px-3 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
      >
        <ChefHat className="w-4 h-4" />
        <span>Producir {recipe.name}</span>
      </button>

      {/* Pie de tarjeta */}
      <div className="mt-3 pt-2.5 border-t border-stone-100 dark:border-[#2C1D18] flex items-center justify-between text-xs text-stone-400">
        <span>
          Rinde: <strong className="text-stone-600 dark:text-stone-300">{recipe.yieldServings} porciones</strong>
        </span>
        <span className="text-[10px]">{recipe.ingredients.length} insumos</span>
      </div>
    </div>
  );
};
