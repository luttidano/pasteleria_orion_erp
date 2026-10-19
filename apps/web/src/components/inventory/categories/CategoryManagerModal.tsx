import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryType, ToastMessage } from '../../../types';
import { categoryService } from '../../../services/categoryService';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: CategoryType;
  onCategoriesChanged?: () => void;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const INGREDIENT_ICONS = ['🌾', '🧈', '🥛', '🥚', '🍫', '🍬', '🍯', '🍓', '🫒', '🧂', '🍋', '✨'];
const RECIPE_ICONS = ['🎂', '🥐', '🥧', '🍪', '🍰', '🍮', '🍩', '🥖', '🧁', '🧇', '🥞', '✨'];

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  type,
  onCategoriesChanged,
  addToast,
}) => {
  const isIngredient = type === 'ingredient';
  const availableIcons = isIngredient ? INGREDIENT_ICONS : RECIPE_ICONS;
  const defaultIcon = isIngredient ? '🌾' : '🎂';

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);

  // Formulario nueva categoría
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(defaultIcon);
  const [description, setDescription] = useState('');

  const loadCategories = async () => {
    try {
      setLoading(true);
      const data = await categoryService.getAll(type);
      setCategories(data);
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error', message: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCategories();
      setIcon(defaultIcon);
    }
  }, [isOpen, type]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await categoryService.create({
        name: name.trim(),
        type,
        icon,
        description: description.trim() || undefined,
      });
      addToast({ type: 'success', title: 'Categoría creada' });
      setName('');
      setDescription('');
      loadCategories();
      onCategoriesChanged?.();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error al crear', message: err.message });
    }
  };

  const handleDelete = async (id: string, catName: string) => {
    if (!confirm(`¿Eliminar la categoría "${catName}"?`)) return;
    try {
      await categoryService.delete(id);
      addToast({ type: 'success', title: 'Categoría eliminada' });
      loadCategories();
      onCategoriesChanged?.();
    } catch (err: any) {
      addToast({ type: 'error', title: 'Error al eliminar', message: err.message });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div className="bg-white dark:bg-[#16100E] rounded-3xl max-w-lg w-full p-6 border border-stone-200 dark:border-[#35251F] shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1D18] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-[#201612] border border-amber-200/80 dark:border-[#35251F] flex items-center justify-center text-xl">
              {defaultIcon}
            </div>
            <div>
              <h3 className="text-base font-bold text-[#2A1B16] dark:text-[#FDF5EE]">
                {isIngredient ? 'Categorías de Insumos' : 'Categorías de Recetas'}
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                {isIngredient
                  ? 'Gestiona las clasificaciones de tu despensa'
                  : 'Gestiona las familias de tus fórmulas'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-[#201612] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario para agregar nueva */}
        <form onSubmit={handleCreate} className="space-y-3 p-3.5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
          <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider block">
            {isIngredient ? 'Nueva categoría de insumo' : 'Nueva categoría de receta'}
          </span>
          <div className="flex gap-2">
            {/* Selector de icono */}
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="p-2 text-base rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
            >
              {availableIcons.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              placeholder={isIngredient ? 'Ej. Frutos Secos...' : 'Ej. Tortas Especiales...'}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="flex-1 p-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E] text-stone-800 dark:text-stone-200"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-[#8C1F25] hover:bg-[#74191E] text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
        </form>

        {/* Lista de categorías existentes */}
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-4 text-xs text-stone-400">Cargando categorías...</div>
          ) : categories.length === 0 ? (
            <div className="text-center py-6 text-xs text-stone-400">
              No hay categorías de {isIngredient ? 'insumos' : 'recetas'} registradas.
            </div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">{cat.icon || defaultIcon}</span>
                  <div>
                    <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                      {cat.name}
                    </span>
                    {cat.description && (
                      <span className="text-[10px] text-stone-400 block line-clamp-1">
                        {cat.description}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(cat.id, cat.name)}
                  className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-100 dark:hover:bg-[#2C1D18] cursor-pointer"
                  title="Eliminar"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-stone-200 dark:bg-[#2C1D18] text-stone-700 dark:text-stone-300 hover:bg-stone-300 cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
