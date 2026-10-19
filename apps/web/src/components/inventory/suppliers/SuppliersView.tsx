import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Search,
  Plus,
  Phone,
  MessageSquare,
  Calendar,
  Tag,
  DollarSign,
  Edit2,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Truck,
  User,
  ChevronRight,
  ArrowLeft,
  FileText,
  Send,
  MapPin,
  Store,
} from 'lucide-react';
import type { Supplier, ToastMessage } from '../../../types';
import {
  supplierService,
  getWhatsAppUrl,
  getCallUrl,
  getGoogleMapsUrl,
  getSupplyModality,
} from '../../../services/supplierService';
import { SupplierModal } from './SupplierModal';
import { DeleteSupplierModal } from './DeleteSupplierModal';

interface SuppliersViewProps {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const SuppliersView: React.FC<SuppliersViewProps> = ({ addToast }) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [isLoading, setIsLoading] = useState(true);

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalityFilter, setModalityFilter] = useState<'all' | 'despacho' | 'presencial'>('all');

  // Vista en dispositivos móviles: 'list' (directorio) o 'detail' (ficha activa)
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  // Mensaje personalizado para WhatsApp en la ficha activa
  const [customOrderNote, setCustomOrderNote] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Cargar proveedores
  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
      if (data.length > 0 && !selectedSupplierId) {
        setSelectedSupplierId(data[0].id);
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Error al cargar proveedores',
        message: 'No se pudo obtener la lista de contactos.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast, selectedSupplierId]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  // Contadores por modalidad de abastecimiento
  const counts = useMemo(() => {
    const total = suppliers.length;
    const despacho = suppliers.filter((s) => getSupplyModality(s) === 'despacho').length;
    const presencial = suppliers.filter((s) => getSupplyModality(s) === 'presencial').length;
    return { total, despacho, presencial };
  }, [suppliers]);

  // Lista de rubros para filtros rápidos
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    suppliers.forEach((s) => {
      const main = s.category.split(/[,•]/)[0].trim();
      if (main) set.add(main);
    });
    return ['Todas', ...Array.from(set)];
  }, [suppliers]);

  // Proveedores filtrados
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      const modality = getSupplyModality(s);
      if (modalityFilter !== 'all' && modality !== modalityFilter) {
        return false;
      }

      const query = searchTerm.toLowerCase();
      const matchSearch =
        s.name.toLowerCase().includes(query) ||
        s.category.toLowerCase().includes(query) ||
        (s.deliverySchedule && s.deliverySchedule.toLowerCase().includes(query)) ||
        (s.phone && s.phone.toLowerCase().includes(query)) ||
        (s.address && s.address.toLowerCase().includes(query)) ||
        (s.approximatePrices && s.approximatePrices.toLowerCase().includes(query)) ||
        (s.contactPerson && s.contactPerson.toLowerCase().includes(query));

      const matchCategory =
        selectedCategory === 'Todas' ||
        s.category.toLowerCase().includes(selectedCategory.toLowerCase());

      return matchSearch && matchCategory;
    });
  }, [suppliers, searchTerm, selectedCategory, modalityFilter]);

  // Proveedor seleccionado actualmente para la ficha de contacto
  const selectedSupplier = useMemo(() => {
    if (!selectedSupplierId && filteredSuppliers.length > 0) {
      return filteredSuppliers[0];
    }
    return (
      filteredSuppliers.find((s) => s.id === selectedSupplierId) ||
      suppliers.find((s) => s.id === selectedSupplierId) ||
      filteredSuppliers[0] ||
      null
    );
  }, [selectedSupplierId, filteredSuppliers, suppliers]);

  // Limpiar nota personalizada al cambiar de proveedor
  useEffect(() => {
    setCustomOrderNote('');
    setCopiedPhone(false);
  }, [selectedSupplier?.id]);

  // Guardar (crear o editar)
  const handleSaveSupplier = async (
    data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>
  ) => {
    try {
      if (supplierToEdit) {
        const updated = await supplierService.update(supplierToEdit.id, data);
        setSelectedSupplierId(updated.id);
        addToast({
          type: 'success',
          title: 'Proveedor modificado',
          message: `Se actualizaron los datos de "${data.name}".`,
        });
      } else {
        const created = await supplierService.create(data);
        setSelectedSupplierId(created.id);
        addToast({
          type: 'success',
          title: 'Proveedor agregado',
          message: `"${data.name}" se guardó en la agenda de contactos.`,
        });
      }
      await loadSuppliers();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al guardar.';
      addToast({ type: 'error', title: 'Error', message: msg });
      throw err;
    }
  };

  // Eliminar proveedor
  const handleConfirmDelete = async () => {
    if (!supplierToDelete) return;
    setIsDeleting(true);
    try {
      await supplierService.delete(supplierToDelete.id);
      addToast({
        type: 'info',
        title: 'Proveedor eliminado',
        message: `Se quitó a "${supplierToDelete.name}" de la agenda.`,
      });
      setSupplierToDelete(null);
      // Seleccionar el primero restante
      const remaining = suppliers.filter((s) => s.id !== supplierToDelete.id);
      if (remaining.length > 0) {
        setSelectedSupplierId(remaining[0].id);
      } else {
        setSelectedSupplierId(null);
      }
      await loadSuppliers();
    } catch {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo eliminar el contacto.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Copiar teléfono
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
    addToast({
      type: 'info',
      title: 'Teléfono copiado',
      message: `${phone} copiado al portapapeles.`,
    });
  };

  const isPhoneRegistered = (phone?: string) => {
    if (!phone) return false;
    const clean = phone.trim();
    return clean !== '' && clean !== 'Sin registrar' && clean !== 'No registrado';
  };

  // Redirección directa a WhatsApp
  const handleDirectWhatsApp = (supplier: Supplier, customMsg?: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isPhoneRegistered(supplier.phone)) {
      addToast({
        type: 'warning',
        title: 'Sin teléfono',
        message: 'Este proveedor no tiene un número registrado.',
      });
      return;
    }
    const defaultMsg = `Hola ${supplier.name}, te escribo desde Pastelería Orión. Quisiera cotizar / consultar disponibilidad de ${supplier.category.split(/[,•]/)[0] || 'materias primas'}.`;
    const message = customMsg || customOrderNote || defaultMsg;
    const url = getWhatsAppUrl(supplier.phone, supplier.name, message);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Redirección directa a llamada telefónica
  const handleDirectCall = (supplier: Supplier, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!isPhoneRegistered(supplier.phone)) {
      addToast({
        type: 'warning',
        title: 'Sin teléfono',
        message: 'Este proveedor no tiene un número registrado.',
      });
      return;
    }
    const callUrl = getCallUrl(supplier.phone);
    window.location.href = callUrl;
  };

  // Desglosar insumos en píldoras visuales legibles
  const categoryChips = useMemo(() => {
    if (!selectedSupplier?.category) return [];
    return selectedSupplier.category
      .split(/[,;•\n]+/)
      .map((c) => c.trim())
      .filter(Boolean);
  }, [selectedSupplier]);

  // Desglosar precios referenciales en renglones o tarjetas limpias
  const priceRows = useMemo(() => {
    if (!selectedSupplier?.approximatePrices) return [];
    return selectedSupplier.approximatePrices
      .split(/[•;\n]+/)
      .map((p) => p.trim())
      .filter(Boolean);
  }, [selectedSupplier]);

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto pb-10">
      {/* 1. ENCABEZADO MINIMALISTA Y REFINADO (SIN MÉTRICAS INÚTILES) */}
      <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-3xl p-5 sm:p-6 border border-[#DFCAA9]/70 dark:border-[#35251F] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E25C64] text-[11px] font-bold tracking-wide uppercase">
                Directorio Telefónico
              </span>
              <span className="text-xs text-stone-400">•</span>
              <span className="text-xs text-stone-500 dark:text-stone-400">
                {suppliers.length} contactos registrados
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif mt-1">
              Proveedores de Materia Prima
            </h2>
            <p className="text-xs sm:text-sm text-[#6C594D] dark:text-[#B4A194] mt-0.5">
              Agenda de pedidos con redirección directa a <strong>WhatsApp</strong> y <strong>llamadas telefónicas</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setSupplierToEdit(null);
                setIsModalOpen(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#72191E] active:scale-[0.98] text-white font-semibold text-xs shadow-md shadow-[#8C1F25]/20 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Agregar Proveedor</span>
            </button>
          </div>
        </div>

        {/* Barra de Filtros y Búsqueda integrada */}
        <div className="mt-4 pt-4 border-t border-[#E8D7BE]/80 dark:border-[#2C1D18] flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Selector de Modalidad */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white dark:bg-[#1E1410] border border-[#DFCAA9]/70 dark:border-[#2C1D18] w-fit shadow-2xs">
            <button
              type="button"
              onClick={() => setModalityFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                modalityFilter === 'all'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              Todos ({counts.total})
            </button>
            <button
              type="button"
              onClick={() => setModalityFilter('despacho')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modalityFilter === 'despacho'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              <span>Con Despacho ({counts.despacho})</span>
            </button>
            <button
              type="button"
              onClick={() => setModalityFilter('presencial')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                modalityFilter === 'presencial'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#2A1D18]'
              }`}
            >
              <Store className="w-3.5 h-3.5" />
              <span>Compra en Local ({counts.presencial})</span>
            </button>
          </div>

          {/* Búsqueda */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, insumos o dirección..."
              className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white dark:bg-[#201612] border border-[#DFCAA9] dark:border-[#35251F] text-xs text-[#1C120D] dark:text-[#FBF4EB] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]/40"
            />
          </div>
        </div>

        {/* Chips de filtro por rubro */}
        <div className="mt-3 flex flex-wrap gap-1.5 items-center">
          <span className="text-[11px] font-semibold text-stone-500 dark:text-stone-400 mr-1 hidden sm:inline">
            Rubro:
          </span>
          {categoriesList.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`text-[11px] px-3 py-1 rounded-full border transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#8C1F25] text-white border-[#8C1F25] font-semibold shadow-xs'
                  : 'bg-white dark:bg-[#201612] text-stone-600 dark:text-stone-300 border-[#DFCAA9]/70 dark:border-[#35251F] hover:bg-[#F3E7D7] dark:hover:bg-[#2A1D18]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 2. LAYOUT MASTER-DETAIL: VISTA DIVIDIDA TIPO AGENDA Y FICHA EJECUTIVA */}
      {isLoading && suppliers.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] rounded-3xl p-12 text-center border border-stone-200/80 dark:border-[#35251F] shadow-xs">
          <div className="w-8 h-8 border-3 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">Cargando proveedores desde la base de datos...</p>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] rounded-3xl p-12 text-center border border-stone-200/80 dark:border-[#35251F] shadow-xs">
          <div className="w-16 h-16 rounded-3xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 mx-auto flex items-center justify-center text-3xl mb-3">
            🚚
          </div>
          <h3 className="text-lg font-bold text-stone-800 dark:text-stone-200 font-serif">
            No hay proveedores que coincidan
          </h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
            Revisa los términos de búsqueda o agrega un nuevo contacto al directorio.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('Todas');
            }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-[#201612] hover:bg-stone-200 text-stone-700 dark:text-stone-300 cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* ============================================================ */}
          {/* PANEL IZQUIERDO (COLUMNA DE AGENDA - 5 COLUMNAS EN LG)       */}
          {/* ============================================================ */}
          <div
            className={`lg:col-span-5 space-y-2.5 ${
              mobileTab === 'detail' ? 'hidden lg:block' : 'block'
            }`}
          >
            <div className="flex items-center justify-between px-2 text-xs text-stone-500 dark:text-stone-400 font-medium">
              <span>Contactos ({filteredSuppliers.length})</span>
              <span className="text-[11px] text-stone-400">Haz clic para ver ficha y pedir</span>
            </div>

            <div className="space-y-2">
              {filteredSuppliers.map((supplier) => {
                const isSelected = selectedSupplier?.id === supplier.id;
                const isPresencial = getSupplyModality(supplier) === 'presencial';

                return (
                  <div
                    key={supplier.id}
                    onClick={() => {
                      setSelectedSupplierId(supplier.id);
                      setMobileTab('detail');
                    }}
                    className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                      isSelected
                        ? 'bg-white dark:bg-[#1E1410] border-[#8C1F25] dark:border-[#B83238] shadow-md ring-2 ring-[#8C1F25]/15'
                        : 'bg-white/80 dark:bg-[#16100E] border-stone-200/80 dark:border-[#35251F] hover:bg-white dark:hover:bg-[#1C1310] hover:border-stone-300'
                    }`}
                  >
                    {/* Indicador de activo */}
                    {isSelected && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#8C1F25] dark:bg-[#E25C64]" />
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Avatar */}
                        <div
                          className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform ${
                            isSelected
                              ? 'bg-[#FAF5ED] dark:bg-[#2A1D18] border border-[#DFCAA9] dark:border-[#3D2C24] scale-105 shadow-xs'
                              : 'bg-stone-100 dark:bg-[#201612]'
                          }`}
                        >
                          {supplier.icon || (isPresencial ? '🏬' : '🚚')}
                        </div>

                        <div className="min-w-0">
                          <h4 className="font-bold text-stone-900 dark:text-[#FDF5EE] text-sm font-serif truncate leading-tight">
                            {supplier.name}
                          </h4>
                          <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                            {supplier.category}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {isPresencial ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/40 truncate max-w-[170px]">
                                <Store className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{supplier.deliverySchedule || 'Local / Mayorista'}</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 truncate max-w-[170px]">
                                <Truck className="w-2.5 h-2.5 shrink-0" />
                                <span className="truncate">{supplier.deliverySchedule}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Botones directos de WhatsApp, Llamar y Google Maps */}
                      <div className="flex items-center gap-1 shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                        {supplier.address && (
                          <a
                            href={getGoogleMapsUrl(supplier.address)}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`Abrir ubicación de ${supplier.name} en Google Maps`}
                            className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {isPhoneRegistered(supplier.phone) && (
                          <>
                            <button
                              type="button"
                              onClick={(e) => handleDirectWhatsApp(supplier, undefined, e)}
                              title="Enviar WhatsApp directo"
                              className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                            >
                              <MessageSquare className="w-3.5 h-3.5 fill-current" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDirectCall(supplier, e)}
                              title="Llamar directo"
                              className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-300 hover:bg-[#8C1F25] hover:text-white dark:hover:bg-[#8C1F25] transition-colors flex items-center justify-center cursor-pointer"
                            >
                              <Phone className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <ChevronRight className={`w-4 h-4 text-stone-300 transition-transform hidden sm:block ${isSelected ? 'text-[#8C1F25] translate-x-0.5' : ''}`} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ============================================================ */}
          {/* PANEL DERECHO (FICHA EJECUTIVA DEL PROVEEDOR - 7 COLS EN LG) */}
          {/* ============================================================ */}
          <div
            className={`lg:col-span-7 sticky top-4 ${
              mobileTab === 'list' ? 'hidden lg:block' : 'block'
            }`}
          >
            {/* Botón de retroceso solo en móvil */}
            <div className="lg:hidden mb-3">
              <button
                type="button"
                onClick={() => setMobileTab('list')}
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#8C1F25] dark:text-[#E25C64] bg-white dark:bg-[#1E1410] px-3 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver a la lista de contactos</span>
              </button>
            </div>

            {selectedSupplier ? (
              <div className="bg-white dark:bg-[#16100E] rounded-3xl border border-stone-200/90 dark:border-[#35251F] shadow-sm overflow-hidden">
                {/* Cabecera elegante del contacto */}
                <div className="p-6 bg-linear-to-b from-[#FAF5ED] to-white dark:from-[#201612] dark:to-[#16100E] border-b border-stone-100 dark:border-[#2C1D18]">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-2xl bg-white dark:bg-[#2A1D18] border border-[#DFCAA9] dark:border-[#3D2C24] flex items-center justify-center text-3xl shadow-sm shrink-0">
                        {selectedSupplier.icon || '🚚'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-xl sm:text-2xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif">
                            {selectedSupplier.name}
                          </h3>
                          {getSupplyModality(selectedSupplier) === 'presencial' ? (
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
                        {selectedSupplier.contactPerson ? (
                          <p className="text-xs text-[#7A6658] dark:text-[#B4A093] mt-0.5 flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-stone-400" />
                            <span>Contacto directo: <strong>{selectedSupplier.contactPerson}</strong></span>
                          </p>
                        ) : (
                          <p className="text-xs text-stone-400 mt-0.5">Proveedor autorizado de materias primas</p>
                        )}
                      </div>
                    </div>

                    {/* Acciones de edición y eliminación */}
                    <div className="flex items-center gap-1.5 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSupplierToEdit(selectedSupplier);
                          setIsModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-[#35251F] text-stone-600 dark:text-stone-300 hover:bg-stone-50 dark:hover:bg-[#251A15] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Modificar datos"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>Editar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setSupplierToDelete(selectedSupplier)}
                        className="p-2 rounded-xl text-stone-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                        title="Eliminar del directorio"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Número de Teléfono & Dirección & Botón Copiar */}
                  <div className="mt-4 pt-3 border-t border-stone-200/60 dark:border-[#2C1D18] flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-stone-400" />
                        {isPhoneRegistered(selectedSupplier.phone) ? (
                          <span className="text-base font-mono font-bold text-stone-900 dark:text-stone-100 tracking-wide">
                            {selectedSupplier.phone}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400 italic">
                            Sin teléfono registrado
                          </span>
                        )}
                      </div>
                      {selectedSupplier.address && (
                        <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                          <MapPin className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="truncate max-w-[240px] sm:max-w-[320px]">{selectedSupplier.address}</span>
                        </div>
                      )}
                    </div>
                    {isPhoneRegistered(selectedSupplier.phone) && (
                      <button
                        type="button"
                        onClick={() => handleCopyPhone(selectedSupplier.phone)}
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

                {/* ACCIONES HERO DE REDIRECCIÓN DIRECTA (WHATSAPP, LLAMADA & GPS) */}
                <div className="p-6 border-b border-stone-100 dark:border-[#2C1D18] bg-stone-50/50 dark:bg-[#1C1310]/50 space-y-3">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 block">
                    Acción Inmediata
                  </span>

                  {isPhoneRegistered(selectedSupplier.phone) ? (
                    <>
                      <div className={`grid grid-cols-1 ${selectedSupplier.address ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
                        {/* Botón WhatsApp */}
                        <button
                          type="button"
                          onClick={() => handleDirectWhatsApp(selectedSupplier)}
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

                        {/* Botón Llamar */}
                        <button
                          type="button"
                          onClick={() => handleDirectCall(selectedSupplier)}
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

                        {/* Botón Google Maps / GPS */}
                        {selectedSupplier.address && (
                          <a
                            href={getGoogleMapsUrl(selectedSupplier.address)}
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
                            onChange={(e) => setCustomOrderNote(e.target.value)}
                            placeholder={
                              getSupplyModality(selectedSupplier) === 'presencial'
                                ? `Hola ${selectedSupplier.name}, quisiera consultar disponibilidad de ${selectedSupplier.category.split(/[,•]/)[0]} para ir a comprar hoy...`
                                : `Hola ${selectedSupplier.name}, quisiera consultar disponibilidad de ${selectedSupplier.category.split(/[,•]/)[0]} para el próximo despacho...`
                            }
                            className="flex-1 px-3 py-2 rounded-xl bg-white dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] text-xs text-stone-800 dark:text-stone-200 placeholder-stone-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleDirectWhatsApp(selectedSupplier, customOrderNote)}
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
                        <span>Sin número de contacto registrado. Puedes editar este proveedor para agregarlo.</span>
                      </div>
                      {selectedSupplier.address && (
                        <a
                          href={getGoogleMapsUrl(selectedSupplier.address)}
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

                {/* DETALLE ESTRUCTURADO (SIN VÓMITO DE TEXTO) */}
                <div className="p-6 space-y-5">
                  {/* 1. Proveedor de qué es (Insumos que abastece) */}
                  <div>
                    <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                      <Tag className="w-4 h-4 text-[#8C1F25] dark:text-[#E25C64]" />
                      <span>Proveedor de qué es (Materias Primas)</span>
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

                  {/* 2. Modalidad de Abastecimiento, Días/Horarios y Ubicación */}
                  <div className="pt-4 border-t border-stone-100 dark:border-[#2C1D18]">
                    {getSupplyModality(selectedSupplier) === 'presencial' ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                          <Store className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Ubicación y Horario de Atención (Compra Presencial)</span>
                        </div>

                        {/* Tarjeta de Dirección física */}
                        {selectedSupplier.address ? (
                          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-300 flex items-center justify-center shrink-0">
                                <MapPin className="w-5 h-5" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-semibold text-xs text-amber-950 dark:text-amber-200 block truncate">
                                  {selectedSupplier.address}
                                </span>
                                <span className="text-[11px] text-amber-800/80 dark:text-amber-400 block mt-0.5">
                                  Ubicación física para compra directa en establecimiento
                                </span>
                              </div>
                            </div>
                            <a
                              href={getGoogleMapsUrl(selectedSupplier.address)}
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

                        {/* Horario de Atención en Local */}
                        <div className="p-3.5 rounded-2xl bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/70 dark:border-blue-900/40 flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 flex items-center justify-center shrink-0">
                            <Calendar className="w-5 h-5" />
                          </div>
                          <div>
                            <span className="font-semibold text-xs text-blue-950 dark:text-blue-200 block">
                              {selectedSupplier.deliverySchedule || 'Horario comercial habitual'}
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
                              {selectedSupplier.deliverySchedule}
                            </span>
                            <span className="text-[11px] text-blue-800/80 dark:text-blue-400 block mt-0.5">
                              Frecuencia confirmada para pedidos de pastelería
                            </span>
                          </div>
                        </div>

                        {selectedSupplier.address && (
                          <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#1E1410] border border-stone-200/80 dark:border-[#35251F] flex items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <MapPin className="w-4 h-4 text-stone-400 shrink-0" />
                              <span className="text-stone-700 dark:text-stone-300 truncate">
                                {selectedSupplier.address}
                              </span>
                            </div>
                            <a
                              href={getGoogleMapsUrl(selectedSupplier.address)}
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

                  {/* 3. Precios aproximados (Formato estructurado y limpio) */}
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
                  {selectedSupplier.notes && (
                    <div className="pt-4 border-t border-stone-100 dark:border-[#2C1D18]">
                      <div className="flex items-center gap-2 mb-1.5 text-xs font-bold text-stone-700 dark:text-stone-300 uppercase tracking-wide">
                        <FileText className="w-4 h-4 text-stone-400" />
                        <span>Condiciones de compra & Notas</span>
                      </div>
                      <p className="text-xs text-stone-600 dark:text-stone-400 bg-stone-50 dark:bg-[#1E1410] p-3 rounded-xl border border-stone-100 dark:border-[#2C1D18] italic">
                        "{selectedSupplier.notes}"
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* 3. MODALES DE GESTIÓN */}
      {/* Modal Agregar / Editar */}
      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSupplierToEdit(null);
        }}
        onSave={handleSaveSupplier}
        supplierToEdit={supplierToEdit}
      />

      {/* Modal Confirmar Eliminación */}
      <DeleteSupplierModal
        isOpen={!!supplierToDelete}
        supplier={supplierToDelete}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeleting}
      />
    </div>
  );
};
