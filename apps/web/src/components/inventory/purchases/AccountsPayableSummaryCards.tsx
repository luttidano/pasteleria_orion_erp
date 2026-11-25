import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, CreditCard } from 'lucide-react';
import type { AccountsPayableSummary } from '../../../types';
import { formatMoney } from '../../../utils/formatters';

interface AccountsPayableSummaryCardsProps {
  summary: AccountsPayableSummary | null;
}

/**
 * Tarjetas KPI de liquidez y vencimientos para Cuentas por Pagar.
 */
export const AccountsPayableSummaryCards: React.FC<
  AccountsPayableSummaryCardsProps
> = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-3xl bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase text-stone-500">
            Deuda Total Proveedores
          </span>
          <div className="w-8 h-8 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 flex items-center justify-center">
            <CreditCard className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black font-mono text-stone-900 dark:text-white">
          {formatMoney(summary?.totalDebt ?? 0)}
        </span>
        <p className="text-[11px] text-stone-400 mt-1">
          {summary?.pendingInvoicesCount ?? 0} factura(s) por pagar
        </p>
      </div>

      <div className="p-4 rounded-3xl bg-rose-50/50 dark:bg-rose-950/15 border border-rose-200/80 dark:border-rose-900/40 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase text-rose-700 dark:text-rose-400">
            Facturas Vencidas
          </span>
          <div className="w-8 h-8 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black font-mono text-rose-700 dark:text-rose-400">
          {formatMoney(summary?.overdueDebt ?? 0)}
        </span>
        <p className="text-[11px] text-rose-600 dark:text-rose-400/80 mt-1">
          {summary?.overdueInvoicesCount ?? 0} vencida(s) - Prioridad pago
        </p>
      </div>

      <div className="p-4 rounded-3xl bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200/80 dark:border-amber-900/40 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase text-amber-800 dark:text-amber-400">
            Por Vencer (7 días)
          </span>
          <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-400 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black font-mono text-amber-800 dark:text-amber-400">
          {formatMoney(summary?.upcomingDebt ?? 0)}
        </span>
        <p className="text-[11px] text-amber-700 dark:text-amber-400/80 mt-1">
          Vencimientos de esta semana
        </p>
      </div>

      <div className="p-4 rounded-3xl bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-200/80 dark:border-emerald-900/40 shadow-xs">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-bold uppercase text-emerald-800 dark:text-emerald-400">
            Al Día (&gt; 7 días)
          </span>
          <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <span className="text-2xl font-black font-mono text-emerald-800 dark:text-emerald-400">
          {formatMoney(summary?.currentDebt ?? 0)}
        </span>
        <p className="text-[11px] text-emerald-700 dark:text-emerald-400/80 mt-1">
          Crédito con plazo holgado
        </p>
      </div>
    </div>
  );
};
