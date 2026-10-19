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
  MapPin,
  Store,
  Check,
  Plus,
} from 'lucide-react';
import type { Supplier, SupplyModality } from '../../../types';
import { formatPhoneForWhatsApp, getSupplyModality } from '../../../services/supplierService';

interface SupplierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplierData: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  supplierToEdit?: Supplier | null;
}

const ICONS_DESPACHO = ['🚚', '📦', '🥛', '🌾', '🍫', '🧈', '🍯', '☕'];
const ICONS_PRESENCIAL = ['🏬', '🏪', '🛒', '🍓', '🥑', '🥜', '🌾', '📦'];

const COMMON_CATEGORIES = [
  'Harinas y Polvos',
  'Lácteos y Huevos',
  'Chocolates y Coberturas',
  'Frutas y Frutos Secos',
  'Azúcares y Endulzantes',
  'Grasas y Margarinas',
  'Envases y Embalajes',
  'Esencias y Colorantes',
  'Café y Bebidas',
  'Artículos de Repostería',
  'Abarrotes y Varios',
];

const SCHEDULE_DESPACHO_SUGGESTIONS = [
  'Lunes y Jueves',
  'Martes y Viernes',
  'Miércoles',
  'A pedido (24 horas)',
  'Lunes a Viernes (Diario)',
];

