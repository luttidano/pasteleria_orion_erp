import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Cake,
  Tag,
} from 'lucide-react';
import type { User, ToastMessage, Recipe, Category, ProductionResult } from '../../../types';
import { recipeService } from '../../../services/recipeService';
import { categoryService } from '../../../services/categoryService';
import {
  useIngredientsQuery,
  useInvalidateInventory,
} from '../../../hooks/queries/useInventoryQueries';
import { CategoryManagerModal } from '../categories/CategoryManagerModal';
import { ProduceRecipeModal } from './ProduceRecipeModal';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import { RecipeFormModal, type RecipeFormData } from './RecipeFormModal';
import { RecipeCardItem } from './RecipeCardItem';

interface RecipesViewProps {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const RecipesView: React.FC<RecipesViewProps> = ({
  user,
  addToast,
}) => {
  const { data: ingredients = [] } = useIngredientsQuery();
  const invalidateInventory = useInvalidateInventory();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'canProduce' | 'missing'>('all');
  const [search, setSearch] = useState('');
  const [producingRecipe, setProducingRecipe] = useState<Recipe | null>(null);
  const [recipeToDelete, setRecipeToDelete] = useState<Recipe | null>(null);
  const [isDeletingRecipe, setIsDeletingRecipe] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [massUnit, setMassUnit] = useState<'g' | 'kg'>('g');

  const isAdmin = user.role === 'admin';

  const loadRecipes = useCallback(async () => {
    try {
      setLoading(true);
      const [recipesRes, catRes] = await Promise.allSettled([
        recipeService.getAll(),
        categoryService.getAll('recipe'),
      ]);

      if (recipesRes.status === 'fulfilled') {
        setRecipes(recipesRes.value);
      } else {
        throw recipesRes.reason;
      }

      if (catRes.status === 'fulfilled') {
        setCategories(catRes.value);
      } else {
        console.error('[RecipesView] Error cargando categorías de recetas:', catRes.reason);
        addToast({
          type: 'warning',
          title: 'Categorías auxiliares',
          message: 'No se pudieron sincronizar las categorías de recetas.',
        });
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al cargar recetas',
        message: err instanceof Error ? err.message : 'No se pudieron cargar las recetas.',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadRecipes();
  }, [loadRecipes]);

  // Filtrado de recetas
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
      if (!matchSearch) return false;
      if (filterMode === 'canProduce') return r.canProduce;
      if (filterMode === 'missing') return !r.canProduce;
      return true;
    });
  }, [recipes, search, filterMode]);

  const handleProductionSuccess = (result: ProductionResult) => {
    addToast({
      type: 'success',
      title: '¡Producción completada!',
      message: result.message,
    });
    if (result.accountingWarning) {
      addToast({
        type: 'warning',
        title: 'Asiento de producción pendiente',
        message: result.accountingWarning,
      });
    }
    void loadRecipes();
    void invalidateInventory();
  };

  const handleCreateRecipe = async (data: RecipeFormData) => {
    try {
      await recipeService.create({
        name: data.name,
        description: data.description,
        yieldServings: data.yieldServings,
        category: data.category,
        ingredients: data.ingredients,
      });
      addToast({
        type: 'success',
        title: 'Receta creada',
        message: `"${data.name}" se guardó correctamente.`,
      });
      await loadRecipes();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al guardar',
        message: err instanceof Error ? err.message : 'No se pudo guardar la receta.',
      });
      throw err;
    }
  };

  const handleConfirmDeleteRecipe = async () => {
    if (!recipeToDelete || isDeletingRecipe) return;
    setIsDeletingRecipe(true);
    try {
      await recipeService.delete(recipeToDelete.id);
      addToast({
        type: 'warning',
        title: 'Receta eliminada',
        message: `Se eliminó "${recipeToDelete.name}".`,
      });
      setRecipeToDelete(null);
      await loadRecipes();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al eliminar',
        message: err instanceof Error ? err.message : 'No se pudo eliminar la receta.',
      });
    } finally {
      setIsDeletingRecipe(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Barra superior con filtros, toggle y botón */}
      <div className="bg-white dark:bg-[#16100E] p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-[#35251F] flex flex-wrap items-center justify-between gap-4">
        {/* Pestañas de estado */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-[#201612] rounded-xl border border-stone-200 dark:border-[#2C1D18]">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-white dark:bg-[#2C1D18] text-[#8C1F25] dark:text-[#E07A5F] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Todas ({recipes.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('canProduce')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              filterMode === 'canProduce'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-emerald-600'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Listas ({recipes.filter((r) => r.canProduce).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('missing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 cursor-pointer ${
              filterMode === 'missing'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-amber-600'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Faltan insumos ({recipes.filter((r) => !r.canProduce).length})
          </button>
        </div>

        {/* Buscador y Toggle g / kg */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Buscar receta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-800 dark:text-stone-200 focus:outline-hidden focus:ring-1 focus:ring-[#8C1F25]"
            />
          </div>

          {/* Toggle g / kg */}
          <div className="flex items-center gap-1 bg-[#FAF5ED] dark:bg-[#201612] p-1 rounded-xl border border-[#EADBCE] dark:border-[#35251F]">
            <Scale className="w-3.5 h-3.5 text-stone-500 ml-1" />
            <button
              type="button"
              onClick={() => setMassUnit('g')}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                massUnit === 'g'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Gramos (g)
            </button>
            <button
              type="button"
              onClick={() => setMassUnit('kg')}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                massUnit === 'kg'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Kilos (kg)
            </button>
          </div>

          {/* Botón Nueva Receta y Categorías (Admin) */}
          {isAdmin && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3 py-2 bg-stone-100 hover:bg-stone-200 dark:bg-[#201612] dark:hover:bg-[#2C1D18] text-stone-700 dark:text-stone-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-stone-200 dark:border-[#35251F]"
                title="Gestionar Categorías"
              >
                <Tag className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E07A5F]" />
                Categorías
              </button>
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 bg-[#8C1F25] hover:bg-[#74191E] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nueva Receta
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={loadRecipes}
            disabled={loading}
            className="p-2 border border-stone-200 dark:border-[#35251F] rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#201612] cursor-pointer"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 2. Grid de Recetas */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] p-12 text-center rounded-2xl border border-stone-200/80 dark:border-[#35251F]">
          <Cake className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No hay recetas encontradas</h3>
          <p className="text-xs text-stone-500 mt-1">Crea una nueva fórmula para calcular producción con tu inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => (
            <RecipeCardItem
              key={recipe.id}
              recipe={recipe}
              userRole={user.role}
              massUnit={massUnit}
              onProduce={(rec) => setProducingRecipe(rec)}
              onDelete={(rec) => setRecipeToDelete(rec)}
            />
          ))}
        </div>
      )}

      {/* 3. Modales */}
      <ProduceRecipeModal
        recipe={producingRecipe}
        isOpen={Boolean(producingRecipe)}
        onClose={() => setProducingRecipe(null)}
        onSuccess={handleProductionSuccess}
      />

      <RecipeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleCreateRecipe}
        ingredients={ingredients}
        categories={categories}
      />

      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type="recipe"
        onCategoriesChanged={loadRecipes}
        addToast={addToast}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(recipeToDelete)}
        title="¿Eliminar receta?"
        description={
          recipeToDelete ? (
            <>
              Estás a punto de eliminar la receta{' '}
              <strong className="text-[#1C120D] dark:text-[#FBF4EB]">"{recipeToDelete.name}"</strong>.
            </>
          ) : null
        }
        confirmLabel="Sí, eliminar receta"
        isDeleting={isDeletingRecipe}
        onClose={() => !isDeletingRecipe && setRecipeToDelete(null)}
        onConfirm={handleConfirmDeleteRecipe}
      />
    </div>
  );
};
