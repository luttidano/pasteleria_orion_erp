import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Package,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
} from 'lucide-react';
import type { AdjustStockPayload, Packaging, ToastMessage, User } from '../../../types';
import { packagingService } from '../../../services/packagingService';
import { formatMoney } from '../../../utils/formatters';
import { PackagingModal } from './PackagingModal';
import { StockAdjustmentModal, type StockAdjustmentTarget } from '../StockAdjustmentModal';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';

interface PackagingViewProps {
  user?: User | null;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onInventoryChange?: () => void;
}

export const PackagingView: React.FC<PackagingViewProps> = ({
  user,
  addToast,
  onInventoryChange,
}) => {
  const isAdmin = user?.role === 'admin';
  const [items, setItems] = useState<Packaging[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedType, setSelectedType] = useState<'all' | 'primario' | 'secundario' | 'low_stock'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Packaging | null>(null);
  const [deletingItem, setDeletingItem] = useState<Packaging | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [adjustmentTarget, setAdjustmentTarget] = useState<StockAdjustmentTarget | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await packagingService.getAll();
      setItems(data);
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo cargar el inventario de empaques.',
      });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const metrics = useMemo(() => {
    const total = items.length;
    const primarios = items.filter((i) => i.packageType === 'primario').length;
    const secundarios = items.filter((i) => i.packageType === 'secundario').length;
    const lowStock = items.filter((i) => i.status === 'bajo' || i.status === 'agotado').length;
    return { total, primarios, secundarios, lowStock };
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => set.add(i.category));
    return Array.from(set);
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedType === 'primario' && item.packageType !== 'primario') return false;
      if (selectedType === 'secundario' && item.packageType !== 'secundario') return false;
      if (selectedType === 'low_stock' && item.status !== 'bajo' && item.status !== 'agotado') return false;
      if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          Boolean(item.supplier?.name && item.supplier.name.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [items, selectedType, selectedCategory, search]);

  const handleSave = async (data: Partial<Packaging>) => {
    if (editingItem) {
      await packagingService.update(editingItem.id, data);
      addToast({ type: 'success', title: 'Actualizado', message: 'Empaque modificado con éxito.' });
    } else {
      await packagingService.create(data);
      addToast({ type: 'success', title: 'Creado', message: 'Nuevo empaque registrado.' });
    }
    await loadData();
    onInventoryChange?.();
  };

  const handleDelete = async () => {
    if (!deletingItem || isDeleting) return;
    setIsDeleting(true);
    try {
      await packagingService.delete(deletingItem.id);
      addToast({ type: 'success', title: 'Eliminado', message: 'Empaque eliminado.' });
      setDeletingItem(null);
      await loadData();
      onInventoryChange?.();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error',
        message: err instanceof Error ? err.message : 'No se pudo eliminar el empaque.',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const openAdjustmentModal = (item: Packaging, delta: number) => {
    setAdjustmentTarget({
      id: item.id,
      name: item.name,
      itemType: 'packaging',
      currentStock: item.stock,
      unit: item.unit,
      unitCost: item.costPrice,
      initialDelta: delta,
    });
  };

  const handleConfirmAdjustment = async (
    id: string,
    payload: AdjustStockPayload,
    idempotencyKey?: string,
  ) => {
    const updated = await packagingService.adjustStock(
      id,
      payload,
      idempotencyKey,
    );
    setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
    onInventoryChange?.();
    addToast({
      type: updated.accountingWarning ? 'warning' : 'success',
      title: updated.accountingWarning
        ? 'Stock actualizado (pendiente contable)'
        : 'Stock actualizado',
      message: updated.accountingWarning
        ? `${updated.name}: ${updated.stock} ${updated.unit}. ${updated.accountingWarning}`
        : `${updated.name}: ${updated.stock} ${updated.unit}`,
    });
  };

  return (
    <div className="p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Package className="w-7 h-7 text-[#8C1F25]" />
            Inventario de Empaques & Despacho
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Control de cajas, bolsas kraft, domos y bases (aislados del recetario culinario).
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              setEditingItem(null);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#8C1F25] text-white font-bold text-sm shadow-md hover:bg-[#73191E] transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Nuevo Empaque
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-stone-500">Total Ítems</span>
          <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">{metrics.total}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">🍰 Primarios (Base/Contacto)</span>
          <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">{metrics.primarios}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">🛍️ Secundarios (Despacho)</span>
          <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">{metrics.secundarios}</p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Stock Bajo / Agotado
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">{metrics.lowStock}</p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setSelectedType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              selectedType === 'all'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            Todos ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('primario')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              selectedType === 'primario'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            🍰 Primarios ({metrics.primarios})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('secundario')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              selectedType === 'secundario'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            🛍️ Secundarios ({metrics.secundarios})
          </button>
          <button
            type="button"
            onClick={() => setSelectedType('low_stock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              selectedType === 'low_stock'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            ⚠️ Críticos ({metrics.lowStock})
          </button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          {categories.length > 0 && (
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1512] text-xs font-medium"
            >
              <option value="all">Todas las categorías</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar empaque..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1512] text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1E1512] rounded-2xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-stone-50 dark:bg-[#170F0D] border-b border-stone-200 dark:border-stone-800 text-stone-500 text-xs">
              <tr>
                <th className="py-3 px-4">Empaque</th>
                <th className="py-3 px-4">Tipo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Ajuste Rápido</th>
                <th className="py-3 px-4">Costo / Venta POS</th>
                <th className="py-3 px-4">Proveedor</th>
                <th className="py-3 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-stone-400 text-sm">
                    {loading ? 'Cargando inventario...' : 'No se encontraron empaques registrados.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-stone-50/50 dark:hover:bg-stone-800/20">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.icon}</span>
                        <div>
                          <div className="font-bold text-stone-900 dark:text-stone-100">{item.name}</div>
                          {item.description && <div className="text-[11px] text-stone-400">{item.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.packageType === 'primario' ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                          Primario
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                          Secundario
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-stone-400 font-medium">
                      {item.category}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {item.stock} {item.unit}
                        </span>
                        {item.status === 'agotado' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">Agotado</span>
                        )}
                        {item.status === 'bajo' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">Bajo</span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-400">Mín: {item.minStock} {item.unit}</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openAdjustmentModal(item, -10)}
                          disabled={item.stock <= 0}
                          title="Descontar / Registrar merma"
                          className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openAdjustmentModal(item, 10)}
                          title="Ingresar compra / sobrante"
                          className="p-1 rounded-md text-stone-400 hover:text-emerald-600 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-stone-600 dark:text-stone-300">
                      <div>{formatMoney(item.costPrice)}</div>
                      {item.packageType === 'secundario' && (
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 font-sans font-semibold">
                          POS: {formatMoney(item.salePrice ?? 0)}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-stone-300">
                      {item.supplier ? (
                        <span className="flex items-center gap-1">
                          {item.supplier.icon} {item.supplier.name}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">No asignado</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isAdmin ? (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingItem(item)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-stone-400 italic">Solo lectura</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      <PackagingModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        itemToEdit={editingItem}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(deletingItem)}
        title="¿Eliminar empaque del inventario?"
        description={
          deletingItem ? (
            <>
              Estás a punto de eliminar el empaque{' '}
              <strong className="text-[#1C120D] dark:text-[#FBF4EB]">"{deletingItem.name}"</strong>.
            </>
          ) : null
        }
        confirmLabel="Sí, eliminar empaque"
        isDeleting={isDeleting}
        onClose={() => !isDeleting && setDeletingItem(null)}
        onConfirm={handleDelete}
      />

      <StockAdjustmentModal
        target={adjustmentTarget}
        onClose={() => setAdjustmentTarget(null)}
        onConfirm={handleConfirmAdjustment}
      />
    </div>
  );
};
