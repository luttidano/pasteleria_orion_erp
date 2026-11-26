import React, { useState, useEffect } from 'react';
import { BookOpen, Plus } from 'lucide-react';
import type { Category, Ingredient, Recipe } from '../../../types';
import { Modal } from '../../common/Modal';

export interface RecipeFormData {
  name: string;
  description: string;
  yieldServings: number;
  category: string;
  ingredients: Array<{ ingredientId: string; quantity: number; unit: string }>;
}

interface RecipeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: RecipeFormData) => Promise<void>;
  ingredients: Ingredient[];
  categories: Category[];
  editingRecipe?: Recipe | null;
}

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ingredients,
  categories,
  editingRecipe = null,
}) => {
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formServings, setFormServings] = useState(1);
  const [formCategory, setFormCategory] = useState('Pastelería Fina');
  const [selectedIngredients, setSelectedIngredients] = useState<
    Array<{ ingredientId: string; quantity: number; unit: string }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = Boolean(editingRecipe);

  useEffect(() => {
    if (!isOpen) return;

    const defaultCategory = categories[0]?.name || 'Pastelería Fina';
    if (editingRecipe) {
      setFormName(editingRecipe.name || '');
      setFormDescription(editingRecipe.description || '');
      setFormServings(Math.max(1, Math.round(Number(editingRecipe.yieldServings) || 1)));
      setFormCategory(editingRecipe.category || defaultCategory);
      setSelectedIngredients(
        (editingRecipe.ingredients || []).map((item) => ({
          ingredientId: item.ingredientId,
          quantity: Number(item.quantity),
          unit: item.unit || 'g',
        })),
      );
    } else {
      setFormName('');
      setFormDescription('');
      setFormServings(1);
      setFormCategory(defaultCategory);
      setSelectedIngredients([]);
    }
  }, [isOpen, editingRecipe, categories]);

  if (!isOpen) return null;

  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) return;
    const usedIds = new Set(selectedIngredients.map((item) => item.ingredientId));
    const nextIngredient =
      ingredients.find((ing) => !usedIds.has(ing.id)) ?? ingredients[0];
    setSelectedIngredients((prev) => [
      ...prev,
      { ingredientId: nextIngredient.id, quantity: 100, unit: 'g' },
    ]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || selectedIngredients.length === 0) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        name: formName.trim(),
        description: formDescription.trim(),
        yieldServings: Math.max(1, Math.round(Number(formServings) || 1)),
        category: formCategory,
        ingredients: selectedIngredients.map((item) => ({
          ingredientId: item.ingredientId,
          quantity: Number(item.quantity),
          unit: item.unit,
        })),
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasCustomCategory =
    Boolean(formCategory) && !categories.some((c) => c.name === formCategory);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={isSubmitting}
      title={isEditing ? 'Editar Receta' : 'Nueva Receta'}
      icon={<BookOpen className="w-5 h-5" />}
      maxWidthClassName="max-w-lg"
      containerClassName="bg-white dark:bg-[#16100E] rounded-2xl border border-stone-200 dark:border-[#35251F] shadow-xl"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs rounded-xl border border-stone-200 text-stone-600 dark:text-stone-400 cursor-pointer disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="recipe-form-modal"
            disabled={isSubmitting || !formName.trim() || selectedIngredients.length === 0}
            className="px-4 py-2 text-xs rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white font-bold cursor-pointer disabled:opacity-50"
          >
            {isSubmitting
              ? 'Guardando...'
              : isEditing
                ? 'Guardar Cambios'
                : 'Guardar Receta'}
          </button>
        </>
      }
    >
      <form id="recipe-form-modal" onSubmit={handleSubmit} className="space-y-3">
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
                  {hasCustomCategory && (
                    <option value={formCategory}>🏷️ {formCategory}</option>
                  )}
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
                step="1"
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
                className="text-xs text-[#8C1F25] dark:text-[#E07A5F] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
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
                      const value = e.target.value;
                      setSelectedIngredients((prev) =>
                        prev.map((row, rowIdx) =>
                          rowIdx === idx ? { ...row, ingredientId: value } : row,
                        ),
                      );
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
                    min="0.001"
                    step="any"
                    value={item.quantity}
                    onChange={(e) => {
                      const value = Number(e.target.value);
                      setSelectedIngredients((prev) =>
                        prev.map((row, rowIdx) =>
                          rowIdx === idx ? { ...row, quantity: value } : row,
                        ),
                      );
                    }}
                    placeholder="Cant."
                    className="w-20 p-1.5 text-xs rounded-lg border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612]"
                  />

                  <select
                    value={item.unit}
                    onChange={(e) => {
                      const value = e.target.value;
                      setSelectedIngredients((prev) =>
                        prev.map((row, rowIdx) =>
                          rowIdx === idx ? { ...row, unit: value } : row,
                        ),
                      );
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
                      setSelectedIngredients((prev) => prev.filter((_, i) => i !== idx));
                    }}
                    className="text-stone-400 hover:text-rose-500 p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

        </form>
    </Modal>
  );
};
