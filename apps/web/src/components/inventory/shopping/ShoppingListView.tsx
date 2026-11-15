import React from 'react';
import { Copy, Check, ClipboardList } from 'lucide-react';
import type { Ingredient, ToastMessage } from '../../../types';
import { PurchaseItemModal } from './PurchaseItemModal';
import { useShoppingList } from './hooks/useShoppingList';
import { ShoppingListFiltersBar } from './components/ShoppingListFiltersBar';
import { ShoppingListItemRow } from './components/ShoppingListItemRow';
import { ShoppingListEmptyState } from './components/ShoppingListEmptyState';

interface ShoppingListViewProps {
  ingredients: Ingredient[];
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  ingredients,
  onRefresh,
  addToast,
}) => {
  const {
    urgencyFilter,
    setUrgencyFilter,
    kindFilter,
    setKindFilter,
    selectedItemForPurchase,
    setSelectedItemForPurchase,
    copiedRecently,
    isLoadingExtras,
    allNeededItems,
    filteredItems,
    counts,
    handleConfirmPurchase,
    handleCopyShoppingList,
  } = useShoppingList({ ingredients, onRefresh, addToast });

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* Contenedor Principal de Lista de Compras */}
      <div className="bg-white dark:bg-[#16100E] rounded-[28px] border-2 border-[#EADBCE] dark:border-[#35251F] shadow-sm overflow-hidden">
        {/* Cabecera */}
        <div className="p-5 sm:p-6 bg-[#FAF5ED] dark:bg-[#1E1512] border-b border-[#EADBCE] dark:border-[#35251F] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#8C1F25] text-white flex items-center justify-center shadow-xs shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#2A1B16] dark:text-[#FDF5EE]">
                  Lista de Compras
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E8A598] flex items-center gap-1.5">
                  {isLoadingExtras && (
                    <div className="w-3 h-3 border-2 border-[#8C1F25]/30 border-t-[#8C1F25] rounded-full animate-spin" />
                  )}
                  <span>{counts.totalCount} {counts.totalCount === 1 ? 'pendiente' : 'pendientes'}</span>
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Central de compras: Insumos de pastelería, productos de reventa, empaques e insumos generales.
              </p>
            </div>
          </div>

          {/* Botón: Copiar para WhatsApp */}
          <button
            type="button"
            onClick={handleCopyShoppingList}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 dark:border-[#42312A] bg-white dark:bg-[#251A15] hover:bg-stone-50 dark:hover:bg-[#2D1F1A] text-stone-800 dark:text-[#FBF4EB] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="Copiar lista de compras formateada para WhatsApp"
          >
            {copiedRecently ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">¡Copiado a WhatsApp!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#8C1F25] dark:text-[#D4A373]" />
                <span>Copiar para WhatsApp</span>
              </>
            )}
          </button>
        </div>

        {/* Filtros de Rubro y Urgencia */}
        <ShoppingListFiltersBar
          kindFilter={kindFilter}
          setKindFilter={setKindFilter}
          urgencyFilter={urgencyFilter}
          setUrgencyFilter={setUrgencyFilter}
          counts={counts}
        />

        {/* Lista de Compras */}
        {filteredItems.length === 0 ? (
          <ShoppingListEmptyState
            hasAnyNeededItems={allNeededItems.length > 0}
            onResetFilters={() => {
              setUrgencyFilter('all');
              setKindFilter('all');
            }}
          />
        ) : (
          <ul className="divide-y divide-[#EADBCE]/70 dark:divide-[#2C1D18]">
            {filteredItems.map((item) => (
              <ShoppingListItemRow
                key={`${item.kind}-${item.id}`}
                item={item}
                onSelectPurchase={setSelectedItemForPurchase}
              />
            ))}
          </ul>
        )}

        {/* Pie con resumen */}
        {allNeededItems.length > 0 && (
          <div className="p-4 bg-[#FAF5ED]/70 dark:bg-[#1E1512] border-t border-[#EADBCE] dark:border-[#35251F] text-xs text-stone-600 dark:text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              💡 Al anotar la compra, el inventario se actualizará automáticamente según corresponda (Despensa, Catálogo, Empaques o Insumos Generales).
            </span>
            <span className="font-bold text-stone-800 dark:text-stone-200 shrink-0">
              Total: {counts.totalCount} ítems por reponer
            </span>
          </div>
        )}
      </div>

      {/* Modal de Registro de Compra */}
      <PurchaseItemModal
        isOpen={Boolean(selectedItemForPurchase)}
        item={selectedItemForPurchase}
        onClose={() => setSelectedItemForPurchase(null)}
        onConfirmPurchase={handleConfirmPurchase}
      />
    </div>
  );
};
