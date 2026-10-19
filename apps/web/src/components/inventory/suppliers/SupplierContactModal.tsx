import { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Phone,
  MessageSquare,
  Calendar,
  Tag,
  DollarSign,
  Copy,
  Check,
  ExternalLink,
  Info,
  MapPin,
  Store,
  Truck,
} from 'lucide-react';
import type { Supplier } from '../../../types';
import {
  getWhatsAppUrl,
  getCallUrl,
  getGoogleMapsUrl,
  getSupplyModality,
} from '../../../services/supplierService';

interface SupplierContactModalProps {
  isOpen: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onEdit?: (supplier: Supplier) => void;
}

export const SupplierContactModal: React.FC<SupplierContactModalProps> = ({
  isOpen,
  supplier,
  onClose,
  onEdit,
}) => {
  const [copied, setCopied] = useState(false);
  const [customNote] = useState('');

  if (!isOpen || !supplier) return null;

  const isPhoneRegistered = (phone?: string) => {
    if (!phone) return false;
    const clean = phone.trim();
    return clean !== '' && clean !== 'Sin registrar' && clean !== 'No registrado';
  };

  const hasPhone = isPhoneRegistered(supplier.phone);
  const isPresencial = getSupplyModality(supplier) === 'presencial';
  const callUrl = hasPhone ? getCallUrl(supplier.phone) : '#';

  const handleCopyPhone = () => {
    if (!hasPhone) return;
    navigator.clipboard.writeText(supplier.phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = (customMsg?: string) => {
    if (!hasPhone) return;
    const defaultMsg = isPresencial
      ? `Hola ${supplier.name}, te escribo desde Pastelería Orión. Quisiera cotizar / consultar disponibilidad de ${supplier.category.split(/[,•]/)[0] || 'materias primas'} para ir a comprar.`
      : `Hola ${supplier.name}, te escribo desde Pastelería Orión. Quisiera cotizar / consultar disponibilidad de materias primas para despacho.`;
    const message = customMsg || customNote || defaultMsg;
    const url = getWhatsAppUrl(supplier.phone, supplier.name, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleCall = () => {
    if (!hasPhone) return;
    window.location.href = callUrl;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-[26px] max-w-lg w-full shadow-2xl border border-[#DFCAA9] dark:border-[#35251F] overflow-hidden animate-modal-pop my-6">
        {/* Encabezado con identidad del proveedor */}
        <div className="relative px-6 py-6 border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-linear-to-b from-[#F7EFE4] to-[#F1E3D1] dark:from-[#211612] dark:to-[#1A110E]">
          <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 rounded-2xl bg-white dark:bg-[#2A1D18] border border-[#DFCAA9]/80 dark:border-[#3D2C24] flex items-center justify-center text-3xl shadow-sm mb-2.5">
              {supplier.icon || (isPresencial ? '🏬' : '🚚')}
            </div>
            <div className="flex items-center gap-2 flex-wrap justify-center mb-1">
              <h3 className="text-xl sm:text-2xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif">
                {supplier.name}
              </h3>
            </div>

            {/* Badge de Modalidad */}
            <div className="mb-2">
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

            {supplier.contactPerson && (
              <p className="text-xs text-[#7A6658] dark:text-[#B4A093] font-medium mt-0.5">
                Contacto: <span className="font-semibold text-[#1C120D] dark:text-[#FBF4EB]">{supplier.contactPerson}</span>
              </p>
            )}

            {hasPhone ? (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-white/80 dark:bg-white/5 border border-[#DFCAA9]/80 dark:border-white/10 text-xs font-mono font-semibold text-[#2A1B16] dark:text-[#FDF5EE]">
                <Phone className="w-3.5 h-3.5 text-stone-500" />
                <span>{supplier.phone}</span>
                <button
                  onClick={handleCopyPhone}
                  type="button"
                  className="ml-1 p-1 hover:text-[#8C1F25] dark:hover:text-[#E25C64] transition-colors cursor-pointer"
                  title="Copiar número"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ) : (
              <span className="text-xs text-stone-400 italic mt-1.5 block">
                Sin teléfono registrado
              </span>
            )}

            {supplier.address && (
              <div className="mt-2 text-xs text-stone-600 dark:text-stone-300 flex items-center gap-1 max-w-xs justify-center">
                <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{supplier.address}</span>
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            type="button"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido y Botones de Redirección Directa */}
        <div className="p-6 space-y-5">
          {/* BOTONES PRINCIPALES DE ACCIÓN DIRECTA */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2 text-center">
              Seleccionar acción de contacto rápido
            </label>
            {hasPhone ? (
              <div className={`grid grid-cols-1 ${supplier.address ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2.5`}>
                {/* Opción 1: Redirigir directo a WhatsApp */}
                <button
                  type="button"
                  onClick={() => handleOpenWhatsApp()}
                  className="group relative flex items-center justify-center gap-2 p-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 fill-white" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold leading-tight flex items-center gap-1 truncate">
                      WhatsApp <ExternalLink className="w-3 h-3 opacity-75 shrink-0" />
                    </div>
                    <div className="text-[10px] text-emerald-100 font-normal truncate">Chatear</div>
                  </div>
                </button>

                {/* Opción 2: Llamar directo al número */}
                <button
                  type="button"
                  onClick={handleCall}
                  className="group relative flex items-center justify-center gap-2 p-3 rounded-2xl bg-[#8C1F25] hover:bg-[#72191E] active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-[#8C1F25]/20 transition-all cursor-pointer"
                >
                  <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-xs font-bold leading-tight flex items-center gap-1 truncate">
                      Llamar <ExternalLink className="w-3 h-3 opacity-75 shrink-0" />
                    </div>
                    <div className="text-[10px] text-rose-100 font-normal truncate">Llamada de voz</div>
                  </div>
                </button>

                {/* Opción 3: Abrir Google Maps (si tiene dirección) */}
                {supplier.address && (
                  <a
                    href={getGoogleMapsUrl(supplier.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative flex items-center justify-center gap-2 p-3 rounded-2xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-amber-600/20 transition-all cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <div className="text-left min-w-0">
                      <div className="text-xs font-bold leading-tight flex items-center gap-1 truncate">
                        Cómo llegar <ExternalLink className="w-3 h-3 opacity-75 shrink-0" />
                      </div>
                      <div className="text-[10px] text-amber-100 font-normal truncate">Google Maps GPS</div>
                    </div>
                  </a>
                )}
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-[#1E1410] border border-stone-200 dark:border-[#35251F]">
                <div className="flex items-center gap-2.5 text-xs text-stone-500 dark:text-stone-400">
                  <Phone className="w-4 h-4 text-stone-400 shrink-0" />
                  <span>Sin número de contacto registrado.</span>
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

          {/* FICHA TÉCNICA DEL PROVEEDOR */}
          <div className="bg-white dark:bg-[#1E1410] rounded-2xl p-4 border border-[#DFCAA9]/70 dark:border-[#35251F] space-y-3.5 text-xs shadow-xs">
            {/* Rubro / Proveedor de qué es */}
            <div className="flex items-start gap-2.5">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0">
                <Tag className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[#1C120D] dark:text-[#FBF4EB] block">
                  Proveedor de qué es:
                </span>
                <p className="text-stone-600 dark:text-stone-300 mt-0.5 leading-relaxed">
                  {supplier.category}
                </p>
              </div>
            </div>

            {/* Dirección si existe */}
            {supplier.address && (
              <div className="flex items-start gap-2.5 pt-2 border-t border-stone-100 dark:border-[#2C1D18]">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 shrink-0">
                  <MapPin className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[#1C120D] dark:text-[#FBF4EB] block">
                      Dirección física / Ubicación:
                    </span>
                    <a
                      href={getGoogleMapsUrl(supplier.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
                    >
                      <span>Abrir mapa</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  </div>
                  <p className="text-stone-600 dark:text-stone-300 mt-0.5 font-medium">
                    {supplier.address}
                  </p>
                </div>
              </div>
            )}

            {/* Cuándo entrega o Horario de atención */}
            <div className="flex items-start gap-2.5 pt-2 border-t border-stone-100 dark:border-[#2C1D18]">
              <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 shrink-0">
                {isPresencial ? <Store className="w-4 h-4" /> : <Calendar className="w-4 h-4" />}
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[#1C120D] dark:text-[#FBF4EB] block">
                  {isPresencial ? 'Horario de atención en local:' : 'Cuándo entrega (Despacho):'}
                </span>
                <p className="text-stone-600 dark:text-stone-300 mt-0.5 font-medium">
                  {supplier.deliverySchedule || (isPresencial ? 'Horario comercial continuo' : 'A coordinar')}
                </p>
              </div>
            </div>

            {/* Precios aproximados */}
            <div className="flex items-start gap-2.5 pt-2 border-t border-stone-100 dark:border-[#2C1D18]">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 shrink-0">
                <DollarSign className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-[#1C120D] dark:text-[#FBF4EB] block">
                  Precios aproximados / Referencia:
                </span>
                <div className="text-stone-700 dark:text-stone-200 mt-1 p-2 rounded-xl bg-stone-50 dark:bg-[#251A15] border border-stone-200/80 dark:border-[#35251F] font-mono text-[11px] leading-relaxed">
                  {supplier.approximatePrices || 'A consultar en establecimiento'}
                </div>
              </div>
            </div>

            {/* Notas / Condiciones adicionales */}
            {supplier.notes && (
              <div className="flex items-start gap-2.5 pt-2 border-t border-stone-100 dark:border-[#2C1D18]">
                <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-400 shrink-0">
                  <Info className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="font-bold text-[#1C120D] dark:text-[#FBF4EB] block">
                    Condiciones & notas:
                  </span>
                  <p className="text-stone-500 dark:text-stone-400 mt-0.5 italic">
                    {supplier.notes}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Opciones rápidas de mensaje para WhatsApp */}
          {hasPhone && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-stone-600 dark:text-stone-400 block">
                Mensajes rápidos de pedido para WhatsApp:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {isPresencial ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenWhatsApp(
                          `Hola ${supplier.name}, te escribo desde Pastelería Orión para consultar si tienen stock de ${supplier.category.split(',')[0] || 'materias primas'} disponible para ir a comprar hoy.`
                        )
                      }
                      className="text-[11px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9] dark:border-[#35251F] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-stone-700 dark:text-stone-300 transition-colors text-left cursor-pointer"
                    >
                      🛒 "Consultar stock para ir a comprar hoy"
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenWhatsApp(
                          `Hola ${supplier.name}, te escribo desde Pastelería Orión para confirmar si tienen abierto hoy y su horario de atención.`
                        )
                      }
                      className="text-[11px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9] dark:border-[#35251F] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-stone-700 dark:text-stone-300 transition-colors text-left cursor-pointer"
                    >
                      🏬 "¿Tienen abierto hoy y cuál es el horario?"
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenWhatsApp(
                          `Hola ${supplier.name}, te escribo desde Pastelería Orión para consultar si tienen stock de ${supplier.category.split(',')[0] || 'materias primas'} para entrega en su próximo despacho.`
                        )
                      }
                      className="text-[11px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9] dark:border-[#35251F] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-stone-700 dark:text-stone-300 transition-colors text-left cursor-pointer"
                    >
                      💬 "Consultar stock para próximo despacho"
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        handleOpenWhatsApp(
                          `Hola ${supplier.name}, te escribo desde Pastelería Orión para solicitar cotización actualizada y hacer un pedido.`
                        )
                      }
                      className="text-[11px] px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9] dark:border-[#35251F] hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-stone-700 dark:text-stone-300 transition-colors text-left cursor-pointer"
                    >
                      📦 "Cotización formal y pedido"
                    </button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Pie de modal */}
          <div className="pt-2 flex items-center justify-between">
            {onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(supplier);
                }}
                className="text-xs text-stone-500 hover:text-[#8C1F25] dark:hover:text-[#E25C64] underline underline-offset-4 cursor-pointer"
              >
                Editar información de este proveedor
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="ml-auto px-4 py-2 rounded-xl bg-stone-200/80 dark:bg-[#251A15] hover:bg-stone-300 dark:hover:bg-[#30221C] text-stone-700 dark:text-stone-300 text-xs font-semibold cursor-pointer transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