const SCHEDULE_PRESENCIAL_SUGGESTIONS = [
  'Lun a Sáb 08:00 a 19:00',
  'Lun a Sáb 06:00 a 16:00',
  'Lun a Vie 08:30 a 18:00',
  'Todos los días 07:00 a 20:00',
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [approximatePrices, setApproximatePrices] = useState('');
  const [supplyModality, setSupplyModality] = useState<SupplyModality>('despacho');
  const [contactPerson, setContactPerson] = useState('');
  const [icon, setIcon] = useState('🚚');
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplierToEdit) {
      setName(supplierToEdit.name || '');
      setPhone(
        supplierToEdit.phone && supplierToEdit.phone !== 'Sin registrar'
          ? supplierToEdit.phone
          : ''
      );
      setDeliverySchedule(supplierToEdit.deliverySchedule || '');
      const parsedCats = supplierToEdit.category
        ? supplierToEdit.category
            .split(/[,;•\n]+/)
            .map((c) => c.trim())
            .filter(Boolean)
        : [];
      setSelectedCategories(parsedCats);
      setCustomCategoryInput('');
      setApproximatePrices(
        supplierToEdit.approximatePrices === 'A consultar en establecimiento'
          ? ''
          : supplierToEdit.approximatePrices || ''
      );
      setSupplyModality(supplierToEdit.supplyModality || getSupplyModality(supplierToEdit));
      setContactPerson(supplierToEdit.contactPerson || '');
      setIcon(supplierToEdit.icon || '🚚');
      setNotes(supplierToEdit.notes || '');
      setEmail(supplierToEdit.email || '');
      setAddress(supplierToEdit.address || '');
    } else {
      setName('');
      setPhone('');
      setDeliverySchedule('');
      setSelectedCategories([]);
      setCustomCategoryInput('');
      setApproximatePrices('');
      setSupplyModality('despacho');
      setContactPerson('');
      setIcon('🚚');
      setNotes('');
      setEmail('');
      setAddress('');
    }
    setError(null);
  }, [supplierToEdit, isOpen]);

  if (!isOpen) return null;

  const cleanPhonePreview = phone.trim() ? formatPhoneForWhatsApp(phone) : '';

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const handleAddCustomCategory = () => {
    const trimmed = customCategoryInput.trim();
    if (trimmed && !selectedCategories.includes(trimmed)) {
      setSelectedCategories((prev) => [...prev, trimmed]);
      setCustomCategoryInput('');
    }
  };

  const handleRemoveCategory = (catToRemove: string) => {
    setSelectedCategories((prev) => prev.filter((c) => c !== catToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Por favor indica el nombre del proveedor o empresa.');
      return;
    }

    const allCategories = [...selectedCategories];
    if (customCategoryInput.trim() && !allCategories.includes(customCategoryInput.trim())) {
      allCategories.push(customCategoryInput.trim());
    }

    if (allCategories.length === 0) {
      setError('Por favor selecciona o agrega al menos un tipo de insumo o rubro que provee.');
      return;
    }

    if (supplyModality === 'despacho' && !deliverySchedule.trim()) {
      setError('Por favor indica los días u horarios en que despacha el camión (ej: Martes y Jueves).');
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({
        name: name.trim(),
        phone: phone.trim() || 'Sin registrar',
        deliverySchedule:
          deliverySchedule.trim() ||
          (supplyModality === 'presencial'
            ? 'Retiro en local / Compra presencial'
            : 'A coordinar'),
        category: allCategories.join(', '),
        approximatePrices: approximatePrices.trim() || 'A consultar en establecimiento',
        contactPerson: contactPerson.trim() || undefined,
        supplyModality,
        address: address.trim() || undefined,
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

          {/* Modalidad de Abastecimiento */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1.5">
              Modalidad de Abastecimiento <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100/80 dark:bg-[#201612] rounded-xl border border-[#DFCAA9]/70 dark:border-[#35251F]">
              <button
                type="button"
                onClick={() => {
                  setSupplyModality('despacho');
                  if (!supplierToEdit) setIcon('🚚');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  supplyModality === 'despacho'
                    ? 'bg-white dark:bg-[#2A1D18] text-[#8C1F25] dark:text-[#E8BD8A] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>Despacho a Pastelería</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSupplyModality('presencial');
                  if (!supplierToEdit) setIcon('🏬');
                }}
                className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  supplyModality === 'presencial'
                    ? 'bg-white dark:bg-[#2A1D18] text-[#8C1F25] dark:text-[#E8BD8A] shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900'
                }`}
              >
                <Store className="w-3.5 h-3.5" />
                <span>Compra en Local / Mayorista</span>
              </button>
            </div>
          </div>

          {/* 1. Selector de Emoji representativo */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1.5">
              Icono de identidad
            </label>
            <div className="flex flex-wrap gap-1.5 p-2 bg-stone-100/70 dark:bg-[#201612] rounded-xl border border-[#EADBCE] dark:border-[#2C1D18]">
              {(supplyModality === 'presencial' ? ICONS_PRESENCIAL : ICONS_DESPACHO).map((emoji) => (
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
              {supplyModality === 'presencial' ? (
                <Store className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              ) : (
                <Truck className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              )}
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={
                  supplyModality === 'presencial'
                    ? "Ej: Central Mayorista, La Vega Central - Local 45, Distribuidora Alvi..."
                    : "Ej: Molino Central Harinas, Lácteos del Sur, Soprole..."
                }
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
              />
            </div>
          </div>

          {/* 3. Número de teléfono / WhatsApp (Opcional) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5]">
                Número de contacto / WhatsApp <span className="text-stone-400 font-normal">(Opcional)</span>
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
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: +56 9 8765 4321 (o dejar en blanco)"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40 font-mono"
              />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Si se ingresa, se habilitará la redirección inmediata a WhatsApp y llamadas telefónicas.
            </p>
          </div>

          {/* Dirección física / Ubicación (Opcional en ambas modalidades) */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
              Dirección o Ubicación del Establecimiento <span className="text-stone-400 font-normal">(Opcional)</span>
            </label>
            <div className="relative">
              <MapPin className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={
                  supplyModality === 'presencial'
                    ? "Ej: Av. La Paz 300, Recoleta (Vega Central, Galpón 2)"
                    : "Ej: Dirección de bodega o sucursal principal"
                }
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
              />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Permite a los encargados abrir la ruta directamente en Google Maps o Waze al ir a comprar.
            </p>
          </div>

          {/* 4. Proveedor de qué es (Insumos que abastece) - Selección Múltiple */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5]">
                Insumos que puede proveer (Selección múltiple) <span className="text-[#8C1F25]">*</span>
              </label>
              {selectedCategories.length > 0 && (
                <span className="text-[11px] font-semibold text-[#8C1F25] dark:text-[#E8BD8A]">
                  {selectedCategories.length} {selectedCategories.length === 1 ? 'insumo seleccionado' : 'insumos seleccionados'}
                </span>
              )}
            </div>

            {/* Insumos seleccionados actualmente */}
            {selectedCategories.length > 0 ? (
              <div className="flex flex-wrap gap-1.5 p-2.5 rounded-xl bg-amber-50/70 dark:bg-[#1F1512] border border-[#DFCAA9]/80 dark:border-[#35251F] mb-2.5">
                {selectedCategories.map((cat) => (
                  <span
                    key={cat}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8C1F25] text-white text-xs font-medium shadow-2xs animate-fade-in"
                  >
                    <span>{cat}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveCategory(cat)}
                      className="hover:bg-white/25 rounded-full p-0.5 cursor-pointer transition-colors"
                      title={`Quitar ${cat}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-stone-100/60 dark:bg-[#1E1410] border border-dashed border-[#DFCAA9]/90 dark:border-[#35251F] text-xs text-stone-500 dark:text-stone-400 mb-2.5 text-center">
                Haz clic en las categorías sugeridas abajo o escribe un insumo personalizado.
              </div>
            )}

            {/* Categorías sugeridas para seleccionar varias */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 block">
                Selecciona uno o más rubros sugeridos:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_CATEGORIES.map((cat) => {
                  const isSelected = selectedCategories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`text-xs px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                        isSelected
                          ? 'bg-[#8C1F25] text-white border-[#8C1F25] font-semibold shadow-xs'
                          : 'bg-white dark:bg-[#201612] text-stone-700 dark:text-stone-300 border-[#DFCAA9]/80 dark:border-[#35251F] hover:bg-[#F3E7D7] dark:hover:bg-[#2A1D18]'
                      }`}
                    >
                      <Tag className="w-3 h-3 opacity-70" />
                      <span>{cat}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 stroke-3" />
                      ) : (
                        <Plus className="w-3.5 h-3.5 opacity-50" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Entrada para agregar insumo o rubro personalizado */}
            <div className="flex items-center gap-2 mt-2.5">
              <div className="relative flex-1">
                <Tag className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={customCategoryInput}
                  onChange={(e) => setCustomCategoryInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddCustomCategory();
                    }
                  }}
                  placeholder="Escribe otro insumo o rubro específico (ej: Cajas acetato)..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-xs text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
                />
              </div>
              <button
                type="button"
                onClick={handleAddCustomCategory}
                disabled={!customCategoryInput.trim()}
                className="px-3.5 py-2 rounded-xl bg-stone-200 dark:bg-[#2A1D18] hover:bg-[#8C1F25] hover:text-white dark:hover:bg-[#8C1F25] text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors disabled:opacity-40 cursor-pointer"
              >
                + Agregar
              </button>
            </div>
          </div>

          {/* 5. Cuándo entrega o Horario de atención */}
          <div>
            <label className="block text-xs font-semibold text-[#4A3B32] dark:text-[#C4B2A5] mb-1">
              {supplyModality === 'presencial' ? (
                <>Horario de Atención del Local <span className="text-stone-400 font-normal">(Opcional)</span></>
              ) : (
                <>Cuándo entrega (Días y horarios de despacho) <span className="text-[#8C1F25]">*</span></>
              )}
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={deliverySchedule}
                onChange={(e) => setDeliverySchedule(e.target.value)}
                placeholder={
                  supplyModality === 'presencial'
                    ? "Ej: Lun a Sáb 07:00 a 16:00 (Continuado)..."
                    : "Ej: Martes y Jueves (08:00 - 13:00) o A pedido 24 hrs..."
                }
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {(supplyModality === 'presencial' ? SCHEDULE_PRESENCIAL_SUGGESTIONS : SCHEDULE_DESPACHO_SUGGESTIONS).map((sch) => (
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
                Precios aproximados / Referenciales <span className="text-stone-400 font-normal">(Opcional)</span>
              </label>
              <span className="text-[10px] text-stone-400">Valores de compra referenciales</span>
            </div>
            <div className="relative">
              <DollarSign className="w-4 h-4 text-stone-400 absolute left-3.5 top-3" />
              <textarea
                rows={2}
                value={approximatePrices}
                onChange={(e) => setApproximatePrices(e.target.value)}
                placeholder="Ej: Harina repostera $850/kg • Harina con polvos $920/kg... (o dejar en blanco)"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-sm text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40 resize-none"
              />
            </div>
            <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-1">
              Permite a los pasteleros y administradores conocer de un vistazo las tarifas acordadas o estimadas.
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
