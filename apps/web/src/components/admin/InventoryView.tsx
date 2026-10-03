import { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Plus,
  Edit2,
  Trash2,
  RotateCcw,
  Minus,
  Plus as PlusIcon,
  LayoutGrid,
  List,
  AlertCircle,
  CheckCircle,
  XCircle,
  ShoppingBag,
  X
} from 'lucide-react';
import type { Product, IngredientCategory, ToastMessage } from '../../types';
import { inventoryService } from '../../services/inventoryService';
import { ProductModal } from './ProductModal';
import { DeleteConfirmModal } from './DeleteConfirmModal';

export type StatusFilterType = 'todos' | 'bajo' | 'agotado' | 'comprar';

interface InventoryViewProps {
  products: Product[];
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  externalFilter?: StatusFilterType;
  onNavigateToShoppingList?: () => void;
}

const CATEGORIES: Array<{ label: string; value: 'Todas' | IngredientCategory; icon: string }> = [
  { label: 'Todos', value: 'Todas', icon: '🧁' },
  { label: 'Harinas y Polvos', value: 'Harinas y Polvos', icon: '🌾' },
  { label: 'Lácteos y Huevos', value: 'Lácteos y Huevos', icon: '🧈' },
  { label: 'Azúcares y Dulces', value: 'Azúcares y Dulces', icon: '🍬' },
  { label: 'Chocolates y Cacaos', value: 'Chocolates y Cacaos', icon: '🍫' },
  { label: 'Frutas y Esencias', value: 'Frutas y Esencias', icon: '🍓' },
];

