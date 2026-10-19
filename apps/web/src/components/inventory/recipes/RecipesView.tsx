import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Scale,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Trash2,
  Cake,
  Tag,
} from 'lucide-react';
import type { User, Ingredient, ToastMessage, Recipe, Category } from '../../../types';
import { recipeService } from '../../../services/recipeService';
import { categoryService } from '../../../services/categoryService';
import { CategoryManagerModal } from '../categories/CategoryManagerModal';

interface RecipesViewProps {
  user: User;
  ingredients: Ingredient[];
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const RecipesView: React.FC<RecipesViewProps> = ({ user, ingredients, addToast }) => {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<'all' | 'canProduce' | 'missing'>('all');
  const [search, setSearch] = useState('');
  
  // Toggle: mostrar masa en gramos (g) o en kilogramos (kg)
  const [massUnit, setMassUnit] = useState<'g' | 'kg'>('g');

  // Modal para crear nueva receta
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formServings, setFormServings] = useState(1);
  const [formCategory, setFormCategory] = useState('Pastelería Fina');
  const [selectedIngredients, setSelectedIngredients] = useState<
    Array<{ ingredientId: string; quantity: number; unit: string }>
  >([]);

  const loadRecipes = async () => {
    try {
      setLoading(true);
      const [recipeData, catData] = await Promise.all([
        recipeService.getAll(),
        categoryService.getAll('recipe').catch(() => []),
      ]);
      setRecipes(recipeData);
      setCategories(catData);
      if (catData.length > 0 && !formName) {
        setFormCategory(catData[0].name);
      }
    } catch (err: any) {
      addToast({
        type: 'error',
        title: 'Error al cargar recetas',
        message: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  // Formatear cantidades según el toggle g/kg
  const formatQuantity = (quantity: number, unit: string) => {
    const u = unit.toLowerCase().trim();
    if (['g', 'gr', 'gramos', 'gramo'].includes(u)) {
      if (massUnit === 'kg') {
        const val = quantity / 1000;
        return `${val < 0.01 ? val.toFixed(3) : val.toFixed(2)} kg`;
      }
      return `${quantity} g`;
    }
    if (['kg', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) {
      if (massUnit === 'g') {
        return `${quantity * 1000} g`;
      }
      return `${quantity} kg`;
    }
    return `${quantity} ${unit}`;
  };

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

  // Agregar insumo al formulario
  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) return;
    setSelectedIngredients([
      ...selectedIngredients,
      { ingredientId: ingredients[0].id, quantity: 100, unit: 'g' },
    ]);
  };

  const handleCreateRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || selectedIngredients.length === 0) {
      addToast({ type: 'warning', title: 'Faltan datos', message: 'Indica un nombre y al menos un ingrediente' });
      return;
    }

    try {
      await recipeService.create({
        name: formName,
        description: formDescription,
        yieldServings: Number(formServings),
        category: formCategory,
        ingredients: selectedIngredients,
      });
      addToast({ type: 'success', title: 'Receta creada', message: 'Se ha guardado correctamente' });
      setIsModalOpen(false);
      setFormName('');
      setFormDescription('');
      setSelectedIngredients([]);
      loadRecipes();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  const handleDeleteRecipe = async (id: string, name: string) => {
    if (!confirm(`¿Eliminar la receta "${name}"?`)) return;
    try {
      await recipeService.delete(id);
      addToast({ type: 'success', title: 'Receta eliminada' });
      loadRecipes();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Barra superior con filtros, toggle y botón */}
      <div className="bg-white dark:bg-[#16100E] p-4 sm:p-5 rounded-2xl border border-stone-200/80 dark:border-[#35251F] flex flex-wrap items-center justify-between gap-4">
        {/* Pestañas de estado */}
        <div className="flex items-center gap-1.5 p-1 bg-stone-100 dark:bg-[#201612] rounded-xl border border-stone-200 dark:border-[#2C1D18]">
          <button
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              filterMode === 'all'
                ? 'bg-white dark:bg-[#2C1D18] text-[#8C1F25] dark:text-[#E07A5F] shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
            }`}
          >
            Todas ({recipes.length})
          </button>
          <button
            onClick={() => setFilterMode('canProduce')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              filterMode === 'canProduce'
                ? 'bg-emerald-500 text-white shadow-xs'
                : 'text-stone-600 dark:text-stone-400 hover:text-emerald-600'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Listas ({recipes.filter((r) => r.canProduce).length})
          </button>
          <button
            onClick={() => setFilterMode('missing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
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

          {/* TOGGLE G / KG */}
          <div className="flex items-center gap-1 bg-[#FAF5ED] dark:bg-[#201612] p-1 rounded-xl border border-[#EADBCE] dark:border-[#35251F]">
            <Scale className="w-3.5 h-3.5 text-stone-500 ml-1" />
            <button
              onClick={() => setMassUnit('g')}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                massUnit === 'g'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Gramos (g)
            </button>
            <button
              onClick={() => setMassUnit('kg')}
              className={`px-2 py-1 text-xs font-bold rounded-lg transition-all ${
                massUnit === 'kg'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
              }`}
            >
              Kilos (kg)
            </button>
          </div>

          {/* Botón Nueva Receta y Categorías (Admin) */}
          {user.role === 'admin' && (
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
                onClick={() => setIsModalOpen(true)}
                className="px-3.5 py-2 bg-[#8C1F25] hover:bg-[#74191E] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Nueva Receta
              </button>
            </div>
          )}

          <button
            onClick={loadRecipes}
            className="p-2 border border-stone-200 dark:border-[#35251F] rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#201612]"
            title="Recargar"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Grid de Recetas */}
      {filteredRecipes.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] p-12 text-center rounded-2xl border border-stone-200/80 dark:border-[#35251F]">
          <Cake className="w-12 h-12 text-stone-300 dark:text-stone-700 mx-auto mb-3" />
          <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">No hay recetas encontradas</h3>
          <p className="text-xs text-stone-500 mt-1">Crea una nueva fórmula para calcular producción con tu inventario.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRecipes.map((recipe) => (
            <div
              key={recipe.id}
              className={`bg-white dark:bg-[#16100E] rounded-2xl p-5 border flex flex-col justify-between transition-all shadow-xs ${
                recipe.canProduce
                  ? 'border-emerald-200 dark:border-emerald-950/60 hover:border-emerald-400'
                  : 'border-stone-200/80 dark:border-[#35251F] hover:border-amber-300'
              }`}
            >
              <div>
                {/* Header de la tarjeta */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs px-2 py-0.5 rounded-md font-medium bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400">
                      {recipe.category || 'Pastelería'}
                    </span>
                    <h4 className="font-bold text-base text-[#2A1B16] dark:text-[#FDF5EE] mt-1.5">
                      {recipe.name}
                    </h4>
                    {recipe.description && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 line-clamp-2 mt-0.5">
                        {recipe.description}
                      </p>
                    )}
                  </div>
                  {user.role === 'admin' && (
                    <button
                      onClick={() => handleDeleteRecipe(recipe.id, recipe.name)}
                      className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-50 dark:hover:bg-[#201612]"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Badge de disponibilidad de producción */}
                <div className="mt-4">
                  {recipe.canProduce ? (
                    <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 flex items-center justify-between text-xs">
                      <span className="font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        Lista para producir
                      </span>
                      <span className="font-extrabold text-emerald-900 dark:text-emerald-200 bg-emerald-100 dark:bg-emerald-900/60 px-2 py-0.5 rounded-md">
                        {recipe.maxBatches} {recipe.maxBatches === 1 ? 'tanda' : 'tandas'}
                      </span>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 text-xs">
                      <div className="font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Faltan insumos en bodega
                      </div>
                      {recipe.missingIngredients && recipe.missingIngredients.length > 0 && (
                        <div className="mt-1 text-[11px] text-amber-700 dark:text-amber-400">
                          Faltan: {recipe.missingIngredients.map((m) => m.name).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Lista de ingredientes requeridos */}
                <div className="mt-4 space-y-1.5">
                  <div className="text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                    Fórmula / Ingredientes:
                  </div>
                  <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                    {recipe.ingredients.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[#FAF5ED]/50 dark:bg-[#201612]/50 border border-[#EADBCE]/40 dark:border-[#35251F]/40"
                      >
                        <span className="text-stone-700 dark:text-stone-300 font-medium">
                          {item.ingredientName}
                        </span>
                        <span className="font-mono font-bold text-[#8C1F25] dark:text-[#E07A5F]">
                          {formatQuantity(item.quantity, item.unit)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Pie de tarjeta */}
              <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#2C1D18] flex items-center justify-between text-xs text-stone-400">
                <span>Rinde: <strong className="text-stone-600 dark:text-stone-300">{recipe.yieldServings} porciones</strong></span>
                <span className="text-[10px]">{recipe.ingredients.length} insumos</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Crear Receta */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#16100E] rounded-2xl max-w-lg w-full p-6 border border-stone-200 dark:border-[#35251F] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE]">Nueva Receta</h3>

            <form onSubmit={handleCreateRecipe} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400">Nombre</label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Ej. Torta Selva Negra"
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-stone-600 dark:text-stone-400">Categoría</label>
                  {categories.length > 0 ? (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full mt-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-800 dark:text-stone-200"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.name}>
                          {c.icon || '🏷️'} {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="Pastelería Fina"
                      className="w-full mt-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                    />
                  )}
                </div>
                <div>
                  <label className="text-xs font-semibold text-stone-600 dark:text-stone-400">Porciones (Rendimiento)</label>
                  <input
                    type="number"
                    min="1"
                    value={formServings}
                    onChange={(e) => setFormServings(Number(e.target.value))}
                    className="w-full mt-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-stone-600 dark:text-stone-400">Descripción / Notas</label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Instrucciones breves de preparación..."
                  rows={2}
                  className="w-full mt-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                />
              </div>

              {/* Ingredientes de la Receta */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300">Insumos Requeridos</span>
                  <button
                    type="button"
                    onClick={handleAddIngredientRow}
                    className="text-xs text-[#8C1F25] dark:text-[#E07A5F] font-semibold hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar insumo
                  </button>
                </div>

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedIngredients.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => {
                          const copy = [...selectedIngredients];
                          copy[idx].ingredientId = e.target.value;
                          setSelectedIngredients(copy);
                        }}
                        className="flex-1 p-1.5 text-xs rounded-lg border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                      >
                        {ingredients.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.unit})
                          </option>
                        ))}
                      </select>

                      <input
                        type="number"
                        min="0.01"
                        step="any"
                        value={item.quantity}
                        onChange={(e) => {
                          const copy = [...selectedIngredients];
                          copy[idx].quantity = Number(e.target.value);
                          setSelectedIngredients(copy);
                        }}
                        placeholder="Cant."
                        className="w-20 p-1.5 text-xs rounded-lg border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                      />

                      <select
                        value={item.unit}
                        onChange={(e) => {
                          const copy = [...selectedIngredients];
                          copy[idx].unit = e.target.value;
                          setSelectedIngredients(copy);
                        }}
                        className="w-16 p-1.5 text-xs rounded-lg border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                      >
                        <option value="g">g</option>
                        <option value="kg">kg</option>
                        <option value="ml">ml</option>
                        <option value="L">L</option>
                        <option value="un">un</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedIngredients(selectedIngredients.filter((_, i) => i !== idx));
                        }}
                        className="text-stone-400 hover:text-rose-500 p-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs rounded-xl border border-stone-200 text-stone-600 dark:text-stone-400"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs rounded-xl bg-[#8C1F25] text-white font-bold"
                >
                  Guardar Receta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Administrador de Categorías */}
      <CategoryManagerModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        type="recipe"
        onCategoriesChanged={loadRecipes}
        addToast={addToast}
      />
    </div>
  );
};
