import React from 'react';
import { BookOpen } from 'lucide-react';
import type { BalanceRow } from '../../types';
import { formatMoney } from '../../utils/formatters';

interface AccountingBalanceTabProps {
  balance: BalanceRow[];
  onOpenLedgerForAccount: (accountId: string) => void;
}

export const AccountingBalanceTab: React.FC<AccountingBalanceTabProps> = ({
  balance,
  onOpenLedgerForAccount,
}) => {
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

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-[#FAF5ED] dark:bg-[#201613] text-[10px] font-bold uppercase text-stone-700 dark:text-stone-300">
              <th className="py-3 px-4">Código</th>
              <th className="py-3 px-4">Cuenta</th>
              <th className="py-3 px-4">Tipo</th>
              <th className="py-3 px-4 text-right">Total Debe</th>
              <th className="py-3 px-4 text-right">Total Haber</th>
              <th className="py-3 px-4 text-right">Saldo Deudor</th>
              <th className="py-3 px-4 text-right">Saldo Acreedor</th>
              <th className="py-3 px-4 text-center">Mayor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
            {balance.map((row) => (
              <tr key={row.id} className="hover:bg-stone-50/50">
                <td className="py-2.5 px-4 font-mono font-bold">{row.code}</td>
                <td className="py-2.5 px-4 font-medium">{row.name}</td>
                <td className="py-2.5 px-4 uppercase text-[10px] text-stone-400">
                  {row.accountType}
                </td>
                <td className="py-2.5 px-4 text-right font-mono">
                  {formatMoney(row.totalDebit)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono">
                  {formatMoney(row.totalCredit)}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                  {row.debitBalance > 0 ? formatMoney(row.debitBalance) : '-'}
                </td>
                <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                  {row.creditBalance > 0 ? formatMoney(row.creditBalance) : '-'}
                </td>
                <td className="py-2.5 px-4 text-center">
                  <button
                    type="button"
                    onClick={() => onOpenLedgerForAccount(row.id)}
                    title="Ver Libro Mayor de esta cuenta"
                    className="p-1.5 rounded-lg text-stone-500 hover:text-[#8C1F25] hover:bg-stone-100 dark:hover:bg-[#201613] transition-colors inline-flex items-center justify-center cursor-pointer"
                  >
                    <BookOpen className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

