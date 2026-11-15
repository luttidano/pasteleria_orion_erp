import React from 'react';
import { AlertTriangle, XCircle } from 'lucide-react';
import type { ShoppingItemKind } from '../../../../types';

export interface ShoppingCounts {
  totalCount: number;
  outOfStockCount: number;
  lowStockCount: number;
  ingredientCount: number;
  resaleCount: number;
  packagingCount: number;
  generalSupplyCount: number;
  filteredCount: number;
}

interface ShoppingListFiltersBarProps {
  kindFilter: 'all' | ShoppingItemKind;
  setKindFilter: (kind: 'all' | ShoppingItemKind) => void;
  urgencyFilter: 'all' | 'out' | 'low';
  setUrgencyFilter: (urgency: 'all' | 'out' | 'low') => void;
  counts: ShoppingCounts;
}

export const ShoppingListFiltersBar: React.FC<ShoppingListFiltersBarProps> = ({
  kindFilter,
  setKindFilter,
  urgencyFilter,
  setUrgencyFilter,
  counts,
}) => {
  return (
    <>
      {/* 1. Filtro por Rubro (Pills) */}
      <div className="px-5 sm:px-6 py-2.5 bg-[#FAF5ED]/80 dark:bg-[#1C1411] border-b border-[#EADBCE] dark:border-[#35251F] flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-stone-500 dark:text-stone-400 font-semibold mr-1">Rubro:</span>
          <button
            type="button"
            onClick={() => setKindFilter('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              kindFilter === 'all'
                ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs'
                : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
            }`}
          >
            Todos ({counts.totalCount})
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('ingredient')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              kindFilter === 'ingredient'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
            }`}
          >
            <span>🌾 Insumos ({counts.ingredientCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('resale')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              kindFilter === 'resale'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-200 hover:bg-blue-100'
            }`}
          >
            <span>🥤 Reventa ({counts.resaleCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('packaging')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              kindFilter === 'packaging'
                ? 'bg-purple-600 text-white shadow-xs'
                : 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-800 dark:text-purple-200 hover:bg-purple-100'
            }`}
          >
            <span>📦 Empaques ({counts.packagingCount})</span>
          </button>
          <button
            type="button"
            onClick={() => setKindFilter('general_supply')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              kindFilter === 'general_supply'
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-900/60 text-teal-800 dark:text-teal-200 hover:bg-teal-100'
            }`}
          >
            <span>🧤 Insumos Generales ({counts.generalSupplyCount})</span>
          </button>
        </div>
      </div>

      {/* 2. Filtro por Urgencia (Agotados vs Stock Bajo) */}
      <div className="px-5 sm:px-6 py-2.5 bg-[#FAF5ED]/50 dark:bg-[#1A120F] border-b border-[#EADBCE]/80 dark:border-[#35251F] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-stone-500 dark:text-stone-400 font-semibold mr-1">Urgencia:</span>

          <button
            type="button"
            onClick={() => setUrgencyFilter('all')}
            className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              urgencyFilter === 'all'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
            }`}
          >
            Todos los faltantes ({counts.totalCount})
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('out')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              urgencyFilter === 'out'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 hover:bg-rose-100'
            }`}
          >
            <XCircle className="w-3.5 h-3.5" />
            <span>Agotados / Urgentes ({counts.outOfStockCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setUrgencyFilter('low')}
            className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
              urgencyFilter === 'low'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>Queda poco ({counts.lowStockCount})</span>
          </button>
        </div>

        <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
          Mostrando <strong>{counts.filteredCount}</strong> de {counts.totalCount} pendientes
        </div>
      </div>
    </>
  );
};
