import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  BookOpen,
  Truck,
  Sparkles,
  Package,
  RefreshCw,
  LayoutGrid,
  List,
} from 'lucide-react';
import type { User, ToastMessage, Recipe, Supplier, CatalogProduct, ProductKind } from '../../types';
import { productService } from '../../services/productService';
import { recipeService } from '../../services/recipeService';
import { supplierService } from '../../services/supplierService';
import { ProductModal } from './ProductModal';

interface ProductsViewProps {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({ user, addToast }) => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [typeFilter, setTypeFilter] = useState<'all' | ProductKind>(
    user.role === 'baker' ? 'manufactured' : 'all'
  );
  const [statusFilter, setStatusFilter] = useState<'todos' | 'suficiente' | 'bajo' | 'agotado'>('todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);

  const isAdmin = user.role === 'admin';

  const loadData = async () => {
    try {
      setLoading(true);
      const [prodsData, recipesData, supsData] = await Promise.all([
        productService.getAll(),
        recipeService.getAll().catch(() => []),
        supplierService.getAll().catch(() => []),
      ]);
      setProducts(prodsData);
      setRecipes(recipesData);
      setSuppliers(supsData);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al cargar catálogo',
        message: err instanceof Error ? err.message : 'No se pudo cargar los productos.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Guardar (Crear o Editar)
  const handleSaveProduct = async (data: Partial<CatalogProduct>) => {
    try {
      if (editingProduct) {
        await productService.update(editingProduct.id, data);
        addToast({
          type: 'success',
          title: 'Producto actualizado',
          message: `Se guardaron los cambios de "${data.name}".`,
        });
      } else {
        await productService.create(data);
        addToast({
          type: 'success',
          title: 'Producto creado',
          message: `"${data.name}" se agregó al catálogo comercial.`,
        });
      }
      await loadData();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al guardar',
        message: err instanceof Error ? err.message : 'No se pudo guardar el producto.',
      });
      throw err;
    }
  };

  // Eliminar
  const handleDeleteProduct = async (product: CatalogProduct) => {
    if (!window.confirm(`¿Estás seguro de eliminar el producto "${product.name}"?`)) return;
    try {
      await productService.delete(product.id);
      addToast({
        type: 'warning',
        title: 'Producto eliminado',
        message: `Se quitó "${product.name}" del catálogo.`,
      });
      await loadData();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al eliminar',
        message: err instanceof Error ? err.message : 'No se pudo eliminar el producto.',
      });
    }
  };

  // Ajuste rápido de stock (+ / -)
  const handleStockDelta = async (product: CatalogProduct, delta: number) => {
    try {
      await productService.adjustStock(product.id, delta);
      await loadData();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error de inventario',
        message: err instanceof Error ? err.message : 'No se pudo ajustar el stock.',
      });
    }
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Filtro por Tipo de producto
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      // 2. Filtro por Estado de existencias
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
      // 3. Búsqueda por texto
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchName = p.name.toLowerCase().includes(query);
        const matchRecipe = p.recipeName?.toLowerCase().includes(query);
        const matchSupplier = p.supplierName?.toLowerCase().includes(query);
        return matchName || matchRecipe || matchSupplier;
      }
      return true;
    });
  }, [products, typeFilter, statusFilter, search]);

  // Contadores para métricas
  const counts = useMemo(() => {
    const total = products.length;
    const manufactured = products.filter((p) => p.productType === 'manufactured').length;
    const resale = products.filter((p) => p.productType === 'resale').length;
    const lowStock = products.filter((p) => p.status === 'bajo' || p.status === 'agotado').length;
    return { total, manufactured, resale, lowStock };
  }, [products]);

  return (
    <div className="space-y-6">
      {/* 1. Header con Resumen y Botón de Creación */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-[#1C120D] dark:text-[#FBF4EB] font-serif tracking-tight">
            Catálogo de Productos
          </h1>
          <p className="text-xs text-[#7A685D] dark:text-[#A8968A] mt-1">
            Gestión integral de vitrina y mostrador: elaboración propia y productos de reventa
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-[#7A685D] dark:text-[#A8968A] hover:bg-[#F3E7D7] transition-all cursor-pointer"
            title="Recargar catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              onClick={() => {
                setEditingProduct(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white text-xs sm:text-sm font-semibold shadow-btn transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Producto</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Filtro Segmentado por Tipo de Producto (Tabs) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#E8D7BE] dark:border-[#2C1D18] shadow-xs">
        <div className="flex items-center gap-1.5 flex-wrap">
          {user.role === 'admin' && (
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

          {user.role === 'admin' && (
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

      {/* 3. Buscador y Filtro Semáforo de Existencias */}
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

      {/* 4. Lista de Productos (Tarjetas o Tabla) */}
      {filteredProducts.length === 0 ? (
        <div className="py-16 text-center rounded-2xl bg-white dark:bg-[#16100E] border border-[#E8D7BE] dark:border-[#2C1D18]">
          <Package className="w-12 h-12 mx-auto text-stone-400 dark:text-stone-600 mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
            No se encontraron productos
          </h3>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
            Intenta cambiar los filtros o agrega un nuevo producto al catálogo.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => {
            const isManufactured = p.productType === 'manufactured';
            const margin = p.costPrice && p.salePrice > 0
              ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100)
              : null;

            return (
              <div
                key={p.id}
                className="p-5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#E8D7BE] dark:border-[#2C1D18] shadow-xs hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl select-none p-1.5 bg-[#FAF5ED] dark:bg-[#201612] rounded-xl border border-[#DFCAA9]/50">
                        {p.icon || (isManufactured ? '🧁' : '🥤')}
                      </span>
                      <div>
                        <h4 className="text-sm font-bold text-[#1C120D] dark:text-[#FBF4EB] leading-tight">
                          {p.name}
                        </h4>
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                            isManufactured
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                          }`}
                        >
                          {isManufactured ? <Sparkles className="w-2.5 h-2.5" /> : <Truck className="w-2.5 h-2.5" />}
                          {isManufactured ? 'Elaboración Propia' : 'Reventa'}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
                        p.status === 'suficiente'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                          : p.status === 'bajo'
                            ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                      }`}
                    >
                      {p.status === 'suficiente' ? 'Disponible' : p.status === 'bajo' ? 'Poco Stock' : 'Agotado'}
                    </span>
                  </div>

                  {/* Origen (Receta o Proveedor) */}
                  <div className="text-xs text-stone-600 dark:text-stone-400 mt-2 space-y-1">
                    {isManufactured && p.recipeName && (
                      <p className="flex items-center gap-1 text-[11px]">
                        <BookOpen className="w-3 h-3 text-[#8C1F25]" />
                        <span>Receta: {p.recipeName}</span>
                      </p>
                    )}
                    {!isManufactured && p.supplierName && (
                      <p className="flex items-center gap-1 text-[11px]">
                        <Truck className="w-3 h-3 text-blue-600" />
                        <span>Proveedor: {p.supplierName}</span>
                      </p>
                    )}
                  </div>

                  {/* Precios y Margen */}
                  <div className="mt-3 pt-3 border-t border-stone-100 dark:border-[#221814] flex items-center justify-between text-xs">
                    <div>
                      <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Precio Venta</span>
                      <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                        ${p.salePrice.toLocaleString('es-CL')}
                      </span>
                    </div>
                    {p.costPrice ? (
                      <div className="text-right">
                        <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Costo / Margen</span>
                        <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                          ${p.costPrice.toLocaleString('es-CL')} {margin !== null && `(${margin}%)`}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Stock y Acciones */}
                <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#221814] flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStockDelta(p, -1)}
                      disabled={p.stock <= 0}
                      className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 font-bold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-bold min-w-10 text-center">
                      {p.stock} <span className="text-[10px] text-stone-500 font-normal">{p.unit}</span>
                    </span>
                    <button
                      onClick={() => handleStockDelta(p, 1)}
                      className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 font-bold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingProduct(p);
                          setIsModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                        title="Modificar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Vista en Tabla */
        <div className="rounded-2xl border border-[#E8D7BE] dark:border-[#2C1D18] bg-white dark:bg-[#16100E] overflow-hidden">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F7EFE4]/60 dark:bg-[#1D1410] text-[#7A685D] dark:text-[#A8968A] font-bold">
                <th className="py-3 px-4">Producto</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3">Stock</th>
                <th className="py-3 px-3">Precio Venta</th>
                <th className="py-3 px-3">Costo</th>
                <th className="py-3 px-3">Origen</th>
                {isAdmin && <th className="py-3 px-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-[#221814]">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-[#1C1410] transition-colors">
                  <td className="py-3 px-4 flex items-center gap-2.5">
                    <span className="text-xl">{p.icon || '🧁'}</span>
                    <div>
                      <p className="font-bold text-[#1C120D] dark:text-[#FBF4EB]">{p.name}</p>
                      {p.description && <p className="text-[10px] text-stone-500">{p.description}</p>}
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        p.productType === 'manufactured'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                      }`}
                    >
                      {p.productType === 'manufactured' ? 'Elaborado' : 'Reventa'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-bold">
                    {p.stock} {p.unit}
                  </td>
                  <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                    ${p.salePrice.toLocaleString('es-CL')}
                  </td>
                  <td className="py-3 px-3 text-stone-600 dark:text-stone-400">
                    {p.costPrice ? `$${p.costPrice.toLocaleString('es-CL')}` : '-'}
                  </td>
                  <td className="py-3 px-3 text-stone-600 dark:text-stone-400">
                    {p.recipeName || p.supplierName || '-'}
                  </td>
                  {isAdmin && (
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingProduct(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1 rounded text-stone-500 hover:text-stone-800 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p)}
                          className="p-1 rounded text-rose-500 hover:text-rose-700 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        recipes={recipes}
        suppliers={suppliers}
      />
    </div>
  );
};
