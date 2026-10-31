import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { Packaging, PackagingType, Supplier } from '../../../types';
import { supplierService } from '../../../services/supplierService';

interface PackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<Packaging>) => Promise<void>;
  itemToEdit?: Packaging | null;
}

const CATEGORIES = ['Cajas', 'Bolsas', 'Domos', 'Bases & Blondas', 'Vasos & Vasitos', 'Otros'];
const ICONS = ['📦', '🛍️', '🥪', '🍰', '🥤', '🏷️', '🎁', '🪣'];

export const PackagingModal: React.FC<PackagingModalProps> = ({
  isOpen,
  onClose,
  onSave,
  itemToEdit,
}) => {
  const [name, setName] = useState('');
  const [packageType, setPackageType] = useState<PackagingType>('primario');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [stock, setStock] = useState<number>(0);
  const [minStock, setMinStock] = useState<number>(10);
  const [unit, setUnit] = useState('un');
  const [costPrice, setCostPrice] = useState<number>(0);
  const [supplierId, setSupplierId] = useState<string>('');
  const [icon, setIcon] = useState('📦');
  const [description, setDescription] = useState('');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      supplierService.getAll()
        .then((data: Supplier[]) => {
          // Filtrar proveedores que tengan 'empaque' en su lista de rubros
          setSuppliers(data.filter((s: Supplier) => s.supplierTypes?.includes('empaque')));
        })
        .catch(console.error);

      if (itemToEdit) {
        setName(itemToEdit.name);
        setPackageType(itemToEdit.packageType);
        setCategory(itemToEdit.category);
        setStock(itemToEdit.stock);
        setMinStock(itemToEdit.minStock);
        setUnit(itemToEdit.unit || 'un');
        setCostPrice(itemToEdit.costPrice || 0);
        setSupplierId(itemToEdit.supplierId || '');
        setIcon(itemToEdit.icon || '📦');
        setDescription(itemToEdit.description || '');
      } else {
        setName('');
        setPackageType('primario');
        setCategory(CATEGORIES[0]);
        setStock(0);
        setMinStock(10);
        setUnit('un');
        setCostPrice(0);
        setSupplierId('');
        setIcon('📦');
        setDescription('');
      }
      setError(null);
    }
  }, [isOpen, itemToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('El nombre del empaque es obligatorio.');
      return;
    }
    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        packageType,
        category,
        stock: Number(stock),
        minStock: Number(minStock),
        unit: unit.trim() || 'un',
        costPrice: Number(costPrice) || 0,
        supplierId: supplierId || undefined,
        icon,
        description: description.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar el empaque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1E1512] rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-[#EADBCE] dark:border-[#2C1D18] shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{icon}</span>
            <h3 className="text-lg font-bold text-stone-900 dark:text-stone-100">
              {itemToEdit ? 'Editar Empaque' : 'Nuevo Empaque & Despacho'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs rounded-xl border border-rose-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Clasificación Funcional <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPackageType('primario')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  packageType === 'primario'
                    ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/30 text-indigo-900 dark:text-indigo-200 ring-1 ring-indigo-600'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-xs">🍰 Primario (Base / Contacto)</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Bases, blondas, domos individuales, moldes</div>
              </button>
              <button
                type="button"
                onClick={() => setPackageType('secundario')}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  packageType === 'secundario'
                    ? 'border-amber-600 bg-amber-50/70 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 ring-1 ring-amber-600'
                    : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50'
                }`}
              >
                <div className="font-bold text-xs">🛍️ Secundario (Despacho)</div>
                <div className="text-[10px] text-stone-500 mt-0.5">Bolsas kraft, cajas con asa, entrega</div>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Nombre del Empaque <span className="text-[#8C1F25]">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Base de cartón dorada 28cm o Bolsa Kraft Mediana"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Unidad</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="un, paquete, rollo"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Stock Actual</label>
              <input
                type="number"
                min="0"
                step="1"
                value={stock}
                onChange={(e) => setStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                step="1"
                value={minStock}
                onChange={(e) => setMinStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Costo Unitario ($)</label>
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

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">
              Proveedor de Empaque
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#150F0D] text-sm"
            >
              <option value="">-- Sin proveedor asignado --</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.icon} {s.name} ({s.category})
                </option>
              ))}
            </select>
            {suppliers.length === 0 && (
              <p className="text-[10px] text-stone-400 mt-1">
                No hay proveedores registrados con el rubro "Empaques". Puedes asignarle el rubro a un proveedor desde el Directorio.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Icono</label>
            <div className="flex gap-2">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center cursor-pointer ${
                    icon === i ? 'bg-[#8C1F25] text-white shadow-xs' : 'hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1">Descripción / Notas</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detalles sobre dimensiones, grosor, proveedor alternativo..."
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
              {isSubmitting ? 'Guardando...' : itemToEdit ? 'Guardar Cambios' : 'Crear Empaque'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
