import React from 'react';
import { Search, ShoppingBag, LayoutGrid, List } from 'lucide-react';

export interface CategoryFilterItem {
  key: string;
  label: string;
  value: string;
  icon: string;
}

export interface IngredientFiltersBarProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categoryFilters: CategoryFilterItem[];
  viewMode: 'cards' | 'table';
  onViewModeChange: (mode: 'cards' | 'table') => void;
  isAdmin: boolean;
  shoppingListBadgeCount: number;
  onNavigateToShoppingList?: () => void;
  statusFilter: 'todos' | 'bajo' | 'agotado' | 'comprar';
  onToggleBuyFilter: () => void;
}

export const IngredientFiltersBar: React.FC<IngredientFiltersBarProps> = ({
  searchTerm,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categoryFilters,
  viewMode,
  onViewModeChange,
  isAdmin,
  shoppingListBadgeCount,
  onNavigateToShoppingList,
  statusFilter,
  onToggleBuyFilter,
}) => {
  return (
    <div className="bg-white dark:bg-[#16100E] p-4 sm:p-5 rounded-[22px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-3.5">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Buscador grande y limpio */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar ingrediente (ej: Harina, Mantequilla, Azúcar)..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-[#3E2922] bg-stone-50 dark:bg-[#201613] text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#8C1F25] focus:bg-white dark:focus:bg-[#281C18] transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
            >
              Borrar
            </button>
          )}
        </div>

        {/* Botón de Lista de Compras y Modo de Vista */}
        <div className="flex items-center gap-2">
          {isAdmin &&
            (onNavigateToShoppingList ? (
              <button
                type="button"
                onClick={onNavigateToShoppingList}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer active:scale-95"
                title="Abrir la Lista de Compras completa"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Ir a Lista de Compras ({shoppingListBadgeCount})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onToggleBuyFilter}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'comprar'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-[#221713] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#2E201A]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>
                  {statusFilter === 'comprar'
                    ? 'Viendo lista de compras'
                    : 'Ver lo que falta comprar'}
                </span>
              </button>
            ))}

          {/* Alternar tarjetas o tabla */}
          <div className="flex items-center bg-stone-100 dark:bg-[#221713] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onViewModeChange('cards')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-[#16100E] text-[#8C1F25] dark:text-[#E8A598] shadow-xs'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
              title="Vista de Tarjetas Visuales"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange('table')}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-[#16100E] text-[#8C1F25] dark:text-[#E8A598] shadow-xs'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
              title="Vista de Lista"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Categorías con Emojis visuales */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
        {categoryFilters.map((cat) => {
          const isSelected = selectedCategory === cat.value;
          return (
            <button
              key={cat.key}
              type="button"
              onClick={() => onCategoryChange(cat.value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl whitespace-nowrap font-medium transition-all cursor-pointer ${
                isSelected
                  ? 'bg-[#8C1F25] text-white shadow-xs font-semibold'
                  : 'bg-stone-100 dark:bg-[#221713] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#2E201B]'
              }`}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

