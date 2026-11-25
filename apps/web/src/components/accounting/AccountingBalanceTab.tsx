import React, { useMemo } from 'react';
import { BookOpen } from 'lucide-react';
import type { BalanceRow } from '../../types';
import { formatMoney } from '../../utils/formatters';
import { DataTable, type DataTableColumn } from '../common/DataTable';

interface AccountingBalanceTabProps {
  balance: BalanceRow[];
  onOpenLedgerForAccount: (accountId: string) => void;
}

export const AccountingBalanceTab: React.FC<AccountingBalanceTabProps> = ({
  balance,
  onOpenLedgerForAccount,
}) => {
  const columns = useMemo<DataTableColumn<BalanceRow>[]>(
    () => [
      {
        key: 'code',
        header: 'Código',
        headerClassName: 'py-3 px-4',
        cellClassName: 'py-2.5 px-4 font-mono font-bold',
        render: (row) => {
          const indentLevel = Math.max(0, (row.level ?? 1) - 1);
          return (
            <span
              style={{ paddingLeft: `${indentLevel * 14}px` }}
              className="inline-flex items-center gap-1.5"
            >
              {row.isGroup && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-sans uppercase">
                  N{row.level}
                </span>
              )}
              {row.code}
            </span>
          );
        },
      },
      {
        key: 'name',
        header: 'Cuenta',
        headerClassName: 'py-3 px-4',
        cellClassName: 'py-2.5 px-4 font-medium',
        render: (row) => {
          const indentLevel = Math.max(0, (row.level ?? 1) - 1);
          return (
            <span
              style={{ paddingLeft: `${indentLevel * 14}px` }}
              className="inline-block"
            >
              {row.name}
            </span>
          );
        },
      },
      {
        key: 'accountType',
        header: 'Tipo',
        headerClassName: 'py-3 px-4',
        cellClassName: 'py-2.5 px-4 uppercase text-[10px] text-stone-400',
        render: (row) => row.accountType,
      },
      {
        key: 'totalDebit',
        header: 'Total Debe',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName: 'py-2.5 px-4 text-right font-mono',
        render: (row) => formatMoney(row.totalDebit),
      },
      {
        key: 'totalCredit',
        header: 'Total Haber',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName: 'py-2.5 px-4 text-right font-mono',
        render: (row) => formatMoney(row.totalCredit),
      },
      {
        key: 'debitBalance',
        header: 'Saldo Deudor',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName:
          'py-2.5 px-4 text-right font-mono font-bold text-emerald-600',
        render: (row) => (row.debitBalance > 0 ? formatMoney(row.debitBalance) : '-'),
      },
      {
        key: 'creditBalance',
        header: 'Saldo Acreedor',
        headerClassName: 'py-3 px-4 text-right',
        cellClassName: 'py-2.5 px-4 text-right font-mono font-bold text-rose-600',
        render: (row) =>
          row.creditBalance > 0 ? formatMoney(row.creditBalance) : '-',
      },
      {
        key: 'ledger',
        header: 'Mayor',
        headerClassName: 'py-3 px-4 text-center',
        cellClassName: 'py-2.5 px-4 text-center',
        render: (row) =>
          !row.isGroup ? (
            <button
              type="button"
              onClick={() => onOpenLedgerForAccount(row.id)}
              title="Ver Libro Mayor de esta cuenta"
              className="p-1.5 rounded-lg text-stone-500 hover:text-[#8C1F25] hover:bg-stone-100 dark:hover:bg-[#201613] transition-colors inline-flex items-center justify-center cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-[10px] text-stone-400 font-mono">—</span>
          ),
      },
    ],
    [onOpenLedgerForAccount],
  );

  return (
    <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
      <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
        <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
          Balance de Comprobación y Saldos
        </h3>
        <p className="text-xs text-stone-500 mt-1">
          Sumas y saldos acumulados de todas las cuentas del catálogo. Haz clic en el botón de libro
          para abrir el Libro Mayor de cada cuenta.
        </p>
      </div>

      <DataTable
        columns={columns}
        data={balance}
        keyExtractor={(row) => row.id}
        tableClassName="w-full text-left text-xs border-collapse"
        headerRowClassName="bg-[#FAF5ED] dark:bg-[#201613] text-[10px] font-bold uppercase text-stone-700 dark:text-stone-300"
        rowClassName={(row) =>
          row.isGroup
            ? 'bg-stone-50/80 dark:bg-[#1E1714] font-semibold text-stone-900 dark:text-stone-100 border-t border-stone-200/60 dark:border-stone-800'
            : 'hover:bg-stone-50/50 dark:hover:bg-[#1A1310]'
        }
      />
    </div>
  );
};
