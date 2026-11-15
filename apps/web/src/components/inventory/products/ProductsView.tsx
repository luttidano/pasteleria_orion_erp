import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import type {
  AdjustStockPayload,
  CatalogProduct,
  ProductKind,
  Recipe,
  Supplier,
  ToastMessage,
  User,
} from '../../../types';
import { productService } from '../../../services/productService';
import { recipeService } from '../../../services/recipeService';
import { supplierService } from '../../../services/supplierService';
import { ProductModal } from './ProductModal';
import { StockAdjustmentModal, type StockAdjustmentTarget } from '../StockAdjustmentModal';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import {
  ProductFiltersBar,
  type ProductCounts,
} from './components/ProductFiltersBar';
import { ProductCardItem } from './components/ProductCardItem';
import { ProductsTable } from './components/ProductsTable';
import { ProductEmptyState } from './components/ProductEmptyState';

interface ProductsViewProps {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onInventoryChange?: () => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  user,
  addToast,
  onInventoryChange,
}) => {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros
  const [typeFilter, setTypeFilter] = useState<'all' | ProductKind>(
    user.role === 'baker' ? 'manufactured' : 'all',
  );
  const [statusFilter, setStatusFilter] = useState<'todos' | 'suficiente' | 'bajo' | 'agotado'>('todos');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  // Estados de modales
  const [productToDelete, setProductToDelete] = useState<CatalogProduct | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);
  const [adjustmentTarget, setAdjustmentTarget] = useState<StockAdjustmentTarget | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<CatalogProduct | null>(null);

  const isAdmin = user.role === 'admin';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodsRes, recipesRes, supsRes] = await Promise.allSettled([
        productService.getAll(),
        recipeService.getAll(),
        supplierService.getAll(),
      ]);

      if (prodsRes.status === 'fulfilled') {
        setProducts(prodsRes.value);
      } else {
        throw prodsRes.reason;
      }

      if (recipesRes.status === 'fulfilled') {
        setRecipes(recipesRes.value);
      } else {
        console.error('[ProductsView] Error cargando recetas auxiliares:', recipesRes.reason);
        addToast({
          type: 'warning',
          title: 'Recetas auxiliares',
          message: 'No se pudieron sincronizar las recetas vinculadas al catálogo.',
        });
      }

      if (supsRes.status === 'fulfilled') {
        setSuppliers(supsRes.value);
      } else {
        console.error('[ProductsView] Error cargando proveedores auxiliares:', supsRes.reason);
        addToast({
          type: 'warning',
          title: 'Proveedores auxiliares',
          message: 'No se pudieron sincronizar los proveedores vinculados al catálogo.',
        });
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al cargar catálogo',
        message: err instanceof Error ? err.message : 'No se pudo cargar los productos.',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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
      onInventoryChange?.();
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
  const handleConfirmDeleteProduct = async () => {
    if (!productToDelete || isDeletingProduct) return;
    setIsDeletingProduct(true);
    try {
      await productService.delete(productToDelete.id);
      addToast({
        type: 'warning',
        title: 'Producto eliminado',
        message: `Se quitó "${productToDelete.name}" del catálogo.`,
      });
      setProductToDelete(null);
      await loadData();
      onInventoryChange?.();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al eliminar',
        message: err instanceof Error ? err.message : 'No se pudo eliminar el producto.',
      });
    } finally {
      setIsDeletingProduct(false);
    }
  };

  // Ajuste de stock con motivo contable (Modal)
  const openAdjustmentModal = (product: CatalogProduct, delta: number) => {
    if (delta > 0 && product.productType === 'manufactured') {
      addToast({
        type: 'info',
        title: 'Producción requerida',
        message: `Para sumar existencias de "${product.name}", hornea una tanda desde Gestión de Recetas para descontar los insumos de bodega automáticamente.`,
      });
      return;
    }
    setAdjustmentTarget({
      id: product.id,
      name: product.name,
      itemType: 'product',
      currentStock: product.stock,
      unit: product.unit,
      unitCost: product.costPrice,
      initialDelta: delta,
    });
  };

  const handleConfirmAdjustment = async (
    id: string,
    payload: AdjustStockPayload,
  ) => {
    const updated = await productService.adjustStock(id, payload);
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    onInventoryChange?.();
    addToast({
      type: updated.accountingWarning ? 'warning' : 'success',
      title: updated.accountingWarning
        ? 'Stock actualizado (pendiente contable)'
        : 'Stock actualizado',
      message: updated.accountingWarning
        ? `${updated.name}: ${updated.stock} ${updated.unit}. ${updated.accountingWarning}`
        : `${updated.name}: ${updated.stock} ${updated.unit}`,
    });
  };

  // Filtrado de productos
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      if (statusFilter !== 'todos' && p.status !== statusFilter) return false;
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
  const counts = useMemo<ProductCounts>(() => {
    return {
      total: products.length,
      manufactured: products.filter((p) => p.productType === 'manufactured').length,
      resale: products.filter((p) => p.productType === 'resale').length,
      lowStock: products.filter((p) => p.status === 'bajo' || p.status === 'agotado').length,
    };
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
            type="button"
            onClick={loadData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-[#7A685D] dark:text-[#A8968A] hover:bg-[#F3E7D7] transition-all cursor-pointer"
            title="Recargar catálogo"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {isAdmin && (
            <button
              type="button"
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

      {/* 2. Barra de Filtros, Búsqueda y Alternador de Modo de Vista */}
      <ProductFiltersBar
        userRole={user.role}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        search={search}
        setSearch={setSearch}
        viewMode={viewMode}
        setViewMode={setViewMode}
        counts={counts}
      />

      {/* 3. Contenedor de Productos (Tarjetas, Tabla o Estado Vacío) */}
      {filteredProducts.length === 0 ? (
        <ProductEmptyState />
      ) : viewMode === 'cards' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <ProductCardItem
              key={p.id}
              product={p}
              isAdmin={isAdmin}
              onOpenAdjustmentModal={openAdjustmentModal}
              onEdit={(prod) => {
                setEditingProduct(prod);
                setIsModalOpen(true);
              }}
              onDelete={(prod) => setProductToDelete(prod)}
            />
          ))}
        </div>
      ) : (
        <ProductsTable
          products={filteredProducts}
          isAdmin={isAdmin}
          onEdit={(prod) => {
            setEditingProduct(prod);
            setIsModalOpen(true);
          }}
          onDelete={(prod) => setProductToDelete(prod)}
        />
      )}

      {/* 4. Modales */}
      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveProduct}
        productToEdit={editingProduct}
        recipes={recipes}
        suppliers={suppliers}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(productToDelete)}
        title="¿Eliminar producto del catálogo?"
        description={
          productToDelete ? (
            <>
              Estás a punto de eliminar{' '}
              <strong className="text-[#1C120D] dark:text-[#FBF4EB]">"{productToDelete.name}"</strong>{' '}
              del catálogo comercial.
            </>
          ) : null
        }
        confirmLabel="Sí, eliminar producto"
        isDeleting={isDeletingProduct}
        onClose={() => !isDeletingProduct && setProductToDelete(null)}
        onConfirm={handleConfirmDeleteProduct}
      />

      <StockAdjustmentModal
        target={adjustmentTarget}
        onClose={() => setAdjustmentTarget(null)}
        onConfirm={handleConfirmAdjustment}
      />
    </div>
  );
};
