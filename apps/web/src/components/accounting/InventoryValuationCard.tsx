import React, { useMemo } from 'react';
import type { BalanceSheetData } from '../../types';
import { formatMoney, formatQuantity } from '../../utils/formatters';
import { DataTable, type DataTableColumn } from '../common/DataTable';

type InventoryValuationItem =
  BalanceSheetData['inventoryValuation']['topRawMaterials'][number];

interface InventoryValuationCardProps {
  title: string;
  totalValue: number;
  items?: InventoryValuationItem[];
  itemHeaderLabel: string;
  costHeaderLabel?: string;
  totalHeaderLabel?: string;
  emptyLabel: string;
  headerClassName: string;
}

/**
 * Tarjeta reutilizable de valorización de stock en bodega basada en DataTable.
 */
export const InventoryValuationCard: React.FC<InventoryValuationCardProps> = ({
  title,
  totalValue,
  items = [],
  itemHeaderLabel,
  costHeaderLabel = 'Costo Unit.',
  totalHeaderLabel = 'Valor Total',
  emptyLabel,
  headerClassName,
}) => {
  const columns = useMemo<DataTableColumn<InventoryValuationItem>[]>(
    () => [
      {
        key: 'name',
        header: itemHeaderLabel,
        headerClassName: 'py-2 px-3',
        cellClassName:
          'py-2 px-3 font-medium text-stone-800 dark:text-stone-200',
        render: (item) => item.name,
      },
      {
        key: 'stock',
        header: 'Stock',
        headerClassName: 'py-2 px-3 text-right',
        cellClassName:
          'py-2 px-3 text-right font-mono text-stone-600 dark:text-stone-400',
        render: (item) => `${formatQuantity(item.stock)} ${item.unit}`,
      },
      {
        key: 'unitCost',
        header: costHeaderLabel,
        headerClassName: 'py-2 px-3 text-right',
        cellClassName:
          'py-2 px-3 text-right font-mono text-stone-600 dark:text-stone-400',
        render: (item) => formatMoney(item.unitCost),
      },
      {
        key: 'totalValue',
        header: totalHeaderLabel,
        headerClassName: 'py-2 px-3 text-right',
        cellClassName:
          'py-2 px-3 text-right font-mono font-bold text-stone-900 dark:text-stone-100',
        render: (item) => formatMoney(item.totalValue),
      },
    ],
    [itemHeaderLabel, costHeaderLabel, totalHeaderLabel],
  );

  return (
    <div className="space-y-3">
      <div
        className={`flex items-center justify-between p-3 rounded-xl ${headerClassName}`}
      >
        <span className="font-bold text-xs">{title}</span>
        <span className="font-mono font-bold text-sm">
          {formatMoney(totalValue)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-stone-800">
        <DataTable
          columns={columns}
          data={items}
          keyExtractor={(item) => item.id}
          tableClassName="w-full text-left text-xs border-collapse"
          headerRowClassName="bg-stone-50 dark:bg-[#1E1512] text-[10px] uppercase font-bold text-stone-500"
          bodyClassName="divide-y divide-stone-100 dark:divide-stone-800"
          rowClassName={() => 'hover:bg-stone-50/50'}
          emptyState={emptyLabel}
        />
      </div>
    </div>
  );
};
