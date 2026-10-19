import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Sparkles, BookOpen, Truck } from 'lucide-react';
import type { CatalogProduct, ProductKind, Recipe, Supplier } from '../../../types';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: Partial<CatalogProduct>) => Promise<void>;
  productToEdit?: CatalogProduct | null;
  recipes: Recipe[];
  suppliers: Supplier[];
}

const COMMON_UNITS = ['un', 'porción', 'torta', 'docena', 'bandeja', 'botella', 'lata', 'paquete', 'caja'];
const SUGGESTED_ICONS = ['🧁', '🎂', '🍰', '🥧', '🥐', '🥖', '🍩', '🍪', '🥤', '🧃', '☕', '🥛', '🍫', '🍬', '📦'];

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
  productToEdit,
  recipes,
  suppliers,
}) => {
  const [name, setName] = useState('');
  const [productType, setProductType] = useState<ProductKind>('manufactured');
  const [recipeId, setRecipeId] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [stock, setStock] = useState<number | ''>(0);
  const [minStock, setMinStock] = useState<number | ''>(5);
  const [unit, setUnit] = useState('un');
  const [salePrice, setSalePrice] = useState<number | ''>(2500);
  const [costPrice, setCostPrice] = useState<number | ''>(1000);
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🧁');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setProductType(productToEdit.productType);
      setRecipeId(productToEdit.recipeId || '');
      setSupplierId(productToEdit.supplierId || '');
      setStock(productToEdit.stock);
      setMinStock(productToEdit.minStock);
      setUnit(productToEdit.unit || 'un');
      setSalePrice(productToEdit.salePrice);
      setCostPrice(productToEdit.costPrice || 0);
      setDescription(productToEdit.description || '');
      setIcon(productToEdit.icon || (productToEdit.productType === 'manufactured' ? '🧁' : '🥤'));
    } else {
      setName('');
      setProductType('manufactured');
      setRecipeId(recipes.length > 0 ? recipes[0].id : '');
      setSupplierId(suppliers.length > 0 ? suppliers[0].id : '');
      setStock(0);
      setMinStock(5);
      setUnit('un');
      setSalePrice(2500);
      setCostPrice(1000);
      setDescription('');
      setIcon('🧁');
    }
    setError(null);
  }, [productToEdit, isOpen, recipes, suppliers]);

  // Si cambia el tipo en modo creación, sugerir ícono y ajustar selectores por defecto
  const handleTypeChange = (newType: ProductKind) => {
    setProductType(newType);
    if (!productToEdit) {
      if (newType === 'manufactured') {
        setIcon('🧁');
        if (!recipeId && recipes.length > 0) setRecipeId(recipes[0].id);
      } else {
        setIcon('🥤');
        if (!supplierId && suppliers.length > 0) setSupplierId(suppliers[0].id);
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Por favor indica el nombre del producto comercial.');
      return;
    }
    if (stock === '' || Number(stock) < 0) {
      setError('Indica la cantidad disponible en stock.');
      return;
    }
    if (salePrice === '' || Number(salePrice) < 0) {
      setError('Indica un precio de venta válido.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        productType,
        recipeId: productType === 'manufactured' ? recipeId || undefined : undefined,
        supplierId: productType === 'resale' ? supplierId || undefined : undefined,
        stock: Number(stock),
        minStock: Number(minStock) || 0,
        unit,
        salePrice: Number(salePrice),
        costPrice: costPrice !== '' ? Number(costPrice) : 0,
        description: description.trim() || undefined,
        icon,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al guardar el producto.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-[26px] max-w-lg w-full shadow-2xl border border-[#DFCAA9] dark:border-[#35251F] overflow-hidden animate-modal-pop">
        {/* Header */}
        <div className="relative px-6 py-5 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7] dark:bg-[#1F1512]">
          <div className="flex flex-col items-center text-center">
            <span className="text-3xl select-none p-1.5 bg-white/70 dark:bg-white/5 rounded-xl border border-[#DFCAA9]/60 dark:border-white/10 shadow-xs mb-1.5">
              {icon}
            </span>
            <h3 className="text-lg font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif text-center">
              {productToEdit ? 'Modificar Producto' : 'Nuevo Producto para la Venta'}
            </h3>
            <p className="text-xs text-[#6B584C] dark:text-[#B39F93] mt-0.5 text-center">
              {productType === 'manufactured'
                ? 'Elaboración propia de la pastelería'
                : 'Producto adquirido listo para reventa'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 text-xs">
              {error}
            </div>
          )}

          {/* Selector de Tipo de Producto (Segmented Control) */}
          <div>
            <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1.5">
              Tipo de Producto *
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-stone-200/70 dark:bg-[#251A15] rounded-xl border border-[#DFCAA9]/50 dark:border-[#35251F]">
              <button
                type="button"
                onClick={() => handleTypeChange('manufactured')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  productType === 'manufactured'
                    ? 'bg-white dark:bg-[#1A120E] text-[#8C1F25] dark:text-[#E8BD8A] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Elaboración Propia</span>
              </button>
              <button
                type="button"
                onClick={() => handleTypeChange('resale')}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  productType === 'resale'
                    ? 'bg-white dark:bg-[#1A120E] text-[#8C1F25] dark:text-[#E8BD8A] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Reventa / Terceros</span>
              </button>
            </div>
          </div>

          {/* Nombre e Ícono */}
          <div>
            <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1.5">
              Nombre comercial del producto *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Torta Selva Negra, Bebida Coca-Cola 350ml..."
              className="w-full px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              autoFocus
            />
          </div>

          {/* Íconos sugeridos */}
          <div>
            <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1.5">
              Símbolo o ícono visual
            </label>
            <div className="flex items-center gap-1.5 flex-wrap">
              {SUGGESTED_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-8 h-8 text-base rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                    icon === emoji
                      ? 'bg-[#8C1F25] text-white ring-2 ring-[#8C1F25]/30 scale-105'
                      : 'bg-white dark:bg-[#221713] border border-[#DFCAA9]/70 dark:border-[#35251F] hover:bg-[#F3E7D7] dark:hover:bg-[#2B1D18]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Campo Condicional: Receta vs Proveedor */}
          {productType === 'manufactured' ? (
            <div>
              <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1.5 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-[#8C1F25]" />
                <span>Receta de elaboración asociada (Opcional)</span>
              </label>
              <select
                value={recipeId}
                onChange={(e) => setRecipeId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              >
                <option value="">-- Sin vincular a receta --</option>
                {recipes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} (Rinde {r.yieldServings} porciones)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1.5 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-600" />
                <span>Proveedor distribuidor (Opcional)</span>
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              >
                <option value="">-- Sin proveedor asignado --</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.category})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Existencias y Stock Mínimo */}
          <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#F7EFE4] dark:bg-[#211612] border border-[#E4CEB1] dark:border-[#3D2C24]">
            <div>
              <label className="block text-[11px] font-bold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                Stock actual *
              </label>
              <input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-sm font-bold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                Aviso mínimo
              </label>
              <input
                type="number"
                min="0"
                value={minStock}
                onChange={(e) => setMinStock(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-sm font-bold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#4A382C] dark:text-[#D5C2B4] mb-1">
                Unidad
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#19100D] text-xs font-bold text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Precios (Venta y Costo) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1">
                Precio de Venta ($ CLP) *
              </label>
              <input
                type="number"
                min="0"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1">
                Costo Estimado ($ CLP)
              </label>
              <input
                type="number"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3.5 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-sm text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
            </div>
          </div>

          {/* Notas */}
          <div>
            <label className="block text-xs font-bold text-[#2A1B16] dark:text-[#F5ECE5] mb-1">
              Descripción o notas de venta
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Mantener en vitrina refrigerada..."
              className="w-full px-3.5 py-2 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] bg-white dark:bg-[#1E1512] text-xs text-[#1C120D] dark:text-[#FBF4EB] focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
            />
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E8D7BE] dark:border-[#2C1D18]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-xs font-semibold text-[#4A3B32] dark:text-[#D5C2B4] hover:bg-[#F3E7D7] dark:hover:bg-[#251A15] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white text-xs font-semibold shadow-btn transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting ? (
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              <span>{productToEdit ? 'Guardar Cambios' : 'Guardar Producto'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
