import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus } from 'lucide-react';
import type { Category, Ingredient } from '../../../types';

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
}

export const RecipeFormModal: React.FC<RecipeFormModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ingredients,
  categories,
}) => {
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formServings, setFormServings] = useState(1);
  const [formCategory, setFormCategory] = useState('Pastelería Fina');
  const [selectedIngredients, setSelectedIngredients] = useState<
    Array<{ ingredientId: string; quantity: number; unit: string }>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !formCategory) {
      setFormCategory(categories[0].name);
    }
  }, [categories, formCategory]);

  if (!isOpen) return null;

  const handleAddIngredientRow = () => {
    if (ingredients.length === 0) return;
    setSelectedIngredients((prev) => [
      ...prev,
      { ingredientId: ingredients[0].id, quantity: 100, unit: 'g' },
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
        name: formName,
        description: formDescription,
        yieldServings: Number(formServings),
        category: formCategory,
        ingredients: selectedIngredients,
      });
      // Limpiar formulario al guardar con éxito
      setFormName('');
      setFormDescription('');
      setFormServings(1);
      setSelectedIngredients([]);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#16100E] rounded-2xl max-w-lg w-full p-6 border border-stone-200 dark:border-[#35251F] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE]">Nueva Receta</h3>

        <form onSubmit={handleSubmit} className="space-y-3">
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
                    min="0.01"
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

          <div className="flex justify-end gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs rounded-xl border border-stone-200 text-stone-600 dark:text-stone-400 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white font-bold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Guardando...' : 'Guardar Receta'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};
