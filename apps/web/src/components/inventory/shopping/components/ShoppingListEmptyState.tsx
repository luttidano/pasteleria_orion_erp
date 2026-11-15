import React from 'react';

interface ShoppingListEmptyStateProps {
  hasAnyNeededItems: boolean;
  onResetFilters: () => void;
}

export const ShoppingListEmptyState: React.FC<ShoppingListEmptyStateProps> = ({
  hasAnyNeededItems,
  onResetFilters,
}) => {
  return (
    <div className="p-12 text-center">
      <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 border border-emerald-200 dark:border-emerald-800">
        ✓
      </div>
      <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
        {!hasAnyNeededItems
          ? '¡No hay compras pendientes!'
          : 'No hay ítems con este filtro'}
      </h3>
      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
        {!hasAnyNeededItems
          ? 'Todos los insumos, productos de reventa, empaques e insumos generales cuentan con existencias suficientes.'
          : 'Selecciona otro filtro para revisar los pendientes.'}
      </p>
      {hasAnyNeededItems && (
        <button
          type="button"
          onClick={onResetFilters}
          className="mt-3 px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-200 cursor-pointer"
        >
          Ver todos los faltantes
        </button>
      )}
    </div>
  );
};
