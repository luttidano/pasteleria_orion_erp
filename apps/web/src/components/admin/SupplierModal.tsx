import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Truck,
  Phone,
  Calendar,
  DollarSign,
  Tag,
  User,
  Sparkles,
  MessageSquare,
  FileText,
} from 'lucide-react';
import type { Supplier } from '../../types';
import { formatPhoneForWhatsApp } from '../../services/supplierService';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  supplierToEdit?: Supplier | null;
}

const SUGGESTED_ICONS = ['🌾', '🧈', '🍫', '📦', '🍓', '🍬', '🥛', '🥚', '🚚', '🍯', '☕', '🧁'];

const COMMON_CATEGORIES = [
  'Harinas y Polvos leudantes',
  'Lácteos, Crema y Huevos',
  'Chocolates y Coberturas',
  'Envases, Cajas y Blondas',
  'Frutas frescas y Frutos secos',
  'Azúcares, Esencias y Colorantes',
  'Grasas, Aceites y Margarinas',
];

const SCHEDULE_SUGGESTIONS = [
  'Lunes y Jueves',
  'Martes y Viernes',
  'Miércoles',
  'A pedido (24 horas)',
  'A pedido (48 horas)',
  'Lunes a Viernes (Diario)',
];

export const SupplierModal: React.FC<SupplierModalProps> = ({
  isOpen,
  onClose,
  onSave,
  supplierToEdit,
}) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliverySchedule, setDeliverySchedule] = useState('');
  const [category, setCategory] = useState('');
  const [approximatePrices, setApproximatePrices] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [icon, setIcon] = useState('🚚');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name || '');
      setPhone(supplierToEdit.phone || '');
      setDeliverySchedule(supplierToEdit.deliverySchedule || '');
      setCategory(supplierToEdit.category || '');
      setApproximatePrices(supplierToEdit.approximatePrices || '');
      setContactPerson(supplierToEdit.contactPerson || '');
      setIcon(supplierToEdit.icon || '🚚');
      setNotes(supplierToEdit.notes || '');
      setEmail(supplierToEdit.email || '');
    } else {
      setName('');
      setPhone('');
      setDeliverySchedule('');
      setCategory('');
      setApproximatePrices('');
      setContactPerson('');
      setIcon('🚚');
      setNotes('');
      setEmail('');
    }
    setError(null);
  }, [supplierToEdit, isOpen]);

  if (!isOpen) return null;

  const cleanPhonePreview = formatPhoneForWhatsApp(phone);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Por favor indica el nombre del proveedor o empresa.');
      return;
    }

    if (!phone.trim()) {
      setError('Por favor ingresa un número de teléfono o WhatsApp para poder contactarlo.');
      return;
    }

    if (!deliverySchedule.trim()) {
      setError('Por favor indica cuándo entrega (días u horarios de despacho).');
      return;
    }

    if (!category.trim()) {
      setError('Por favor indica de qué es proveedor (insumos o rubro principal).');
      return;
    }

    if (!approximatePrices.trim()) {
      setError('Por favor agrega los precios aproximados o valores de referencia.');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim(),
        deliverySchedule: deliverySchedule.trim(),
        category: category.trim(),
        approximatePrices: approximatePrices.trim(),
        contactPerson: contactPerson.trim() || undefined,
        icon,
        notes: notes.trim() || undefined,
        email: email.trim() || undefined,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar el proveedor.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-[26px] max-w-xl w-full shadow-2xl border border-[#DFCAA9] dark:border-[#35251F] overflow-hidden animate-modal-pop my-6">
        {/* Encabezado */}
        <div className="relative px-6 py-5 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F3E7D7] dark:bg-[#1F1512]">
          <div className="flex flex-col items-center text-center">
            <span className="text-3xl select-none p-2 bg-white/70 dark:bg-white/5 rounded-2xl border border-[#DFCAA9]/60 dark:border-white/10 shadow-xs mb-1.5">
              {icon}
            </span>
            <h3 className="text-xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif text-center">
              {supplierToEdit ? 'Editar Proveedor' : 'Agregar Nuevo Proveedor'}
            </h3>
            <p className="text-xs text-[#6B584C] dark:text-[#B39F93] mt-0.5 text-center max-w-sm">
              Registra contacto, días de despacho y precios referenciales para enlaces directos de WhatsApp y llamadas.
            </p>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            title="Cerrar ventana"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <span className="font-bold">⚠️ Atención:</span> {error}
            </div>
          )}

          {/* 1. Selector de Emoji representativo */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1.5">
              Icono de identidad
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-stone-100/70 dark:bg-[#201612] rounded-xl border border-[#EADBCE] dark:border-[#2C1D18]">
              {SUGGESTED_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-9 h-9 text-lg rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    icon === emoji
                      ? 'bg-[#8C1F25] text-white shadow-xs scale-110'
                      : 'hover:bg-white dark:hover:bg-[#2A1D18]'
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Nombre del Proveedor / Empresa */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
              Nombre del proveedor / Empresa <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="relative">
              <Truck className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Molino Central Harinas, Lácteos del Sur..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
              />
            </div>
          </div>

          {/* 3. Número de teléfono / WhatsApp */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5]">
                Número de contacto / WhatsApp <span className="text-[#8C1F25]">*</span>
              </label>
              {cleanPhonePreview && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <MessageSquare className="w-3 h-3" /> WhatsApp listo: +{cleanPhonePreview}
                </span>
              )}
            </div>
            <div className="relative">
              <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: +56 9 8765 4321 o 987654321"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40 font-mono"
              />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Al seleccionarlo o presionar el botón se redirigirá directo a WhatsApp o llamada.
            </p>
          </div>

          {/* 4. Proveedor de qué es */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
              Proveedor de qué es (Insumos / Rubro) <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Ej: Harinas, Polvos leudantes, Mantequilla, Cajas de torta..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
              />
            </div>
            {/* Chips de sugerencias rápidas */}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-[#8C1F25] text-white border-[#8C1F25]'
                      : 'bg-white dark:bg-[#201612] text-stone-600 dark:text-stone-300 border-[#DFCAA9]/80 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-[#2A1D18]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* 5. Cuándo entrega */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
              Cuándo entrega (Días y horarios) <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                required
                value={deliverySchedule}
                onChange={(e) => setDeliverySchedule(e.target.value)}
                placeholder="Ej: Martes y Jueves (08:00 - 13:00) o A pedido 24 hrs..."
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {SCHEDULE_SUGGESTIONS.map((sch) => (
                <button
                  key={sch}
                  type="button"
                  onClick={() => setDeliverySchedule(sch)}
                  className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    deliverySchedule.includes(sch)
                      ? 'bg-amber-600 text-white border-amber-600'
                      : 'bg-white dark:bg-[#201612] text-stone-600 dark:text-stone-300 border-[#DFCAA9]/80 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-[#2A1D18]'
                  }`}
                >
                  {sch}
                </button>
              ))}
            </div>
          </div>

          {/* 6. Precios aproximados */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5]">
                Precios aproximados / Referenciales <span className="text-[#8C1F25]">*</span>
              </label>
              <span className="text-[10px] text-stone-400">Valores de compra referenciales</span>
            </div>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <textarea
                required
                rows={2}
                value={approximatePrices}
                onChange={(e) => setApproximatePrices(e.target.value)}
                placeholder="Ej: Harina repostera $850/kg • Harina con polvos $920/kg • Polvo leudante $2.800/kg"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40 resize-none"
              />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Permite a los pasteleros y administradores conocer de un vistazo las tarifas acordadas.
            </p>
          </div>

          {/* 7. Datos opcionales (Contacto, Notas) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
                Persona o vendedor de contacto
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="Ej: Don Carlos Mendoza"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-xs text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
                Condiciones o compra mínima
              </label>
              <div className="relative">
                <FileText className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Mínimo $40.000, factura a 30 días"
                  className="w-full pl-10 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-xs text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
                />
              </div>
            </div>
          </div>

          {/* Botones de acción */}
          <div className="pt-3 border-t border-[#E8D7BE] dark:border-[#2C1D18] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-[#4A3B32] dark:text-[#D5C2B4] font-semibold text-xs hover:bg-[#F3E7D7] dark:hover:bg-[#251A15] transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#72191E] active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-[#8C1F25]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isSubmitting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>{supplierToEdit ? 'Guardar Cambios' : 'Registrar Proveedor'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
