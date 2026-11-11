import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Wrench,
  Plus,
  Search,
  AlertTriangle,
  Edit2,
  Trash2,
  PlusCircle,
  MinusCircle,
  ShoppingCart,
} from 'lucide-react';
import type { GeneralSupply, ToastMessage, User } from '../../../types';
import {
  generalSupplyService,
  type SaveGeneralSupplyPayload,
} from '../../../services/generalSupplyService';
import { GeneralSupplyModal } from './GeneralSupplyModal';
import { DeleteGeneralSupplyModal } from './DeleteGeneralSupplyModal';

interface GeneralSuppliesViewProps {
  user: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  onInventoryChange?: () => void;
}

export const GeneralSuppliesView: React.FC<GeneralSuppliesViewProps> = ({
  user,
  addToast,
  onInventoryChange,
}) => {
  const [items, setItems] = useState<GeneralSupply[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | 'sufficient' | 'low_stock' | 'out'
  >('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GeneralSupply | null>(null);
  const [deletingItem, setDeletingItem] = useState<GeneralSupply | null>(null);

  const isAdmin = user.role === 'admin';

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await generalSupplyService.getAll();
      setItems(data);
    } catch {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo cargar el inventario de insumos generales.',
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
    const sufficient = items.filter((i) => i.stock > i.minStock).length;
    const low = items.filter((i) => i.stock > 0 && i.stock <= i.minStock).length;
    const out = items.filter((i) => i.stock <= 0).length;
    const critical = low + out;
    return { total, sufficient, low, out, critical };
  }, [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    items.forEach((i) => {
      if (i.category) set.add(i.category);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (statusFilter === 'sufficient' && item.stock <= item.minStock) {
        return false;
      }
      if (statusFilter === 'low_stock' && item.stock > item.minStock) {
        return false;
      }
      if (statusFilter === 'out' && item.stock > 0) {
        return false;
      }
      if (selectedCategory !== 'all' && item.category !== selectedCategory) {
        return false;
      }
      if (search.trim()) {
        const query = search.toLowerCase();
        return (
          item.name.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          Boolean(item.description?.toLowerCase().includes(query)) ||
          Boolean(item.supplier?.name?.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [items, statusFilter, selectedCategory, search]);

  const handleSave = async (data: SaveGeneralSupplyPayload) => {
    if (editingItem) {
      await generalSupplyService.update(editingItem.id, data);
      addToast({
        type: 'success',
        title: 'Actualizado',
        message: 'Insumo general modificado con éxito.',
      });
    } else {
      await generalSupplyService.create(data);
      addToast({
        type: 'success',
        title: 'Creado',
        message: 'Nuevo insumo general registrado.',
      });
    }
    await loadData();
    onInventoryChange?.();
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await generalSupplyService.delete(deletingItem.id);
      addToast({
        type: 'success',
        title: 'Eliminado',
        message: 'Insumo general eliminado correctamente.',
      });
      setDeletingItem(null);
      await loadData();
      onInventoryChange?.();
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudo eliminar el insumo general.',
      });
    }
  };

  const handleQuickAdjust = async (id: string, delta: number) => {
    try {
      const updated = await generalSupplyService.adjustStock(id, delta);
      setItems((prev) =>
        prev.map((item) => (item.id === id ? updated : item)),
      );
      onInventoryChange?.();
    } catch {
      addToast({
        type: 'error',
        title: 'Error',
        message: 'No se pudo actualizar el stock.',
      });
    }
  };

  return (
    <div className="p-2 sm:p-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Wrench className="w-7 h-7 text-[#8C1F25]" />
            Insumos Generales &amp; Operativos
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Control de guantes, cofias, artículos de aseo y utensilios internos (no aparecen en POS ni en recetas).
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
            <Plus className="w-4 h-4" /> Nuevo Insumo General
          </button>
        )}
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-stone-500">
            Total Ítems
          </span>
          <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            {metrics.total}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Stock Suficiente
          </span>
          <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-1">
            {metrics.sufficient}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Stock Bajo
          </span>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
            {metrics.low}
          </p>
        </div>
        <div className="p-4 rounded-2xl bg-white dark:bg-[#1E1512] border border-stone-200 dark:border-stone-800 shadow-xs">
          <span className="text-xs font-semibold text-rose-600 dark:text-rose-400 flex items-center gap-1">
            <ShoppingCart className="w-3.5 h-3.5" /> Agotados (A Compras)
          </span>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1">
            {metrics.out}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex flex-wrap gap-2 w-full md:w-auto">
          <button
            type="button"
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              statusFilter === 'all'
                ? 'bg-[#8C1F25] text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            Todos ({metrics.total})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('sufficient')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              statusFilter === 'sufficient'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            ✅ Suficientes ({metrics.sufficient})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('low_stock')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              statusFilter === 'low_stock'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            ⚠️ Para Comprar ({metrics.critical})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('out')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-all ${
              statusFilter === 'out'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200'
            }`}
          >
            🚨 Agotados ({metrics.out})
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
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 md:w-64">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar insumo o proveedor..."
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
                <th className="py-3 px-4">Insumo</th>
                <th className="py-3 px-4">Categoría</th>
                <th className="py-3 px-4">Stock</th>
                <th className="py-3 px-4">Ajuste Rápido</th>
                <th className="py-3 px-4">Costo Ref.</th>
                <th className="py-3 px-4">Proveedor</th>
                {isAdmin && <th className="py-3 px-4 text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60">
              {filteredItems.length === 0 ? (
                <tr>
                  <td
                    colSpan={isAdmin ? 7 : 6}
                    className="py-8 text-center text-stone-400 text-sm"
                  >
                    {loading
                      ? 'Cargando inventario...'
                      : 'No se encontraron insumos generales registrados.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-stone-50/50 dark:hover:bg-stone-800/20"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{item.icon || '🧤'}</span>
                        <div>
                          <div className="font-bold text-stone-900 dark:text-stone-100">
                            {item.name}
                          </div>
                          {item.description && (
                            <div className="text-[11px] text-stone-400 line-clamp-1">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-stone-400 font-medium">
                      <span className="px-2.5 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-[11px] font-semibold">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-stone-900 dark:text-stone-100">
                          {item.stock} {item.unit}
                        </span>
                        {item.status === 'agotado' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 dark:bg-rose-950/70 text-rose-700 dark:text-rose-300">
                            Agotado
                          </span>
                        )}
                        {item.status === 'bajo' && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300">
                            Bajo
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-stone-400">
                        Mín: {item.minStock} {item.unit}
                        {item.stock <= item.minStock && ' • En Lista de Compras'}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(item.id, -1)}
                          title="-1 unidad"
                          className="p-1 rounded-md text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <MinusCircle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleQuickAdjust(item.id, 1)}
                          title="+1 unidad"
                          className="p-1 rounded-md text-stone-400 hover:text-emerald-600 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                        >
                          <PlusCircle className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-stone-600 dark:text-stone-300">
                      ${Number(item.costPrice || 0).toLocaleString('es-CL')}
                    </td>
                    <td className="py-3 px-4 text-xs text-stone-600 dark:text-stone-300">
                      {item.supplier ? (
                        <span className="flex items-center gap-1">
                          {item.supplier.icon} {item.supplier.name}
                        </span>
                      ) : (
                        <span className="text-stone-400 italic">
                          Opcional / Sin asignar
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingItem(item);
                              setIsModalOpen(true);
                            }}
                            title="Editar insumo"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingItem(item)}
                            title="Eliminar insumo"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modales */}
      <GeneralSupplyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSave}
        itemToEdit={editingItem}
      />

      <DeleteGeneralSupplyModal
        isOpen={Boolean(deletingItem)}
        onClose={() => setDeletingItem(null)}
        onConfirm={handleDelete}
        item={deletingItem}
      />
    </div>
  );
};

