import React from 'react';
import { CheckCircle, AlertCircle, XCircle, X } from 'lucide-react';

export interface IngredientMetricsCardsProps {
  metrics: {
    total: number;
    ok: number;
    low: number;
    out: number;
  };
  statusFilter: 'todos' | 'bajo' | 'agotado' | 'comprar';
  filteredCount: number;
  onFilterChange: (status: 'todos' | 'bajo' | 'agotado' | 'comprar') => void;
}

export const IngredientMetricsCards: React.FC<IngredientMetricsCardsProps> = ({
  metrics,
  statusFilter,
  filteredCount,
  onFilterChange,
}) => {
  return (
    <>
      {/* Resumen visual en 3 estados claros (Semáforo de Despensa) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* En Despensa (Todos los ingredientes) */}
        <button
          type="button"
          onClick={() => onFilterChange('todos')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'todos'
              ? 'bg-white dark:bg-[#1C1411] border-[#8C1F25] dark:border-[#B83238] shadow-sm ring-2 ring-[#8C1F25]/20'
              : 'bg-white/90 dark:bg-[#16100E] border-stone-200 dark:border-[#35251F] hover:bg-white dark:hover:bg-[#1C1411]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider">
              En Despensa
            </span>
            <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-3xl font-extrabold text-stone-900 dark:text-stone-100 mt-2 font-sans">
            {metrics.total}
          </div>
          <p className="text-xs text-stone-600 dark:text-stone-400 mt-1">
            {metrics.ok} con cantidad suficiente
          </p>
        </button>

        {/* Queda Poco (SOLO los que están bajos de stock) */}
        <button
          type="button"
          onClick={() => onFilterChange(statusFilter === 'bajo' ? 'todos' : 'bajo')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'bajo'
              ? 'bg-amber-50 dark:bg-[#2A1B0E] border-amber-500 shadow-sm ring-2 ring-amber-500/30'
              : metrics.low > 0
              ? 'bg-amber-50/70 dark:bg-[#201509] border-amber-200 dark:border-[#854D0E] hover:bg-amber-50'
              : 'bg-white/90 dark:bg-[#16100E] border-stone-200 dark:border-[#35251F]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900 dark:text-amber-300 uppercase tracking-wider">
              Queda Poco
            </span>
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="text-3xl font-extrabold text-amber-950 dark:text-amber-200 mt-2 font-sans">
            {metrics.low}
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300/80 mt-1">
            {metrics.low > 0 ? 'Conviene reponer pronto' : 'Todo con buen nivel'}
          </p>
        </button>

        {/* Agotados (SOLO los que están agotados, stock <= 0) */}
        <button
          type="button"
          onClick={() => onFilterChange(statusFilter === 'agotado' ? 'todos' : 'agotado')}
          className={`p-4 sm:p-5 rounded-2xl border text-left transition-all cursor-pointer ${
            statusFilter === 'agotado'
              ? 'bg-rose-50 dark:bg-[#2C1012] border-rose-500 shadow-sm ring-2 ring-rose-500/30'
              : metrics.out > 0
              ? 'bg-rose-50/70 dark:bg-[#200B0D] border-rose-200 dark:border-[#991B1B] hover:bg-rose-50'
              : 'bg-white/90 dark:bg-[#16100E] border-stone-200 dark:border-[#35251F]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-900 dark:text-rose-300 uppercase tracking-wider">
              Agotados
            </span>
            <XCircle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
          </div>
          <div className="text-3xl font-extrabold text-rose-950 dark:text-rose-200 mt-2 font-sans">
            {metrics.out}
          </div>
          <p className="text-xs text-rose-800 dark:text-rose-300/80 mt-1">
            {metrics.out > 0 ? 'Sin existencias en despensa' : 'Ningún insumo en cero'}
          </p>
        </button>
      </div>

      {/* Indicador de filtro activo con botón para limpiar */}
      {statusFilter !== 'todos' && (
        <div className="flex items-center justify-between bg-stone-100 dark:bg-[#1E1512] border border-stone-200 dark:border-[#35251F] px-4 py-2.5 rounded-xl text-xs animate-fade-in">
          <div className="flex items-center gap-2 text-stone-700 dark:text-stone-300">
            <span className="font-semibold">Mostrando únicamente:</span>
            {statusFilter === 'agotado' && (
              <span className="px-2.5 py-0.5 rounded-md bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 font-bold border border-rose-300 dark:border-rose-800">
                ❌ Insumos Agotados ({filteredCount})
              </span>
            )}
            {statusFilter === 'bajo' && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-800">
                ⚠️ Insumos que Quedan Poco ({filteredCount})
              </span>
            )}
            {statusFilter === 'comprar' && (
              <span className="px-2.5 py-0.5 rounded-md bg-stone-800 text-white font-bold">
                🛒 Lista de Compras ({filteredCount})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onFilterChange('todos')}
            className="flex items-center gap-1 text-[#8C1F25] dark:text-[#E8A598] hover:text-[#74191E] font-bold hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Ver toda la despensa</span>
          </button>
        </div>
      )}
    </>
  );
};

