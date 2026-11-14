import React, { useMemo } from 'react';
import {
  ArrowLeft,
  Calendar,
  Check,
  Copy,
  DollarSign,
  Edit2,
  ExternalLink,
  FileText,
  MapPin,
  MessageSquare,
  Phone,
  Send,
  Store,
  Tag,
  Trash2,
  Truck,
  User,
} from 'lucide-react';
import type { Supplier } from '../../../types';
import {
  getGoogleMapsUrl,
  getSupplyModality,
  isPhoneRegistered,
} from '../../../services/supplierService';

interface SupplierDetailCardProps {
  supplier: Supplier;
  customOrderNote: string;
  onCustomOrderNoteChange: (note: string) => void;
  copiedPhone: boolean;
  onCopyPhone: (phone: string) => void;
  onWhatsApp: (supplier: Supplier, customMsg?: string) => void;
  onCall: (supplier: Supplier) => void;
  onEdit: (supplier: Supplier) => void;
  onDelete: (supplier: Supplier) => void;
  isHiddenOnMobile: boolean;
  onBackToList: () => void;
}

export const SupplierDetailCard: React.FC<SupplierDetailCardProps> = ({
  supplier,
  customOrderNote,
  onCustomOrderNoteChange,
  copiedPhone,
  onCopyPhone,
  onWhatsApp,
  onCall,
  onEdit,
  onDelete,
  isHiddenOnMobile,
  onBackToList,
}) => {
  const isPresencial = getSupplyModality(supplier) === 'presencial';
  const hasPhone = isPhoneRegistered(supplier.phone);

  const categoryChips = useMemo(() => {
    if (!supplier.category) return [];
    return supplier.category
      .split(/[,;•\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }, [supplier.category]);

  const priceRows = useMemo(() => {
    if (!supplier.approximatePrices) return [];
    return supplier.approximatePrices
      .split(/[•;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [supplier.approximatePrices]);

  return (
    <div className={`lg:col-span-7 sticky top-4 ${isHiddenOnMobile ? 'hidden lg:block' : 'block'}`}>
      {/* Botón de retroceso solo en móvil */}
      <div className="lg:hidden mb-3">
        <button
          type="button"
          onClick={onBackToList}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[#8C1F25] dark:text-[#E25C64] bg-white dark:bg-[#1E1410] px-3 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la lista de contactos</span>
        </button>
      </div>

      <div className="bg-white dark:bg-[#16100E] rounded-3xl border border-stone-200/90 dark:border-[#35251F] shadow-sm overflow-hidden">
        {/* Cabecera elegante del contacto */}
        <div className="p-6 bg-linear-to-b from-[#FAF5ED] to-white dark:from-[#201612] dark:to-[#16100E] border-b border-stone-100 dark:border-[#2C1D18]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#2A1D18] border border-[#DFCAA9] dark:border-[#3D2C24] flex items-center justify-center text-3xl shadow-sm shrink-0">
                {supplier.icon || '🚚'}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif">
                    {supplier.name}
                  </h3>
                  {isPresencial ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-200/80 dark:border-blue-900/60">
                      <Store className="w-3 h-3" />
                      <span>Compra en Local / Mayorista</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200/80 dark:border-amber-900/60">
                      <Truck className="w-3 h-3" />
                      <span>Despacho a Pastelería</span>
                    </span>
                  )}
                </div>
                {supplier.contactPerson ? (
                  <p className="text-xs text-[#7A6658] dark:text-[#B4A093] mt-0.5 flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-stone-400" />
                    <span>
                      Contacto directo: <strong>{supplier.contactPerson}</strong>
                    </span>
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {supplier.supplierTypes?.includes('materia_prima') && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                        🌾 Materia Prima
                      </span>
                    )}
                    {supplier.supplierTypes?.includes('empaque') && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-800 dark:text-purple-200 border border-purple-300 dark:border-purple-800">
                        📦 Empaques & Despacho
                      </span>
                    )}
                    {supplier.supplierTypes?.includes('reventa') && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-800 dark:text-blue-200 border border-blue-300 dark:border-blue-800">
                        🛍️ Reventa
                      </span>
                    )}
                    {supplier.supplierTypes?.includes('insumo_general') && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-teal-500/10 text-teal-800 dark:text-teal-200 border border-teal-300 dark:border-teal-800">
                        🧤 Insumos Generales
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Acciones de edición y eliminación */}
            <div className="flex items-center gap-1.5 self-end sm:self-center">
              <button
                type="button"
                onClick={() => onEdit(supplier)}
                className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-[#35251F] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#251A15] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Modificar datos"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Editar</span>
              </button>
              <button
                type="button"
                onClick={() => onDelete(supplier)}
                className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                title="Eliminar del directorio"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Número de Teléfono, Dirección y Botón Copiar */}
          <div className="mt-4 pt-3 border-t border-stone-200/60 dark:border-[#2C1D18] flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-stone-400" />
                {hasPhone ? (
                  <span className="text-base font-mono font-bold text-stone-900 dark:text-stone-100 tracking-wide">
                    {supplier.phone}
                  </span>
                ) : (
                  <span className="text-xs text-stone-400 italic">Sin teléfono registrado</span>
                )}
              </div>
              {supplier.address && (
                <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                  <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span className="truncate max-w-[240px] sm:max-w-[320px]">{supplier.address}</span>
                </div>
              )}
            </div>
            {hasPhone && (
              <button
                type="button"
                onClick={() => onCopyPhone(supplier.phone)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 dark:bg-[#201612] hover:bg-stone-200 text-stone-700 dark:text-stone-300 text-xs font-medium transition-colors cursor-pointer"
              >
                {copiedPhone ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700 dark:text-emerald-400">¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copiar número</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* ACCIONES HERO DE REDIRECCIÓN DIRECTA */}
        <div className="p-6 border-b border-stone-100 dark:border-[#2C1D18] bg-stone-50/50 dark:bg-[#1C1310]/50 space-y-3">
          <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
            Acción Inmediata
          </span>

          {hasPhone ? (
            <>
              <div
                className={`grid grid-cols-1 ${
                  supplier.address ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
                } gap-3`}
              >
                <button
                  type="button"
                  onClick={() => onWhatsApp(supplier)}
                  className="group p-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <MessageSquare className="w-5 h-5 fill-white" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="text-xs font-bold block leading-tight truncate">
                        WhatsApp
                      </span>
                      <span className="text-[10px] text-emerald-100 block font-normal truncate">
                        Abrir chat directo
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => onCall(supplier)}
                  className="group p-3.5 rounded-2xl bg-[#8C1F25] hover:bg-[#72191E] active:scale-[0.98] text-white shadow-md shadow-[#8C1F25]/20 transition-all flex items-center justify-between cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5" />
                    </div>
                    <div className="text-left min-w-0">
                      <span className="text-xs font-bold block leading-tight truncate">
                        Llamar
                      </span>
                      <span className="text-[10px] text-rose-100 block font-normal truncate">
                        Llamada directa
                      </span>
                    </div>
                  </div>
                  <ExternalLink className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0" />
                </button>

                {supplier.address && (
                  <a
                    href={getGoogleMapsUrl(supplier.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-3.5 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white shadow-md shadow-amber-600/20 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="text-left min-w-0">
                        <span className="text-xs font-bold block leading-tight truncate">
                          Cómo llegar (GPS)
                        </span>
                        <span className="text-[10px] text-amber-100 block font-normal truncate">
                          Abrir Google Maps
                        </span>
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 transition-transform shrink-0" />
                  </a>
                )}
              </div>

              {/* Redactor de mensaje rápido para WhatsApp */}
              <div className="pt-2">
                <label className="text-[11px] text-stone-600 dark:text-stone-400 block mb-1 font-medium">
                  Mensaje de pedido pre-redactado (opcional):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customOrderNote}
                    onChange={(e) => onCustomOrderNoteChange(e.target.value)}
                    placeholder={
                      isPresencial
                        ? `Hola ${supplier.name}, quisiera consultar disponibilidad de ${
                            supplier.category.split(/[,•]/)[0]
                          } para ir a comprar hoy...`
                        : `Hola ${supplier.name}, quisiera consultar disponibilidad de ${
                            supplier.category.split(/[,•]/)[0]
                          } para el próximo despacho...`
                    }
                    className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => onWhatsApp(supplier, customOrderNote)}
                    className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Enviar</span>
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
              <div className="flex items-center gap-2.5 text-xs text-stone-500 dark:text-stone-400">
                <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                <span>
                  Sin número de contacto registrado. Puedes editar este proveedor para agregarlo.
                </span>
              </div>
              {supplier.address && (
                <a
                  href={getGoogleMapsUrl(supplier.address)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Cómo llegar (GPS)</span>
                  <ExternalLink className="w-3 h-3 opacity-80" />
                </a>
              )}
            </div>
          )}
        </div>

        {/* DETALLE ESTRUCTURADO */}
        <div className="p-6 space-y-5">
          {/* 1. Insumos que abastece */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
              <Tag className="w-4 h-4 text-[#8C1F25] dark:text-[#E25C64]" />
              <span>Categorías / Insumos que Abastece</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {categoryChips.map((chip, idx) => (
                <span
                  key={idx}
                  className="px-3 py-1.5 rounded-xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] text-xs font-medium text-[#2A1B16] dark:text-[#FDF5EE]"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* 2. Modalidad de Abastecimiento */}
          <div className="pt-4 border-t border-stone-100 dark:border-[#2C1D18]">
            {isPresencial ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Ubicación y Horario de Atención (Compra Presencial)</span>
                </div>

                {supplier.address ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                        <MapPin className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <span className="font-semibold text-xs text-amber-950 dark:text-amber-200 block truncate">
                          {supplier.address}
                        </span>
                        <span className="text-[11px] text-amber-800/80 dark:text-amber-400 block mt-0.5">
                          Ubicación física para compra directa en establecimiento
                        </span>
                      </div>
                    </div>
                    <a
                      href={getGoogleMapsUrl(supplier.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition-all shrink-0 cursor-pointer"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                      <span>Cómo llegar (GPS)</span>
                      <ExternalLink className="w-3 h-3 opacity-80" />
                    </a>
                  </div>
                ) : (
                  <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#1E1410] border border-stone-200/80 dark:border-[#35251F] text-xs text-stone-500">
                    Sin dirección registrada. Edita el proveedor para agregar la ubicación física.
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-blue-950 dark:text-blue-200 block">
                      {supplier.deliverySchedule || 'Horario comercial habitual'}
                    </span>
                    <span className="text-[11px] text-blue-800/80 dark:text-blue-400 block mt-0.5">
                      Horario de atención en local / mayorista
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                  <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span>Cuándo entrega (Días y Horarios de Despacho)</span>
                </div>
                <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="font-semibold text-xs text-blue-950 dark:text-blue-200 block">
                      {supplier.deliverySchedule}
                    </span>
                    <span className="text-[11px] text-blue-800/80 dark:text-blue-400 block mt-0.5">
                      Frecuencia confirmada para pedidos de pastelería
                    </span>
                  </div>
                </div>

                {supplier.address && (
                  <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#1E1410] border border-stone-200/80 dark:border-[#35251F] flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                      <span className="text-stone-700 dark:text-stone-300 truncate">
                        {supplier.address}
                      </span>
                    </div>
                    <a
                      href={getGoogleMapsUrl(supplier.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 shrink-0"
                    >
                      <span>Ver mapa</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Precios aproximados */}
          <div className="pt-4 border-t border-stone-100 dark:border-[#2C1D18]">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Precios y Tarifas Aproximadas</span>
              </div>
              <span className="text-[10px] text-stone-400">Valores referenciales</span>
            </div>

            <div className="space-y-1.5">
              {priceRows.map((priceItem, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-xl bg-stone-50 dark:bg-[#1E1410] border border-stone-200/80 dark:border-[#35251F] text-xs font-mono text-stone-800 dark:text-stone-200 flex items-center gap-2"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>{priceItem}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Notas o condiciones de compra */}
          {supplier.notes && (
            <div className="pt-4 border-t border-stone-100 dark:border-[#2C1D18]">
              <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                <FileText className="w-4 h-4 text-stone-400" />
                <span>Condiciones de compra & Notas</span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-[#1E1410] p-3 rounded-xl border border-stone-100 dark:border-[#2C1D18] italic">
                "{supplier.notes}"
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

