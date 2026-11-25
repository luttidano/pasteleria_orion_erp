import React from 'react';
import { Loader2 } from 'lucide-react';

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  headerClassName?: string;
  cellClassName?: string;
  render: (row: T, index: number) => React.ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  loadingLabel?: string;
  emptyState?: React.ReactNode;
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  containerClassName?: string;
  tableClassName?: string;
  headerRowClassName?: string;
  bodyClassName?: string;
  renderExpandedRow?: (row: T, index: number) => React.ReactNode;
  footerContent?: React.ReactNode;
}

/**
 * Tabla de datos genérica y tipada para homogeneizar listados, historiales y reportes en el ERP.
 */
export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  loadingLabel = 'Cargando registros...',
  emptyState,
  onRowClick,
  rowClassName,
  containerClassName = 'overflow-x-auto',
  tableClassName = 'w-full text-left border-collapse text-sm',
  headerRowClassName = 'bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300',
  bodyClassName = 'divide-y divide-stone-100 dark:divide-[#281C17]',
  renderExpandedRow,
  footerContent,
}: DataTableProps<T>) {
  return (
    <div className={containerClassName}>
      <table className={tableClassName}>
        <thead>
          <tr className={headerRowClassName}>
            {columns.map((col) => (
              <th key={col.key} className={col.headerClassName ?? 'py-3 px-4'}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={bodyClassName}>
          {isLoading ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-10 text-center text-stone-500 text-sm"
              >
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[#8C1F25]" />
                  {loadingLabel}
                </span>
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="py-8 text-center text-stone-500 text-sm"
              >
                {emptyState ?? 'No hay registros disponibles.'}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const expandedContent = renderExpandedRow?.(row, idx);
              return (
                <React.Fragment key={keyExtractor(row, idx)}>
                  <tr
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={`${
                      onRowClick ? 'cursor-pointer ' : ''
                    }hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors ${
                      rowClassName ? rowClassName(row) : ''
                    }`}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={col.cellClassName ?? 'py-3 px-4'}
                      >
                        {col.render(row, idx)}
                      </td>
                    ))}
                  </tr>
                  {expandedContent}
                </React.Fragment>
              );
            })
          )}
        </tbody>
        {footerContent}
      </table>
    </div>
  );
}
