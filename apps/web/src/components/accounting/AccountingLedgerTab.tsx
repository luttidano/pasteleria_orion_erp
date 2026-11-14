import React from 'react';
import { Calendar, LoaderCircle, RefreshCw } from 'lucide-react';
import type { AccountLedgerData, AccountingAccount } from '../../types';
import { formatMoney } from '../../utils/formatters';

interface AccountingLedgerTabProps {
  accounts: AccountingAccount[];
  selectedAccountId: string;
  onSelectAccount: (accountId: string) => void;
  startDate: string;
  onStartDateChange: (value: string) => void;
  endDate: string;
  onEndDateChange: (value: string) => void;
  onApplyPreset: (monthsAgo: number | null) => void;
  ledgerData: AccountLedgerData | null;
  isLoading: boolean;
  onRefresh: () => void;
}

export const AccountingLedgerTab: React.FC<AccountingLedgerTabProps> = ({
  accounts,
  selectedAccountId,
  onSelectAccount,
  startDate,
  onStartDateChange,
  endDate,
  onEndDateChange,
  onApplyPreset,
  ledgerData,
  isLoading,
  onRefresh,
}) => {
  return (
    <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
        <div>
          <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
            Libro Mayor (General Ledger)
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Extracto analítico de movimientos, saldo acumulado y formato de Cuenta T por cuenta
            contable.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-[#201613] text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Barra de Filtros */}
      <div className="p-4 rounded-2xl bg-stone-50/70 dark:bg-[#1C1411]/50 border border-stone-200/80 dark:border-[#35251F] space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
              Cuenta Contable a Mayorizar
            </label>
            <select
              value={selectedAccountId}
              onChange={(e) => onSelectAccount(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E] font-medium"
            >
              <option value="">Selecciona una cuenta...</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  [{acc.code}] {acc.name} — ({acc.accountType.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
              Fecha Inicio (Desde)
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
            />
          </div>

          <div>
            <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
              Fecha Fin (Hasta)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
            />
          </div>
        </div>

        {/* Accesos rápidos de meses */}
        <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-200/50 dark:border-[#2C1F1A]">
          <span className="text-[11px] text-stone-400 font-medium mr-1 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" /> Accesos rápidos:
          </span>
          <button
            type="button"
            onClick={() => onApplyPreset(0)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-700 dark:text-stone-300 hover:border-[#8C1F25] transition-colors cursor-pointer"
          >
            Mes Actual
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset(1)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-700 dark:text-stone-300 hover:border-[#8C1F25] transition-colors cursor-pointer"
          >
            Mes Anterior
          </button>
          <button
            type="button"
            onClick={() => onApplyPreset(null)}
            className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-700 dark:text-stone-300 hover:border-[#8C1F25] transition-colors cursor-pointer"
          >
            Historial Completo
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-12 text-stone-400 space-y-2">
          <LoaderCircle className="w-6 h-6 animate-spin text-[#8C1F25]" />
          <span className="text-xs">Extrayendo movimientos del Libro Mayor...</span>
        </div>
      ) : !ledgerData ? (
        <div className="text-center py-12 text-stone-400 text-xs">
          Selecciona una cuenta contable para ver su Libro Mayor.
        </div>
      ) : (
        <div className="space-y-6 animate-fade-in">
          {/* Tarjeta Visual: Cuenta T */}
          <div className="p-5 rounded-2xl border border-stone-200/80 dark:border-[#35251F] bg-stone-50/50 dark:bg-[#1C1411]/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-200/60 dark:border-[#2C1F1A] pb-3">
              <div>
                <span className="font-mono text-xs font-bold text-stone-400 mr-2">
                  CUENTA {ledgerData.account.code}
                </span>
                <h4 className="inline text-base font-bold text-[#2A1B16] dark:text-[#FDF5EE]">
                  {ledgerData.account.name}
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-stone-200 dark:bg-[#2C1F1A] text-stone-700 dark:text-stone-300">
                  {ledgerData.account.accountType}
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                    ledgerData.account.nature === 'deudora'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                  }`}
                >
                  Naturaleza {ledgerData.account.nature}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-white dark:bg-[#16100E] border-t-4 border-emerald-500 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  DEBE (Total Débitos)
                </span>
                <span className="text-2xl font-mono font-bold text-stone-900 dark:text-white">
                  {formatMoney(ledgerData.totalDebit)}
                </span>
                <p className="text-[11px] text-stone-500">
                  {ledgerData.account.nature === 'deudora'
                    ? 'Aumentos de saldo en el período'
                    : 'Disminuciones de saldo en el período'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-white dark:bg-[#16100E] border-t-4 border-rose-500 shadow-xs space-y-1">
                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                  HABER (Total Créditos)
                </span>
                <span className="text-2xl font-mono font-bold text-stone-900 dark:text-white">
                  {formatMoney(ledgerData.totalCredit)}
                </span>
                <p className="text-[11px] text-stone-500">
                  {ledgerData.account.nature === 'deudora'
                    ? 'Disminuciones de saldo en el período'
                    : 'Aumentos de saldo en el período'}
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-200/60 dark:border-[#2C1F1A] text-xs">
              <div className="flex items-center gap-2">
                <span className="text-stone-500 font-medium">
                  Saldo Inicial al {ledgerData.period.startDate || 'inicio'}:
                </span>
                <span className="font-mono font-bold">
                  {formatMoney(ledgerData.initialBalance)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-stone-500 font-medium">Saldo Final acumulado:</span>
                <span
                  className={`font-mono text-sm font-bold px-3 py-1 rounded-xl ${
                    ledgerData.finalBalanceType === 'deudor'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {formatMoney(ledgerData.finalBalance)} (
                  {ledgerData.finalBalanceType.toUpperCase()})
                </span>
              </div>
            </div>
          </div>

          {/* Tabla de Movimientos Cronológicos */}
          <div className="overflow-x-auto rounded-2xl border border-stone-200/80 dark:border-[#35251F]">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#FAF5ED] dark:bg-[#201613] text-[10px] font-bold uppercase text-stone-700 dark:text-stone-300 border-b border-stone-200 dark:border-[#35251F]">
                  <th className="py-3 px-4">Fecha</th>
                  <th className="py-3 px-4">Asiento #</th>
                  <th className="py-3 px-4">Concepto / Glosa</th>
                  <th className="py-3 px-4">Detalle Línea</th>
                  <th className="py-3 px-4 text-right">DEBE</th>
                  <th className="py-3 px-4 text-right">HABER</th>
                  <th className="py-3 px-4 text-right">Saldo Progresivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                {ledgerData.period.startDate && (
                  <tr className="bg-stone-50/40 dark:bg-[#1C1411]/40 text-stone-500 font-medium">
                    <td className="py-2.5 px-4 font-mono">{ledgerData.period.startDate}</td>
                    <td className="py-2.5 px-4">-</td>
                    <td className="py-2.5 px-4 italic font-semibold text-stone-600 dark:text-stone-300">
                      Saldo Inicial al inicio del período
                    </td>
                    <td className="py-2.5 px-4">-</td>
                    <td className="py-2.5 px-4 text-right font-mono">-</td>
                    <td className="py-2.5 px-4 text-right font-mono">-</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-700 dark:text-stone-200">
                      {formatMoney(ledgerData.initialBalance)}
                    </td>
                  </tr>
                )}

                {ledgerData.movements.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-400">
                      No se registraron movimientos para esta cuenta en el rango de fechas
                      seleccionado.
                    </td>
                  </tr>
                ) : (
                  ledgerData.movements.map((mov) => (
                    <tr
                      key={mov.id}
                      className="hover:bg-stone-50/50 dark:hover:bg-[#1C1411]/50"
                    >
                      <td className="py-2.5 px-4 font-mono text-stone-500">{mov.entryDate}</td>
                      <td className="py-2.5 px-4 font-mono font-bold text-[#8C1F25]">
                        #{mov.entryNumber}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-stone-800 dark:text-stone-100">
                        {mov.concept}
                      </td>
                      <td className="py-2.5 px-4 text-stone-500 max-w-xs truncate">
                        {mov.description || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                        {mov.debit > 0 ? formatMoney(mov.debit) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                        {mov.credit > 0 ? formatMoney(mov.credit) : '-'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-900 dark:text-white bg-stone-50/30 dark:bg-[#201613]/30">
                        {formatMoney(mov.runningBalance)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

