import React from 'react';

export function getIngredientStockFlags(stock: number, minStock: number) {
  const isOutOfStock = stock <= 0;
  const isLowStock = !isOutOfStock && stock <= minStock;
  return { isOutOfStock, isLowStock };
}

interface IngredientStockStatusBadgeProps {
  stock: number;
  minStock: number;
  compact?: boolean;
}

/**
 * Insignia visual compartida para el estado de stock de un ingrediente.
 */
export const IngredientStockStatusBadge: React.FC<IngredientStockStatusBadgeProps> = ({
  stock,
  minStock,
  compact = false,
}) => {
  const { isOutOfStock, isLowStock } = getIngredientStockFlags(stock, minStock);

  if (isOutOfStock) {
    return (
      <span
        className={
          compact
            ? 'px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200'
            : 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
        }
      >
        {compact ? 'Agotado' : '❌ Agotado'}
      </span>
    );
  }

  if (isLowStock) {
    return (
      <span
        className={
          compact
            ? 'px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200'
            : 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 animate-pulse'
        }
      >
        {compact ? 'Queda poco' : '⚠️ Queda Poco'}
      </span>
    );
  }

  return (
    <span
      className={
        compact
          ? 'px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200'
          : 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
      }
    >
      {compact ? 'Suficiente' : '✓ Suficiente'}
    </span>
  );
};