export const InventoryView: React.FC<InventoryViewProps> = ({
  products,
  onRefresh,
  addToast,
  externalFilter,
  onNavigateToShoppingList,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'Todas' | IngredientCategory>('Todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('todos');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Sync external filter from sidebar if provided
  useEffect(() => {
    if (externalFilter) {
      setStatusFilter(externalFilter);
    }
  }, [externalFilter]);

  // Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [ingredientToEdit, setIngredientToEdit] = useState<Product | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Accurate bakery metrics
  const metrics = useMemo(() => {
    const total = products.length;
    const ok = products.filter((p) => p.stock > p.minStock).length;
    const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const out = products.filter((p) => p.stock <= 0).length;
    return { total, ok, low, out };
  }, [products]);

  // Filtered ingredients
  const filteredProducts = useMemo(() => {
    return products.filter((item) => {
      // 1. Text Search
      const matchesSearch =
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase());

      // 2. Category Tab
      const matchesCategory =
        selectedCategory === 'Todas' || item.category === selectedCategory;

      // 3. Exact Status Filter
      let matchesStatus = true;
      if (statusFilter === 'bajo') {
        // EXACTAMENTE los que están bajos de stock pero tienen existencia (> 0)
        matchesStatus = item.stock > 0 && item.stock <= item.minStock;
      } else if (statusFilter === 'agotado') {
        // EXACTAMENTE los que están en 0 (agotados)
        matchesStatus = item.stock <= 0;
      } else if (statusFilter === 'comprar') {
        // Todos los que necesitan compra (bajo stock o agotados)
        matchesStatus = item.stock <= item.minStock;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchTerm, selectedCategory, statusFilter]);

  // Quick stock adjustment
  const handleStockDelta = async (ingredient: Product, delta: number) => {
    try {
      await inventoryService.adjustStock(ingredient.id, delta);
      await onRefresh();
      addToast({
        type: 'info',
        title: 'Existencia actualizada',
        message: `${ingredient.name}: ${Math.max(0, ingredient.stock + delta)} ${ingredient.unit}`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Error al ajustar cantidad',
      });
    }
  };

  // Add / Edit
  const handleSaveIngredient = async (
    data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ) => {
    if (ingredientToEdit) {
      await inventoryService.updateProduct(ingredientToEdit.id, data);
      addToast({
        type: 'success',
        title: 'Ingrediente actualizado',
        message: `Guardamos los cambios de "${data.name}".`,
      });
    } else {
      await inventoryService.addProduct(data);
      addToast({
        type: 'success',
        title: 'Ingrediente agregado',
        message: `"${data.name}" se agregó a la despensa.`,
      });
    }
    await onRefresh();
  };

  // Delete
  const handleConfirmDelete = async () => {
    if (!ingredientToDelete) return;
    setIsDeleting(true);
    try {
      await inventoryService.deleteProduct(ingredientToDelete.id);
      addToast({
        type: 'warning',
        title: 'Ingrediente eliminado',
        message: `Se quitó "${ingredientToDelete.name}" de la despensa.`,
      });
      await onRefresh();
      setIngredientToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  // Reset to default sample ingredients
  const handleResetDefaults = async () => {
    if (window.confirm('¿Quieres volver a cargar la lista de ingredientes iniciales de la pastelería (Harina, Mantequilla, Leche, Huevos, etc.)?')) {
      setIsResetting(true);
      try {
        await inventoryService.resetToDefaults();
        await onRefresh();
        addToast({
          type: 'success',
          title: 'Despensa reiniciada',
          message: 'Se cargaron los insumos básicos de pastelería.',
        });
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      {/* 1. Header con título centrado y acogedor */}
      <div className="flex flex-col items-center text-center gap-4 bg-white dark:bg-[#16100E] p-6 sm:p-7 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif tracking-tight text-center">
            Despensa de Ingredientes
          </h2>
          <p className="text-xs sm:text-sm text-stone-600 dark:text-stone-400 mt-1.5 max-w-lg mx-auto text-center">
            Revisa tus materias primas disponibles y lo que hace falta comprar para la producción de hoy.
          </p>
        </div>

        <div className="flex items-center justify-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleResetDefaults}
            disabled={isResetting}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201613] text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#2C1F1A] text-xs font-semibold transition-colors cursor-pointer"
            title="Carga de nuevo los ingredientes básicos de muestra"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>Recargar Ejemplos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIngredientToEdit(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-btn transition-all duration-150 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Ingrediente</span>
          </button>
        </div>
      </div>

      {/* 2. Resumen visual en 3 estados claros (Semáforo de Despensa) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {/* En Despensa (Todos los ingredientes) */}
        <button
          type="button"
          onClick={() => setStatusFilter('todos')}
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
          onClick={() => setStatusFilter(statusFilter === 'bajo' ? 'todos' : 'bajo')}
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
          onClick={() => setStatusFilter(statusFilter === 'agotado' ? 'todos' : 'agotado')}
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
                ❌ Insumos Agotados ({filteredProducts.length})
              </span>
            )}
            {statusFilter === 'bajo' && (
              <span className="px-2.5 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 font-bold border border-amber-300 dark:border-amber-800">
                ⚠️ Insumos que Quedan Poco ({filteredProducts.length})
              </span>
            )}
            {statusFilter === 'comprar' && (
              <span className="px-2.5 py-0.5 rounded-md bg-stone-800 text-white font-bold">
                🛒 Lista de Compras ({filteredProducts.length})
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setStatusFilter('todos')}
            className="flex items-center gap-1 text-[#8C1F25] dark:text-[#E8A598] hover:text-[#74191E] font-bold hover:underline cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Ver toda la despensa</span>
          </button>
        </div>
      )}

      {/* 3. Buscador amplio y selector de categorías con emojis */}
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
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar ingrediente (ej: Harina, Mantequilla, Azúcar)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 dark:border-[#3E2922] bg-stone-50 dark:bg-[#201613] text-sm text-stone-900 dark:text-stone-100 placeholder-stone-400 dark:placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-[#8C1F25] focus:bg-white dark:focus:bg-[#281C18] transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                Borrar
              </button>
            )}
          </div>

          {/* Botón de Lista de Compras (filtro rápido o módulo completo) y Modo de Vista */}
          <div className="flex items-center gap-2">
            {onNavigateToShoppingList ? (
              <button
                type="button"
                onClick={onNavigateToShoppingList}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-xs transition-all cursor-pointer active:scale-95"
                title="Abrir la Lista de Compras completa"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Ir a Lista de Compras ({metrics.low + metrics.out})</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setStatusFilter(statusFilter === 'comprar' ? 'todos' : 'comprar')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'comprar'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'bg-stone-100 dark:bg-[#221713] text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-[#2E201A]'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>{statusFilter === 'comprar' ? 'Viendo lista de compras' : 'Ver lo que falta comprar'}</span>
              </button>
            )}

            {/* Alternar tarjetas o tabla */}
            <div className="flex items-center bg-stone-100 dark:bg-[#221713] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'cards' ? 'bg-white dark:bg-[#16100E] text-[#8C1F25] dark:text-[#E8A598] shadow-xs' : 'text-stone-500 dark:text-stone-400'
                }`}
                title="Vista de Tarjetas Visuales"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-white dark:bg-[#16100E] text-[#8C1F25] dark:text-[#E8A598] shadow-xs' : 'text-stone-500 dark:text-stone-400'
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
          {CATEGORIES.map((cat) => {
            const isSelected = selectedCategory === cat.value;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setSelectedCategory(cat.value)}
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


      {/* 4. Lista o Cuadrícula de Ingredientes */}
      {filteredProducts.length === 0 ? (
        <div className="bg-white p-12 rounded-[24px] border border-stone-200 text-center animate-fade-in">
          <div className="text-4xl mb-3">🧺</div>
          <h3 className="font-bold text-stone-800 text-base">
            {statusFilter === 'agotado'
              ? '¡No hay ingredientes agotados!'
              : statusFilter === 'bajo'
              ? '¡No hay ingredientes con stock bajo!'
              : 'No hay ingredientes con este criterio'}
          </h3>
          <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
            {statusFilter === 'agotado'
              ? 'Todos tus insumos tienen existencias en despensa.'
              : statusFilter === 'bajo'
              ? 'Tus insumos están por encima del mínimo de seguridad.'
              : 'Intenta limpiar los filtros o buscar con otro término.'}
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('Todas');
              setStatusFilter('todos');
            }}
            className="mt-4 px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Ver todos los ingredientes
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* Vista de Tarjetas Espaciosas y Visuales (Ideal para pasteleros) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((item) => {
            const isOutOfStock = item.stock <= 0;
            const isLowStock = !isOutOfStock && item.stock <= item.minStock;

            // Porcentaje visual para la barra de nivel (base: doble del mínimo)
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
                  {/* Top: Icono y Estado */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#FAF5ED] dark:bg-[#221713] border border-[#EADBCE] dark:border-[#3A2822] flex items-center justify-center text-2xl select-none shadow-xs">
                      {item.icon || '🌾'}
                    </div>

                    {isOutOfStock ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800">
                        ❌ Agotado
                      </span>
                    ) : isLowStock ? (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 animate-pulse">
                        ⚠️ Queda Poco
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                        ✓ Suficiente
                      </span>
                    )}
                  </div>

                  {/* Nombre y Categoría */}
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

                  {/* Existencias Grandes */}
                  <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#281C17]">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">Disponible:</span>
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
                          {item.stock}
                        </span>{' '}
                        <span className="text-xs font-bold text-stone-600 dark:text-stone-400 uppercase">
                          {item.unit}
                        </span>
                      </div>
                    </div>

                    {/* Barra visual de nivel */}
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
                        {item.minStock} {item.unit}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Botones de acción rápida: Sumar / Restar y Editar */}
                <div className="mt-5 pt-3 border-t border-stone-100 dark:border-[#281C17] flex items-center justify-between gap-2">
                  {/* Ajuste rápido con botones grandes */}
                  <div className="flex items-center gap-1.5 bg-stone-100 dark:bg-[#201613] p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleStockDelta(item, -1)}
                      disabled={item.stock <= 0}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-[#2C1E19] hover:bg-stone-50 dark:hover:bg-[#382620] text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-[#3A2822] flex items-center justify-center shadow-xs transition-colors disabled:opacity-40 cursor-pointer"
                      title={`Restar 1 ${item.unit}`}
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="text-xs font-bold text-stone-700 dark:text-stone-300 px-1">
                      1 {item.unit}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStockDelta(item, 1)}
                      className="w-8 h-8 rounded-lg bg-white dark:bg-[#2C1E19] hover:bg-stone-50 dark:hover:bg-[#382620] text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-[#3A2822] flex items-center justify-center shadow-xs transition-colors cursor-pointer"
                      title={`Sumar 1 ${item.unit}`}
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Acciones Editar y Borrar */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIngredientToEdit(item);
                        setIsModalOpen(true);
                      }}
                      className="p-2 rounded-xl text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-[#221713] transition-colors cursor-pointer"
                      title="Modificar ingrediente"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIngredientToDelete(item)}
                      className="p-2 rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Eliminar de la despensa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista de Tabla Espaciosa y Limpia */
        <div className="bg-white dark:bg-[#16100E] rounded-[22px] border border-[#DFCAA9] dark:border-[#35251F] shadow-xs overflow-hidden">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300">
                <th className="py-4 px-6">Ingrediente</th>
                <th className="py-4 px-4">Categoría</th>
                <th className="py-4 px-4 text-center">Existencia</th>
                <th className="py-4 px-4">Estado</th>
                <th className="py-4 px-6 text-right">Opciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
              {filteredProducts.map((item) => {
                const isOutOfStock = item.stock <= 0;
                const isLowStock = !isOutOfStock && item.stock <= item.minStock;

                return (
                  <tr key={item.id} className="hover:bg-stone-50/70 dark:hover:bg-[#201613]/60 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl select-none">{item.icon || '🌾'}</span>
                        <div>
                          <div className="font-bold text-stone-900 dark:text-[#FAF3EC]">{item.name}</div>
                          {item.description && (
                            <div className="text-xs text-stone-400 mt-0.5">{item.description}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-stone-600 dark:text-stone-400">
                      {item.category}
                    </td>
                    <td className="py-4 px-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleStockDelta(item, -1)}
                          disabled={item.stock <= 0}
                          className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#281C17] hover:bg-stone-200 dark:hover:bg-[#35251F] text-stone-800 dark:text-stone-200 flex items-center justify-center text-xs disabled:opacity-30 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-extrabold text-base font-sans min-w-[70px] text-center text-stone-900 dark:text-white">
                          {item.stock} {item.unit}
                        </span>
                        <button
                          onClick={() => handleStockDelta(item, 1)}
                          className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#281C17] hover:bg-stone-200 dark:hover:bg-[#35251F] text-stone-800 dark:text-stone-200 flex items-center justify-center text-xs cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                      <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
                        Mínimo: {item.minStock} {item.unit}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      {isOutOfStock ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-800 dark:text-rose-200">
                          Agotado
                        </span>
                      ) : isLowStock ? (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200">
                          Queda poco
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-200">
                          Suficiente
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setIngredientToEdit(item);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white rounded-lg hover:bg-stone-100 dark:hover:bg-[#201613] cursor-pointer"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setIngredientToDelete(item)}
                          className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}


      {/* Modales */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setIngredientToEdit(null);
        }}
        onSave={handleSaveIngredient}
        productToEdit={ingredientToEdit}
      />

      <DeleteConfirmModal
        isOpen={Boolean(ingredientToDelete)}
        product={ingredientToDelete}
        onClose={() => setIngredientToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
