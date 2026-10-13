import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles } from 'lucide-react';
import type { Ingredient, IngredientCategory } from '../../types';
import { categoryService } from '../../services/categoryService';

interface IngredientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (ingredientData: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt' | 'status'>) => Promise<void>;
  ingredientToEdit?: Ingredient | null;
}

const CATEGORIES: IngredientCategory[] = [
  'Harinas y Polvos',
  'Lácteos y Huevos',
  'Azúcares y Dulces',
  'Chocolates y Cacaos',
  'Frutas y Esencias',
  'Grasas y Aceites',
];

const COMMON_UNITS = [
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'Litros', label: 'Litros (L)' },
  { value: 'Bandejas', label: 'Bandejas' },
  { value: 'Unidades', label: 'Unidades (un)' },
  { value: 'Gramos', label: 'Gramos (g)' },
];

const SUGGESTED_ICONS = ['🌾', '🧈', '🥛', '🥚', '🍫', '🍬', '🍯', '🍓', '✨', '🍶', '🍥', '🌸'];

export const IngredientModal: React.FC<IngredientModalProps> = ({
  isOpen,
  onClose,
  onSave,
  ingredientToEdit,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<IngredientCategory>('Harinas y Polvos');
  const [icon, setIcon] = useState('🌾');
  const [stock, setStock] = useState<number | ''>(10);
  const [unit, setUnit] = useState('kg');
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [price, setPrice] = useState<number | ''>(1500);
  const [description, setDescription] = useState('');
  const [dynamicCategories, setDynamicCategories] = useState<string[]>(CATEGORIES);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      categoryService.getAll('ingredient').then((cats) => {
        if (cats.length > 0) {
          setDynamicCategories(cats.map((c) => c.name));
        }
      }).catch(() => {});
    }
  }, [isOpen]);

  useEffect(() => {
    if (ingredientToEdit) {
      setName(ingredientToEdit.name);
      setCategory(ingredientToEdit.category as IngredientCategory);
      setIcon(ingredientToEdit.icon || '🌾');
      setStock(ingredientToEdit.stock);
      setUnit(ingredientToEdit.unit || 'kg');
      setMinStock(ingredientToEdit.minStock);
      setPrice(ingredientToEdit.price || 0);
      setDescription(ingredientToEdit.description || '');
    } else {
      setName('');
      setCategory('Harinas y Polvos');
      setIcon('🌾');
      setStock(10);
      setUnit('kg');
      setMinStock(5);
      setPrice(1500);
      setDescription('');
    }
    setError(null);
  }, [ingredientToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor escribe el nombre del ingrediente (ej: Harina, Mantequilla).');
      return;
    }
    if (stock === '' || stock < 0) {
      setError('Indica la cantidad disponible que hay en despensa.');
      return;
    }
    if (minStock === '' || minStock < 0) {
      setError('Indica la cantidad mínima para avisarte cuando falte.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        category,
        icon,
        stock: Number(stock),
        unit,
        minStock: Number(minStock),
        price: price ? Number(price) : undefined,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Ocurrió un error al guardar el ingrediente.';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-[26px] max-w-lg w-full shadow-2xl border border-[#DFCAA9] dark:border-[#35251F] overflow-hidden animate-modal-pop">
        {/* Header con título centrado */}
        <div className="relative px-6 py-5 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7] dark:bg-[#1F1512]">
          <div className="flex flex-col items-center text-center">
            <span className="text-3xl select-none p-1.5 bg-white/70 dark:bg-white/5 rounded-xl border border-[#DFCAA9]/60 dark:border-white/10 shadow-xs mb-1.5">
              {icon}
            </span>
            <h3 className="text-lg font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif text-center">
              {ingredientToEdit ? 'Modificar Ingrediente' : 'Nuevo Ingrediente de Pastelería'}
            </h3>
            <p className="text-xs text-[#6B584C] dark:text-[#B39F93] mt-0.5 text-center">
              {ingredientToEdit
                ? 'Ajusta las cantidades o datos de este insumo'
                : 'Agrega un insumo o materia prima a la despensa'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs">
              {error}
            </div>
          )}

          {/* Nombre del Ingrediente */}
          <div>
            <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1.5">
              Nombre del ingrediente o insumo *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Harina de Trigo, Mantequilla, Leche entera..."
              className="w-full px-4 py-3 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-[#1C120D] dark:text-[#FBF4EB] placeholder-[#9E8E81] dark:placeholder-[#766358] text-sm focus:outline-none focus:ring-2 focus:ring-[#8C1F25] transition-all shadow-xs"
              autoFocus
            />
          </div>

          {/* Icono rápido y Categoría */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5]">
              Categoría y símbolo visual
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SUGGESTED_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 text-lg rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    icon === emoji
                      ? 'bg-[#8C1F25] text-white shadow-xs scale-105 ring-2 ring-[#8C1F25]/30'
                      : 'bg-white dark:bg-[#221713] border border-[#DFCAA9]/70 dark:border-[#35251F] hover:bg-[#F3E7D7] dark:hover:bg-[#2B1D18]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as IngredientCategory)}
              className="w-full mt-2 px-3.5 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm font-medium text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
            >
              {dynamicCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Cantidad disponible y Unidad de medida */}
          <div className="p-4 rounded-2xl bg-[#F7EFE4] dark:bg-[#211612] border border-[#E4CEB1] dark:border-[#3D2C24] space-y-3">
            <div className="text-xs font-bold text-[#4E290B] dark:text-[#E8BD8A] flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C87D25]" />
              <span>Existencias en Bodega / Despensa</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                  Cantidad actual *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={stock}
                  onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-base font-bold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                  Unidad de medida
                </label>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-sm font-semibold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                >
                  {COMMON_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                Avisarme cuando queden menos de:
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={minStock}
                  onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-28 px-3.5 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-sm font-bold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                />
                <span className="text-xs text-[#1C120D] dark:text-[#FBF4EB] font-bold">{unit}</span>
                <span className="text-[11px] text-[#786457] dark:text-[#9E8B7F] font-medium">(para comprar a tiempo)</span>
              </div>
            </div>
          </div>

          {/* Costo opcional y notas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                Costo de compra aprox ($ CLP)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-[#9E8E81] dark:text-[#766358] text-xs font-bold">$</span>
                <input
                  type="number"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm font-semibold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                Nota o recomendación
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ej: Mantener en frío"
                className="w-full px-3 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-[#9E8E81] dark:placeholder-[#766358] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E8D7BE] dark:border-[#2C1D18]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-[#4A3B32] dark:text-[#D5C2B4] font-semibold text-sm hover:bg-[#F3E7D7] dark:hover:bg-[#251A15] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white font-semibold text-sm shadow-btn transition-all duration-150 flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              <span>{ingredientToEdit ? 'Guardar Cambios' : 'Guardar Ingrediente'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};

