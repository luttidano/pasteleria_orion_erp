import React, { useMemo } from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import type { Ingredient } from '../../../types';
import { DataTable, type DataTableColumn } from '../../common/DataTable';
import { IngredientStockStatusBadge } from './IngredientStockStatusBadge';

interface IngredientTableProps {
  items: Ingredient[];
  isAdmin: boolean;
  onAdjustStock: (item: Ingredient, delta: number) => void;
  onEdit: (item: Ingredient) => void;
  onDelete: (item: Ingredient) => void;
}

/**
 * Vista tabular compacta de ingredientes para revisión rápida.
 */
export const IngredientTable: React.FC<IngredientTableProps> = ({
  items,
  isAdmin,
  onAdjustStock,
  onEdit,
  onDelete,
}) => {
  const columns = useMemo<DataTableColumn<Ingredient>[]>(() => {
    const base: DataTableColumn<Ingredient>[] = [
      {
        key: 'name',
        header: 'Ingrediente',
        headerClassName: 'py-4 px-6',
        cellClassName: 'py-4 px-6',
        render: (item) => (
          <div className="flex items-center gap-3">
            <span className="text-2xl select-none">{item.icon || '🌾'}</span>
            <div>
              <div className="font-bold text-stone-900 dark:text-[#FAF3EC]">
                {item.name}
              </div>
              {item.description && (
                <div className="text-xs text-stone-400 mt-0.5">
                  {item.description}
                </div>
              )}
            </div>
          </div>
        ),
      },
      {
        key: 'category',
        header: 'Categoría',
        headerClassName: 'py-4 px-4',
        cellClassName: 'py-4 px-4 text-xs font-semibold text-stone-600 dark:text-stone-400',
        render: (item) => item.category,
      },
      {
        key: 'stock',
        header: 'Existencia',
        headerClassName: 'py-4 px-4 text-center',
        cellClassName: 'py-4 px-4 text-center',
        render: (item) => (
          <>
            <div className="inline-flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAdjustStock(item, -1)}
                disabled={item.stock <= 0}
                className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#281C17] hover:bg-stone-200 dark:hover:bg-[#35251F] text-stone-800 dark:text-stone-200 flex items-center justify-center text-xs disabled:opacity-30 cursor-pointer"
              >
                -
              </button>
              <span className="font-extrabold text-base font-sans min-w-[70px] text-center text-stone-900 dark:text-white">
                {item.stock} {item.unit}
              </span>
              <button
                type="button"
                onClick={() => onAdjustStock(item, 1)}
                className="w-7 h-7 rounded-lg bg-stone-100 dark:bg-[#281C17] hover:bg-stone-200 dark:hover:bg-[#35251F] text-stone-800 dark:text-stone-200 flex items-center justify-center text-xs cursor-pointer"
              >
                +
              </button>
            </div>
            <div className="text-[10px] text-stone-400 dark:text-stone-500 mt-0.5">
              Mínimo: {item.minStock} {item.unit}
            </div>
          </>
        ),
      },
      {
        key: 'status',
        header: 'Estado',
        headerClassName: 'py-4 px-4',
        cellClassName: 'py-4 px-4',
        render: (item) => (
          <IngredientStockStatusBadge
            stock={item.stock}
            minStock={item.minStock}
            compact
          />
        ),
      },
    ];

    if (isAdmin) {
      base.push({
        key: 'actions',
        header: 'Opciones',
        headerClassName: 'py-4 px-6 text-right',
        cellClassName: 'py-4 px-6 text-right',
        render: (item) => (
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => onEdit(item)}
              className="p-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white rounded-lg hover:bg-stone-100 dark:hover:bg-[#201613] cursor-pointer"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(item)}
              className="p-1.5 text-rose-500 hover:text-rose-700 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      });
    }

    return base;
  }, [isAdmin, onAdjustStock, onEdit, onDelete]);

  return (
    <div className="bg-white dark:bg-[#16100E] rounded-[22px] border border-[#DFCAA9] dark:border-[#35251F] shadow-xs overflow-hidden">
      <DataTable
        columns={columns}
        data={items}
        keyExtractor={(item) => item.id}
        containerClassName="overflow-x-auto"
        rowClassName={() => 'hover:bg-stone-50/70 dark:hover:bg-[#201613]/60'}
      />
    </div>
  );
};
