import React from 'react';
import {
  LayoutGrid,
  List,
  Search,
  Sparkles,
  Truck,
} from 'lucide-react';
import type { ProductKind, UserRole } from '../../../../types';

export interface ProductCounts {
  total: number;
  manufactured: number;
  resale: number;
  lowStock: number;
}

interface ProductFiltersBarProps {
  userRole: UserRole;
  typeFilter: 'all' | ProductKind;
  setTypeFilter: (type: 'all' | ProductKind) => void;
  statusFilter: 'todos' | 'suficiente' | 'bajo' | 'agotado';
  setStatusFilter: (status: 'todos' | 'suficiente' | 'bajo' | 'agotado') => void;
  search: string;
  setSearch: (search: string) => void;
  viewMode: 'cards' | 'table';
  setViewMode: (mode: 'cards' | 'table') => void;
  counts: ProductCounts;
}

export const ProductFiltersBar: React.FC<ProductFiltersBarProps> = ({
  userRole,
  typeFilter,
  setTypeFilter,
  statusFilter,
  setStatusFilter,
  search,
  setSearch,
  viewMode,
  setViewMode,
  counts,
}) => {
  const isAdmin = userRole === 'admin';

  return (
    <div className="space-y-3">
      {/* 1. Filtro Segmentado por Tipo de Producto (Tabs) y Vista */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#E8D7BE] dark:border-[#2C1D18] shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setTypeFilter('all')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-[#685549] dark:text-[#B39F93] hover:bg-[#F3E7D7] dark:hover:bg-[#201612]'
              }`}
            >
              Todos ({counts.total})
            </button>
          )}

          <button
            type="button"
            onClick={() => setTypeFilter('manufactured')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              typeFilter === 'manufactured'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'text-[#685549] dark:text-[#B39F93] hover:bg-[#F3E7D7] dark:hover:bg-[#201612]'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Elaboración Propia ({counts.manufactured})</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setTypeFilter('resale')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'resale'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-[#685549] dark:text-[#B39F93] hover:bg-[#F3E7D7] dark:hover:bg-[#201612]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Reventa ({counts.resale})</span>
            </button>
          )}
        </div>

        {/* Alternador de vista Tarjetas / Tabla */}
        <div className="flex items-center gap-1 border-l border-[#E8D7BE] dark:border-[#2C1D18] pl-2">
          <button
            type="button"
            onClick={() => setViewMode('cards')}
            className={`p-2 rounded-lg text-xs transition-colors cursor-pointer ${
              viewMode === 'cards'
                ? 'bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E8BD8A]'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Vista en tarjetas"
          >
            <LayoutGrid className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-2 rounded-lg text-xs transition-colors cursor-pointer ${
              viewMode === 'table'
                ? 'bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E8BD8A]'
                : 'text-stone-500 hover:text-stone-800'
            }`}
            title="Vista en tabla"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Buscador y Filtro Semáforo de Existencias */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, receta o proveedor..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-xs font-medium text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
          />
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'todos'
                ? 'bg-stone-900 text-white border-stone-900 dark:bg-stone-100 dark:text-stone-900'
                : 'bg-white dark:bg-[#1E1512] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400'
            }`}
          >
            Todo
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('suficiente')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'suficiente'
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white dark:bg-[#1E1512] border-stone-200 dark:border-stone-800 text-emerald-600'
            }`}
          >
            Óptimo
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('bajo')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'bajo'
                ? 'bg-amber-600 text-white border-amber-600'
                : 'bg-white dark:bg-[#1E1512] border-stone-200 dark:border-stone-800 text-amber-600'
            }`}
          >
            Bajo
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('agotado')}
            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              statusFilter === 'agotado'
                ? 'bg-rose-600 text-white border-rose-600'
                : 'bg-white dark:bg-[#1E1512] border-stone-200 dark:border-stone-800 text-rose-600'
            }`}
          >
            Agotado
          </button>
        </div>
      </div>
    </div>
  );
};
