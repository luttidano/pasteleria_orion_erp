import { useState, useMemo, useEffect, useCallback } from 'react';
import type { AdjustStockPayload, Ingredient, ToastMessage, User } from '../../../../types';
import { ingredientService } from '../../../../services/ingredientService';
import {
  useCategoriesQuery,
  useIngredientsQuery,
  useInvalidateInventory,
} from '../../../../hooks/queries/useInventoryQueries';
import { getCategoryDefaultIcon } from '../../../../utils/categoryIcons';
import type { StockAdjustmentTarget } from '../../StockAdjustmentModal';
import type { StatusFilterType } from '../IngredientsView';

interface UseIngredientsViewParams {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  externalFilter?: StatusFilterType;
}

/**
 * Hook de estado, caché React Query y acciones CRUD para Despensa de Ingredientes.
 */
export function useIngredientsView({
  user,
  addToast,
  externalFilter,
}: UseIngredientsViewParams) {
  const {
    data: ingredients = [],
    isLoading: isIngredientsLoading,
    error: ingredientsError,
  } = useIngredientsQuery();
  const { data: categories = [] } = useCategoriesQuery('ingredient');
  const invalidateInventory = useInvalidateInventory();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('todos');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const isAdmin = user.role === 'admin';

  // Estados de modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [ingredientToEdit, setIngredientToEdit] = useState<Ingredient | null>(null);
  const [ingredientToDelete, setIngredientToDelete] = useState<Ingredient | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adjustmentTarget, setAdjustmentTarget] = useState<StockAdjustmentTarget | null>(null);

  useEffect(() => {
    if (ingredientsError) {
      const detail =
        ingredientsError instanceof Error
          ? ingredientsError.message
          : String(ingredientsError);
      addToast({
        type: 'error',
        title: 'Error de inventario',
        message: detail || 'No se pudieron cargar los insumos.',
      });
    }
  }, [ingredientsError, addToast]);

  useEffect(() => {
    if (externalFilter) {
      setStatusFilter(externalFilter);
    }
  }, [externalFilter]);

  useEffect(() => {
    if (selectedCategory !== 'Todas' && categories.length > 0) {
      const exists = categories.some((c) => c.name === selectedCategory);
      if (!exists) {
        setSelectedCategory('Todas');
      }
    }
  }, [categories, selectedCategory]);

  const categoryFilters = useMemo(() => {
    const base: Array<{ key: string; label: string; value: string; icon: string }> = [
      { key: 'todas', label: 'Todos', value: 'Todas', icon: '🧁' },
    ];
    for (const cat of categories) {
      base.push({
        key: cat.id,
        label: cat.name,
        value: cat.name,
        icon: cat.icon || getCategoryDefaultIcon(cat.name, categories),
      });
    }
    return base;
  }, [categories]);

  const metrics = useMemo(() => {
    const total = ingredients.length;
    const ok = ingredients.filter((p) => p.stock > p.minStock).length;
    const low = ingredients.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const out = ingredients.filter((p) => p.stock <= 0).length;
    return { total, ok, low, out };
  }, [ingredients]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return ingredients.filter((item) => {
      const matchesSearch =
        item.name.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query);

      const matchesCategory =
        selectedCategory === 'Todas' ||
        item.category.trim().toLowerCase() === selectedCategory.trim().toLowerCase();

      let matchesStatus = true;
      if (statusFilter === 'bajo') {
        matchesStatus = item.stock > 0 && item.stock <= item.minStock;
      } else if (statusFilter === 'agotado') {
        matchesStatus = item.stock <= 0;
      } else if (statusFilter === 'comprar') {
        matchesStatus = item.stock <= item.minStock;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [ingredients, searchTerm, selectedCategory, statusFilter]);

  const openAdjustmentModal = useCallback((ingredient: Ingredient, delta: number) => {
    setAdjustmentTarget({
      id: ingredient.id,
      name: ingredient.name,
      itemType: 'ingredient',
      currentStock: ingredient.stock,
      unit: ingredient.unit,
      unitCost: ingredient.price,
      initialDelta: delta,
    });
  }, []);

  const handleConfirmAdjustment = useCallback(
    async (id: string, payload: AdjustStockPayload, idempotencyKey?: string) => {
      const updated = await ingredientService.adjustStock(id, payload, idempotencyKey);
      await invalidateInventory();
      addToast({
        type: updated.accountingWarning ? 'warning' : 'info',
        title: updated.accountingWarning
          ? 'Existencia actualizada (pendiente contable)'
          : 'Existencia actualizada',
        message: updated.accountingWarning
          ? `${updated.name}: ${updated.stock} ${updated.unit}. ${updated.accountingWarning}`
          : `${updated.name}: ${updated.stock} ${updated.unit}`,
      });
    },
    [invalidateInventory, addToast],
  );

  const handleSaveIngredient = useCallback(
    async (data: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => {
      if (ingredientToEdit) {
        await ingredientService.updateIngredient(ingredientToEdit.id, data);
        addToast({
          type: 'success',
          title: 'Ingrediente actualizado',
          message: `Guardamos los cambios de "${data.name}".`,
        });
      } else {
        await ingredientService.addIngredient(data);
        addToast({
          type: 'success',
          title: 'Ingrediente agregado',
          message: `"${data.name}" se agregó a la despensa.`,
        });
      }
      await invalidateInventory();
    },
    [ingredientToEdit, invalidateInventory, addToast],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!ingredientToDelete) return;
    setIsDeleting(true);
    try {
      await ingredientService.deleteIngredient(ingredientToDelete.id);
      addToast({
        type: 'warning',
        title: 'Ingrediente eliminado',
        message: `Se quitó "${ingredientToDelete.name}" de la despensa.`,
      });
      await invalidateInventory();
      setIngredientToDelete(null);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al eliminar ingrediente',
        message: err instanceof Error ? err.message : 'No se pudo eliminar el ingrediente.',
      });
    } finally {
      setIsDeleting(false);
    }
  }, [ingredientToDelete, invalidateInventory, addToast]);

  const resetFilters = useCallback(() => {
    setSearchTerm('');
    setSelectedCategory('Todas');
    setStatusFilter('todos');
  }, []);

  return {
    ingredients,
    isLoading: isIngredientsLoading,
    isAdmin,
    searchTerm,
    setSearchTerm,
    selectedCategory,
    setSelectedCategory,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    categoryFilters,
    metrics,
    filteredProducts,
    isModalOpen,
    setIsModalOpen,
    isCategoryModalOpen,
    setIsCategoryModalOpen,
    ingredientToEdit,
    setIngredientToEdit,
    ingredientToDelete,
    setIngredientToDelete,
    isDeleting,
    adjustmentTarget,
    setAdjustmentTarget,
    openAdjustmentModal,
    handleConfirmAdjustment,
    handleSaveIngredient,
    handleConfirmDelete,
    resetFilters,
    invalidateInventory,
  };
}
