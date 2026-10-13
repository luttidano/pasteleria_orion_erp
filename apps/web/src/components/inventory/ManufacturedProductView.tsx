import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  BookOpen,
  Sparkles,
  X,
  AlertTriangle,
  RefreshCw,
  Package,
} from 'lucide-react';
import type { User, ToastMessage, Recipe, CatalogProduct } from '../../types';
import { productService } from '../../services/productService';
import { recipeService } from '../../services/recipeService';

interface ManufacturedProductsViewProps {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const COMMON_UNITS = ['un', 'porción', 'torta', 'docena', 'bandeja'];
const SUGGESTED_ICONS = ['🧁', '🎂', '🍰', '🥧', '🥐', '🥖', '🍩', '🍪', '🥞', '🧇'];

export const ManufacturedProductsView: React.FC<ManufacturedProductsViewProps> = ({ user, addToast }) => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'suficiente' | 'bajo' | 'agotado'>('todos');

  // Estado del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);
  const [name, setName] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [stock, setStock] = useState<number | ''>(0);
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [unit, setUnit] = useState('un');
  const [salePrice, setSalePrice] = useState<number | ''>(2500);
  const [costPrice, setCostPrice] = useState<number | ''>(1000);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🧁');
  const [saving, setSaving] = useState(false);

