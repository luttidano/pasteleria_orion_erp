import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { GeneralSupply, Supplier } from '../../../types';
import { supplierService } from '../../../services/supplierService';
import type { SaveGeneralSupplyPayload } from '../../../services/generalSupplyService';

interface GeneralSupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: SaveGeneralSupplyPayload) => Promise<void>;
  itemToEdit?: GeneralSupply | null;
}

const CATEGORIES = [
  'Protección (EPP)',
  'Higiene y Aseo',
  'Utensilios y Menaje',
  'Papel y Descartables',
  'Mantenimiento',
  'Otros',
];

const COMMON_UNITS = ['caja', 'un', 'paquete', 'rollo', 'par', 'botella', 'bidón', 'L'];
const ICONS = ['🧤', '🧴', '🧽', '🧻', '🧹', '🧼', '🩺', '🔧', '✂️', '🗑️'];

export const GeneralSupplyModal: React.FC<GeneralSupplyModalProps> = ({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(2);
  const [unit, setUnit] = useState('caja');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplierId, setSupplierId] = useState<string>('');
  const [icon, setIcon] = useState('🧤');
  const [description, setDescription] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      supplierService
        .getAll()
        .then((data: Supplier[]) => {
          setSuppliers(data);
        })
        .catch(() => {
          setSuppliers([]);
        });

      if (itemToEdit) {
        setName(itemToEdit.name);
        setCategory(itemToEdit.category || CATEGORIES[0]);
        setStock(itemToEdit.stock);
        setMinStock(itemToEdit.minStock);
        setUnit(itemToEdit.unit || 'un');
        setCostPrice(itemToEdit.costPrice ?? 0);
        setSupplierId(itemToEdit.supplierId || '');
        setIcon(itemToEdit.icon || '🧤');
        setDescription(itemToEdit.description || '');
      } else {
        setName('');
        setCategory(CATEGORIES[0]);
        setStock(0);
        setMinStock(2);
        setUnit('caja');
        setCostPrice(0);
        setSupplierId('');
        setIcon('🧤');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, itemToEdit]);

  const { generalSupplySuppliers, otherSuppliers } = useMemo(() => {
    const preferred: Supplier[] = [];
    const others: Supplier[] = [];
    for (const s of suppliers) {
      if (s.supplierTypes?.includes('insumo_general')) {
        preferred.push(s);
      } else {
        others.push(s);
      }
    }
    return { generalSupplySuppliers: preferred, otherSuppliers: others };
  }, [suppliers]);

  if (!isOpen) return null;

  const categoryOptions = CATEGORIES.includes(category)
    ? CATEGORIES
    : [category, ...CATEGORIES];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del insumo general es obligatorio.');
      return;
    }
    if (Number.isNaN(Number(stock)) || Number(stock) < 0) {
      setError('El stock actual debe ser igual o mayor a 0.');
      return;
    }
    if (Number.isNaN(Number(minStock)) || Number(minStock) < 0) {
      setError('El stock mínimo debe ser igual o mayor a 0.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: name.trim(),
        category: category.trim() || CATEGORIES[0],
        stock: Number(stock),
        minStock: Number(minStock),
        unit: unit.trim() || 'un',
        costPrice: Number(costPrice) || 0,
        supplierId: supplierId || null,
        icon,
        description: description.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error al guardar el insumo general.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1E1512] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#EADBCE] dark:border-[#2C1D18] shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {itemToEdit ? 'Editar Insumo General' : 'Nuevo Insumo General'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Nombre del Insumo <span className="text-[#8C1F25]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Guantes de nitrilo talla M, Cofias desechables, Desengrasante..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Categoría <span className="text-[#8C1F25]">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Unidad
              </label>
              <input
                type="text"
                list="general-supply-units"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="caja, un, paquete, rollo"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
              />
              <datalist id="general-supply-units">
                {COMMON_UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Stock Actual <span className="text-[#8C1F25]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Stock Mínimo <span className="text-[#8C1F25]">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
                Costo Ref. ($)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={costPrice}
                onChange={(e) => setCostPrice(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm font-mono"
              />
            </div>
          </div>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 -mt-2">
            Si el stock actual iguala o baja del stock mínimo, aparecerá automáticamente en{' '}
            <strong>Lista de Compras</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Proveedor (Opcional)
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
            >
              <option value="">-- Sin proveedor asignado --</option>
              {generalSupplySuppliers.length > 0 && (
                <optgroup label="🧤 Proveedores de Insumos Generales">
                  {generalSupplySuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name} ({s.category})
                    </option>
                  ))}
                </optgroup>
              )}
              {otherSuppliers.length > 0 && (
                <optgroup
                  label={
                    generalSupplySuppliers.length > 0
                      ? 'Otros Proveedores'
                      : 'Proveedores registrados'
                  }
                >
                  {otherSuppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon} {s.name} ({s.category})
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
            {suppliers.length === 0 && (
              <p className="text-[10px] text-stone-400 mt-1">
                Aún no hay proveedores registrados. Puedes guardar este insumo sin proveedor y asignarlo después.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Icono
            </label>
            <div className="flex flex-wrap gap-2">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center cursor-pointer ${
                    icon === i
                      ? 'bg-[#8C1F25] text-white shadow-xs'
                      : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Descripción / Notas
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej: Caja de 100 unidades sin polvo, uso en área de decoración..."
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-stone-200 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#8C1F25] text-white text-sm font-bold shadow-md hover:bg-[#73191E] transition-all cursor-pointer disabled:opacity-50"
            >
              {isSubmitting
                ? 'Guardando...'
                : itemToEdit
                  ? 'Guardar Cambios'
                  : 'Crear Insumo'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
};

