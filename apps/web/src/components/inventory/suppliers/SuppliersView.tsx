import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Supplier, ToastMessage } from '../../../types';
import {
  supplierService,
  getWhatsAppUrl,
  getCallUrl,
  getSupplyModality,
  isPhoneRegistered,
} from '../../../services/supplierService';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import { SupplierModal } from './SupplierModal';
import {
  SupplierFiltersHeader,
  type SupplierModalityFilter,
  type SupplierTypeFilter,
} from './SupplierFiltersHeader';
import { SupplierListColumn } from './SupplierListColumn';
import { SupplierDetailCard } from './SupplierDetailCard';

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
  const [modalityFilter, setModalityFilter] = useState<SupplierModalityFilter>('all');
  const [typeFilter, setTypeFilter] = useState<SupplierTypeFilter>('all');

  // Vista en dispositivos móviles: 'list' (directorio) o 'detail' (ficha activa)
  const [mobileTab, setMobileTab] = useState<'list' | 'detail'>('list');

  // Mensaje personalizado para WhatsApp y feedback de copia en la ficha activa
  const [customOrderNote, setCustomOrderNote] = useState('');
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Cargar proveedores (sin depender de selectedSupplierId para evitar refetch al cambiar de fila)
  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await supplierService.getAll();
      setSuppliers(data);
      setSelectedSupplierId((prev) => {
        if (prev && data.some((s) => s.id === prev)) return prev;
        return data[0]?.id ?? null;
      });
    } catch {
      addToast({
        type: 'error',
        title: 'Error al cargar proveedores',
        message: 'No se pudo obtener la lista de contactos.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  // Contadores por modalidad de abastecimiento y tipo de suministro
  const counts = useMemo(() => {
    const total = suppliers.length;
    const despacho = suppliers.filter((s) => getSupplyModality(s) === 'despacho').length;
    const presencial = suppliers.filter((s) => getSupplyModality(s) === 'presencial').length;
    const materiaPrima = suppliers.filter((s) =>
      s.supplierTypes?.includes('materia_prima'),
    ).length;
    const empaques = suppliers.filter((s) => s.supplierTypes?.includes('empaque')).length;
    const reventa = suppliers.filter((s) => s.supplierTypes?.includes('reventa')).length;
    const insumosGenerales = suppliers.filter((s) =>
      s.supplierTypes?.includes('insumo_general'),
    ).length;
    return { total, despacho, presencial, materiaPrima, empaques, reventa, insumosGenerales };
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

  // Proveedores filtrados (acumulativo: modalidad + tipo + rubro + búsqueda)
  const filteredSuppliers = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return suppliers.filter((s) => {
      const modality = getSupplyModality(s);
      if (modalityFilter !== 'all' && modality !== modalityFilter) {
        return false;
      }

      const types = s.supplierTypes || ['materia_prima'];
      if (typeFilter !== 'all' && !types.includes(typeFilter)) {
        return false;
      }

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
  }, [suppliers, searchTerm, selectedCategory, modalityFilter, typeFilter]);

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
    data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>,
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
    const deletedId = supplierToDelete.id;
    const deletedName = supplierToDelete.name;
    setIsDeleting(true);
    try {
      await supplierService.delete(deletedId);
      addToast({
        type: 'info',
        title: 'Proveedor eliminado',
        message: `Se quitó a "${deletedName}" de la agenda.`,
      });
      setSupplierToDelete(null);
      const remaining = suppliers.filter((s) => s.id !== deletedId);
      setSelectedSupplierId(remaining.length > 0 ? remaining[0].id : null);
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

  // Copiar teléfono con manejo de errores de permisos
  const handleCopyPhone = async (phone: string) => {
    try {
      await navigator.clipboard.writeText(phone);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
      addToast({
        type: 'info',
        title: 'Teléfono copiado',
        message: `${phone} copiado al portapapeles.`,
      });
    } catch {
      addToast({
        type: 'error',
        title: 'No se pudo copiar',
        message: 'Permite el acceso al portapapeles para copiar el número.',
      });
    }
  };

  // Redirección directa a WhatsApp
  const handleDirectWhatsApp = (
    supplier: Supplier,
    customMsg?: string,
    e?: React.MouseEvent,
  ) => {
    e?.stopPropagation();
    if (!isPhoneRegistered(supplier.phone)) {
      addToast({
        type: 'warning',
        title: 'Sin teléfono',
        message: 'Este proveedor no tiene un número registrado.',
      });
      return;
    }
    const defaultMsg = `Hola ${supplier.name}, te escribo desde Pastelería Orión. Quisiera cotizar / consultar disponibilidad de ${
      supplier.category.split(/[,•]/)[0] || 'materias primas'
    }.`;
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
    window.location.href = getCallUrl(supplier.phone);
  };

  return (
    <div className="space-y-5 animate-fade-in max-w-7xl mx-auto pb-10">
      <SupplierFiltersHeader
        totalSuppliers={suppliers.length}
        counts={counts}
        modalityFilter={modalityFilter}
        onModalityChange={setModalityFilter}
        typeFilter={typeFilter}
        onTypeChange={setTypeFilter}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        categoriesList={categoriesList}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onAddSupplier={() => {
          setSupplierToEdit(null);
          setIsModalOpen(true);
        }}
      />

      {isLoading && suppliers.length === 0 ? (
        <div className="bg-white dark:bg-[#16100E] rounded-3xl p-12 text-center border border-stone-200/80 dark:border-[#35251F] shadow-xs">
          <div className="w-8 h-8 border-3 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-stone-500 font-medium">
            Cargando proveedores desde la base de datos...
          </p>
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
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedCategory('Todas');
              setModalityFilter('all');
              setTypeFilter('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold bg-stone-100 dark:bg-[#201612] hover:bg-stone-200 text-stone-700 dark:text-stone-300 cursor-pointer"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <SupplierListColumn
            suppliers={filteredSuppliers}
            selectedSupplierId={selectedSupplier?.id}
            isHiddenOnMobile={mobileTab === 'detail'}
            onSelectSupplier={(supplierId) => {
              setSelectedSupplierId(supplierId);
              setMobileTab('detail');
            }}
            onWhatsApp={(supplier, e) => handleDirectWhatsApp(supplier, undefined, e)}
            onCall={handleDirectCall}
          />

          {selectedSupplier && (
            <SupplierDetailCard
              supplier={selectedSupplier}
              customOrderNote={customOrderNote}
              onCustomOrderNoteChange={setCustomOrderNote}
              copiedPhone={copiedPhone}
              onCopyPhone={(phone) => void handleCopyPhone(phone)}
              onWhatsApp={(supplier, customMsg) => handleDirectWhatsApp(supplier, customMsg)}
              onCall={handleDirectCall}
              onEdit={(supplier) => {
                setSupplierToEdit(supplier);
                setIsModalOpen(true);
              }}
              onDelete={setSupplierToDelete}
              isHiddenOnMobile={mobileTab === 'list'}
              onBackToList={() => setMobileTab('list')}
            />
          )}
        </div>
      )}

      <SupplierModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSupplierToEdit(null);
        }}
        onSave={handleSaveSupplier}
        supplierToEdit={supplierToEdit}
      />

      <ConfirmDeleteModal
        isOpen={!!supplierToDelete}
        title="¿Eliminar proveedor?"
        description={
          <>
            Vas a quitar a{' '}
            <strong className="text-[#1C120D] dark:text-[#FBF4EB]">
              "{supplierToDelete?.name}"
            </strong>{' '}
            del directorio de contactos.
          </>
        }
        warningNote="Esta acción solo remueve el registro del directorio; no modifica compras ni gastos contabilizados."
        confirmLabel="Sí, eliminar proveedor"
        isDeleting={isDeleting}
        onClose={() => setSupplierToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