  const isAdmin = user.role === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodsData, recipesData] = await Promise.all([
        productService.getAll('manufactured'),
        recipeService.getAll(),
      ]);
      setProducts(prodsData);
      setRecipes(recipesData);
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error al cargar productos elaborados',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const openCreateModal = () => {
    setEditingProduct(null);
    setName('');
    setRecipeId(recipes.length > 0 ? recipes[0].id : '');
    setStock(0);
    setMinStock(5);
    setUnit('un');
    setSalePrice(2500);
    setCostPrice(1000);
    setDescription('');
    setIcon('🧁');
    setIsModalOpen(true);
  };

  const openEditModal = (p: CatalogProduct) => {
    setEditingProduct(p);
    setName(p.name);
    setRecipeId(p.recipeId || (recipes.length > 0 ? recipes[0].id : ''));
    setStock(p.stock);
    setMinStock(p.minStock);
    setUnit(p.unit || 'un');
    setSalePrice(p.salePrice);
    setCostPrice(p.costPrice || 0);
    setDescription(p.description || '');
    setIcon(p.icon || '🧁');
    setIsModalOpen(true);
  };

  // Al seleccionar receta, autocompletar nombre si está vacío
  const handleRecipeChange = (recId: string) => {
    setRecipeId(recId);
    if (!name || name === '') {
      const selected = recipes.find((r) => r.id === recId);
      if (selected) setName(selected.name);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      addToast({ type: 'warning', title: 'Nombre requerido', message: 'Escribe el nombre del producto' });
      return;
    }
    if (!recipeId) {
      addToast({ type: 'warning', title: 'Receta requerida', message: 'Selecciona la receta con la que se elabora' });
      return;
    }

    try {
      setSaving(true);
      const payload: Partial<CatalogProduct> = {
        name: name.trim(),
        productType: 'manufactured',
        recipeId,
        stock: Number(stock) || 0,
        minStock: Number(minStock) || 0,
        unit,
        salePrice: Number(salePrice) || 0,
        costPrice: Number(costPrice) || 0,
        description: description.trim() || undefined,
        icon,
      };

      if (editingProduct) {
        await productService.update(editingProduct.id, payload);
        addToast({ type: 'success', title: 'Producto actualizado' });
      } else {
        await productService.create(payload);
        addToast({ type: 'success', title: 'Producto creado exitosamente' });
      }

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error al guardar', message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, prodName: string) => {
    if (!confirm(`¿Eliminar el producto "${prodName}"?`)) return;
    try {
      await productService.delete(id);
      addToast({ type: 'success', title: 'Producto eliminado' });
      setProducts((prev) => prev.filter((p) => p.id !== id));
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error al eliminar', message: err.message });
    }
  };

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.recipeName && p.recipeName.toLowerCase().includes(search.toLowerCase()));
      const matchesStatus = statusFilter === 'todos' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [products, search, statusFilter]);

  const formatCLP = (val: number) =>
    new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-stone-200/80 dark:border-[#35251F] shadow-xs">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 rounded-xl">
              <Sparkles className="w-5 h-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#2A1B16] dark:text-[#FDF5EE]">
              Inventario de Elaboración Propia
            </h2>
          </div>
          <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-1">
            Tortas, pasteles y postres producidos en pastelería vinculados a sus fichas técnicas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 border border-stone-200 dark:border-[#35251F] rounded-xl hover:bg-stone-50 dark:hover:bg-[#1F1512] transition-colors"
            title="Refrescar"
          >
            <RefreshCw className={`w-4 h-4 text-stone-600 dark:text-stone-300 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {isAdmin && (
            <button
              onClick={openCreateModal}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs sm:text-sm shadow-xs transition-all active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Elaborado</span>
            </button>
          )}
        </div>
      </div>

      {/* Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <input
            type="text"
            placeholder="Buscar por producto o receta..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-amber-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {(['todos', 'suficiente', 'bajo', 'agotado'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-colors ${
                statusFilter === st
                  ? 'bg-[#2A1B16] text-[#FAF5ED] dark:bg-[#F5ECE5] dark:text-[#2A1B16]'
                  : 'bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-600 dark:text-stone-300 hover:bg-stone-50'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      {/* Lista de Productos Elaborados */}
      {loading ? (
        <div className="py-20 text-center text-stone-400 dark:text-stone-500">
          <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin text-amber-600" />
          <p className="text-sm">Cargando inventario de producción...</p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] rounded-[26px] p-12 text-center border border-dashed border-stone-300 dark:border-[#35251F]">
          <Package className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-700 dark:text-stone-200">No hay productos elaborados</h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            {search ? 'No coincide con tu búsqueda.' : 'Crea tu primer producto asociándolo a una receta.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isOutOfStock = p.stock <= 0;
            const isLowStock = p.stock > 0 && p.stock <= p.minStock;

            return (
              <div
                key={p.id}
                className="bg-white dark:bg-[#16100E] rounded-[22px] p-5 border border-stone-200/80 dark:border-[#35251F] shadow-xs flex flex-col justify-between hover:border-amber-400/50 transition-all"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl p-2 bg-[#FAF5ED] dark:bg-[#1F1512] rounded-xl border border-stone-100 dark:border-stone-800">
                        {p.icon || '🧁'}
                      </span>
                      <div>
                        <h4 className="font-bold text-stone-900 dark:text-[#FDF5EE] text-base leading-tight">
                          {p.name}
                        </h4>
                        <div className="flex items-center gap-1.5 mt-1 text-xs text-amber-800 dark:text-amber-400 font-medium">
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{p.recipeName || 'Sin receta vinculada'}</span>
                        </div>
                      </div>
                    </div>

                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full capitalize ${
                        isOutOfStock
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400'
                          : isLowStock
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
                            : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400'
                      }`}
                    >
                      {p.status || (isOutOfStock ? 'agotado' : isLowStock ? 'bajo' : 'suficiente')}
                    </span>
                  </div>

                  {p.description && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-3 line-clamp-2">
                      {p.description}
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-stone-100 dark:border-[#241712] text-xs">
                    <div>
                      <span className="text-stone-400 block text-[10px]">Stock Disponible</span>
                      <span className="font-bold text-stone-800 dark:text-stone-200 text-sm">
                        {p.stock} {p.unit}
                      </span>
                      <span className="text-[10px] text-stone-400 block">Mín: {p.minStock} {p.unit}</span>
                    </div>

                    <div className="text-right">
                      <span className="text-stone-400 block text-[10px]">Precio Venta</span>
                      <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                        {formatCLP(p.salePrice)}
                      </span>
                      {p.costPrice ? (
                        <span className="text-[10px] text-stone-400 block">Costo: {formatCLP(p.costPrice)}</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {isAdmin && (
                  <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-stone-100 dark:border-[#241712]">
                    <button
                      onClick={() => openEditModal(p)}
                      className="p-1.5 text-stone-500 hover:text-amber-700 dark:hover:text-amber-400 transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-1.5 text-stone-500 hover:text-rose-600 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-[26px] max-w-lg w-full border border-[#DFCAA9] dark:border-[#35251F] shadow-2xl overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-[#E8D7BE] dark:border-[#2C1D18] flex items-center justify-between">
              <h3 className="font-bold font-serif text-lg text-[#2A1B16] dark:text-[#FDF5EE]">
                {editingProduct ? 'Editar Producto Elaborado' : 'Nuevo Producto Elaborado'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
              {/* Receta vinculada (Campo Clave) */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Receta Vinculada *
                </label>
                <select
                  value={recipeId}
                  onChange={(e) => handleRecipeChange(e.target.value)}
                  className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm font-medium focus:ring-2 focus:ring-amber-600"
                  required
                >
                  <option value="" disabled>Selecciona una receta...</option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      📖 {r.name} (Rinde: {r.yieldServings})
                    </option>
                  ))}
                </select>
                {recipes.length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> No tienes recetas registradas aún.
                  </p>
                )}
              </div>

              {/* Nombre e Icono */}
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-3">
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nombre del Producto *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej: Torta Selva Negra 20p"
                    className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-amber-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">Icono</label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className="w-full px-2 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-sm"
                  >
                    {SUGGESTED_ICONS.map((ic) => (
                      <option key={ic} value={ic}>{ic}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stock y Stock Mínimo */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Stock Actual
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={stock}
                    onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={minStock}
                    onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">Unidad</label>
                  <select
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    className="w-full px-2 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Precio Venta y Costo */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Precio Venta (CLP) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={salePrice}
                    onChange={(e) => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Costo Estimado (CLP)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm"
                  />
                </div>
              </div>

              {/* Descripción */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Detalles sobre presentación, porciones o alergenos..."
                  className="w-full px-3 py-2 bg-white dark:bg-[#201511] border border-stone-300 dark:border-[#35251F] rounded-xl text-xs sm:text-sm"
                />
              </div>

              {/* Botones de acción */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200 dark:border-[#2C1D18]">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 border border-stone-300 dark:border-[#35251F] rounded-xl text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-amber-700 hover:bg-amber-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all active:scale-95 disabled:opacity-50"
                >
                  {saving ? 'Guardando...' : editingProduct ? 'Actualizar' : 'Crear Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
