import React from 'react';
import { Plus, Search, Store, Truck } from 'lucide-react';
import type { SupplierType } from '../../../types';

export type SupplierModalityFilter = 'all' | 'despacho' | 'presencial';
export type SupplierTypeFilter = 'all' | SupplierType;

export interface SupplierFilterCounts {
  total: number;
  despacho: number;
  presencial: number;
  materiaPrima: number;
  empaques: number;
  reventa: number;
  insumosGenerales: number;
}

interface SupplierFiltersHeaderProps {
  totalSuppliers: number;
  counts: SupplierFilterCounts;
  modalityFilter: SupplierModalityFilter;
  onModalityChange: (value: SupplierModalityFilter) => void;
  typeFilter: SupplierTypeFilter;
  onTypeChange: (value: SupplierTypeFilter) => void;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoriesList: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  onAddSupplier: () => void;
}

export const SupplierFiltersHeader: React.FC<SupplierFiltersHeaderProps> = ({
  totalSuppliers,
  counts,
  modalityFilter,
  onModalityChange,
  typeFilter,
  onTypeChange,
  searchTerm,
  onSearchChange,
  categoriesList,
  selectedCategory,
  onSelectCategory,
  onAddSupplier,
}) => {
  return (
    <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-3xl p-5 sm:p-6 border border-[#DFCAA9]/70 dark:border-[#35251F] shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E25C64] text-[11px] font-bold tracking-wide uppercase">
              Directorio Telefónico
            </span>
            <span className="text-xs text-stone-400">•</span>
            <span className="text-xs text-stone-500 dark:text-stone-400">
              {totalSuppliers} contactos registrados
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif mt-1">
            Directorio de Proveedores & Abastecimiento
          </h2>
          <p className="text-xs sm:text-sm text-[#6C594D] dark:text-[#B4A194] mt-0.5">
            Gestión de compras para materias primas, insumos y productos de reventa comercial.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={onAddSupplier}
            className="px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#72191E] active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-[#8C1F25]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Proveedor</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros y Búsqueda integrada */}
      <div className="mt-4 pt-4 border-t border-[#E8D7BE]/80 dark:border-[#2C1D18] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Modalidad */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9]/70 dark:border-[#2C1D18] w-fit shadow-2xs">
            <button
              type="button"
              onClick={() => onModalityChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modalityFilter === 'all'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              Todas las modalidades ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => onModalityChange('despacho')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modalityFilter === 'despacho'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Con Despacho ({counts.despacho})</span>
            </button>
            <button
              type="button"
              onClick={() => onModalityChange('presencial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modalityFilter === 'presencial'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Compra en Local ({counts.presencial})</span>
            </button>
          </div>

          {/* Selector de Tipo de Proveedor */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9]/70 dark:border-[#2C1D18] w-fit shadow-2xs">
            <button
              type="button"
              onClick={() => onTypeChange('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                typeFilter === 'all'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              Todos los tipos
            </button>
            <button
              type="button"
              onClick={() => onTypeChange('materia_prima')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'materia_prima'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <span>🌾</span>
              <span>Materia Prima ({counts.materiaPrima})</span>
            </button>
            <button
              type="button"
              onClick={() => onTypeChange('empaque')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'empaque'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <span>📦</span>
              <span>Empaques ({counts.empaques})</span>
            </button>
            <button
              type="button"
              onClick={() => onTypeChange('reventa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'reventa'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <span>🛍️</span>
              <span>Reventa ({counts.reventa})</span>
            </button>
            <button
              type="button"
              onClick={() => onTypeChange('insumo_general')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                typeFilter === 'insumo_general'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <span>🧤</span>
              <span>Insumos Generales ({counts.insumosGenerales})</span>
            </button>
          </div>
        </div>

        {/* Búsqueda */}
        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por nombre, insumos o dirección..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-xs text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
          />
        </div>
      </div>

      {/* Chips de filtro por rubro */}
      <div className="mt-3 flex flex-wrap gap-1.5 items-center">
        <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mr-1 hidden sm:inline">
          Rubro:
        </span>
        {categoriesList.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => onSelectCategory(cat)}
            className={`text-[11px] px-3 py-1 rounded-full border transition-all cursor-pointer ${
              selectedCategory === cat
                ? 'bg-[#8C1F25] text-white border-[#8C1F25] font-semibold shadow-xs'
                : 'bg-white dark:bg-[#201612] text-stone-600 dark:text-stone-300 border-[#DFCAA9]/70 dark:border-[#35251F] hover:bg-[#F3E7D7] dark:hover:bg-[#2A1D18]'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>
    </div>
  );
};

