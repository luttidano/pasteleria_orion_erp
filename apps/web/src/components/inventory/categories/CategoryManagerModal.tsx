import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Category, CategoryType, ToastMessage } from '../../../types';
import { categoryService } from '../../../services/categoryService';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import { Modal } from '../../common/Modal';

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

  // Estado para confirmar eliminación con ConfirmDeleteModal
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await categoryService.getAll(type);
      setCategories(data);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudieron cargar las categorías.',
      });
    } finally {
      setLoading(false);
    }
  }, [type, addToast]);

  useEffect(() => {
    if (isOpen) {
      void loadCategories();
      setIcon(defaultIcon);
    }
  }, [isOpen, loadCategories, defaultIcon]);

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
      await loadCategories();
      onCategoriesChanged?.();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al crear',
        message: err instanceof Error ? err.message : 'No se pudo crear la categoría.',
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await categoryService.delete(categoryToDelete.id);
      addToast({ type: 'success', title: 'Categoría eliminada' });
      setCategoryToDelete(null);
      await loadCategories();
      onCategoriesChanged?.();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al eliminar',
        message: err instanceof Error ? err.message : 'No se pudo eliminar la categoría.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        closeDisabled={isDeleting}
        title={isIngredient ? 'Categorías de Insumos' : 'Categorías de Recetas'}
        subtitle={
          isIngredient
            ? 'Gestiona las clasificaciones de tu despensa'
            : 'Gestiona las familias de tus fórmulas'
        }
        icon={<span className="text-xl">{defaultIcon}</span>}
        iconWrapperClassName="bg-amber-50 dark:bg-[#201612] border border-amber-200/80 dark:border-[#35251F]"
        maxWidthClassName="max-w-lg"
        footer={
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold rounded-xl bg-stone-200 dark:bg-[#2C1D18] text-stone-700 dark:text-stone-300 hover:bg-stone-300 cursor-pointer"
          >
            Cerrar
          </button>
        }
      >
            {/* Formulario para agregar nueva */}
            <form
              onSubmit={handleCreate}
              className="space-y-3 p-3.5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]"
            >
              <span className="text-[11px] font-bold text-stone-600 dark:text-stone-400 uppercase tracking-wider block">
                {isIngredient ? 'Nueva categoría de insumo' : 'Nueva categoría de receta'}
              </span>
              <div className="flex gap-2">
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
                      onClick={() => setCategoryToDelete(cat)}
                      className="p-1.5 text-stone-400 hover:text-rose-500 rounded-lg hover:bg-stone-100 dark:hover:bg-[#2C1D18] cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
      </Modal>

      <ConfirmDeleteModal
        isOpen={Boolean(categoryToDelete)}
        title="¿Eliminar categoría?"
        description={
          categoryToDelete ? (
            <>
              Estás a punto de eliminar la categoría{' '}
              <strong className="text-[#1C120D] dark:text-[#FBF4EB]">
                "{categoryToDelete.name}"
              </strong>
              .
            </>
          ) : null
        }
        confirmLabel="Sí, eliminar"
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setCategoryToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
};
