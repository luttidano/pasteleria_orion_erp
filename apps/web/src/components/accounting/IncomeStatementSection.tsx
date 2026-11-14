import React from 'react';
import type { IncomeStatementData } from '../../types';
import { formatMoney } from '../../utils/formatters';

interface IncomeStatementSectionProps {
  incomeStatement: IncomeStatementData;
}

export const IncomeStatementSection: React.FC<IncomeStatementSectionProps> = ({
  incomeStatement,
}) => {
  return (
    <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
        <div>
          <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
            Estado de Resultados (P&L / Pérdidas y Ganancias)
          </h4>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Estructura contable formal: Ingresos − Costos = Margen Bruto − Gastos = Utilidad Neta
          </p>
        </div>
        <div className="text-xs text-stone-500 font-mono">
          Período: {incomeStatement.period.startDate || 'Inicio'} al{' '}
          {incomeStatement.period.endDate || 'Hoy'}
        </div>
      </div>

      {/* Cascada Financiera */}
      <div className="space-y-4">
        {/* 1. Ingresos Operacionales */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
          <div className="bg-emerald-50/60 dark:bg-emerald-950/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 flex items-center justify-center font-bold text-xs">
                +
              </span>
              <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                1. Ingresos Operacionales
              </span>
            </div>
            <span className="font-mono font-bold text-base text-emerald-700 dark:text-emerald-400">
              {formatMoney(incomeStatement.ingresosOperacionales.total)}
            </span>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
            {incomeStatement.ingresosOperacionales.accounts.length === 0 ? (
              <div className="px-4 py-3 text-xs text-stone-400 italic">
                No se registran movimientos de ingresos en el período.
              </div>
            ) : (
              incomeStatement.ingresosOperacionales.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="px-4 py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-stone-400 text-[11px]">{acc.code}</span>
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {acc.name}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                    {formatMoney(acc.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Costos de Materias Primas */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
          <div className="bg-amber-50/60 dark:bg-amber-950/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 flex items-center justify-center font-bold text-xs">
                −
              </span>
              <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                2. Costos de Materias Primas e Insumos
              </span>
            </div>
            <span className="font-mono font-bold text-base text-amber-700 dark:text-amber-400">
              {formatMoney(incomeStatement.costosMateriasPrimas.total)}
            </span>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
            {incomeStatement.costosMateriasPrimas.accounts.length === 0 ? (
              <div className="px-4 py-3 text-xs text-stone-400 italic">
                No se registran costos de materias primas directos en el período.
              </div>
            ) : (
              incomeStatement.costosMateriasPrimas.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="px-4 py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-stone-400 text-[11px]">{acc.code}</span>
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {acc.name}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                    {formatMoney(acc.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Subtotal: MARGEN BRUTO */}
        <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border-2 border-[#EADBCE] dark:border-[#35251F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs uppercase font-bold text-stone-500 tracking-wider">
              (=) Margen Bruto Operacional
            </span>
            <p className="text-xs text-stone-500">
              Ingresos Operacionales − Costos de Materias Primas
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black font-mono text-[#8C1F25] dark:text-[#E8A598]">
              {formatMoney(incomeStatement.margenBruto)}
            </span>
            <span className="block text-[11px] font-bold text-stone-500 font-mono">
              {incomeStatement.margenBrutoPercentage}% de las ventas
            </span>
          </div>
        </div>

        {/* 3. Gastos Operacionales */}
        <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
          <div className="bg-rose-50/60 dark:bg-rose-950/20 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-rose-100 dark:bg-rose-900/40 text-rose-700 flex items-center justify-center font-bold text-xs">
                −
              </span>
              <span className="font-bold text-sm text-stone-900 dark:text-stone-100">
                3. Gastos Operacionales (Sueldos, Luz, Arriendo, Servicios)
              </span>
            </div>
            <span className="font-mono font-bold text-base text-rose-700 dark:text-rose-400">
              {formatMoney(incomeStatement.gastosOperacionales.total)}
            </span>
          </div>

          <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
            {incomeStatement.gastosOperacionales.accounts.length === 0 ? (
              <div className="px-4 py-3 text-xs text-stone-400 italic">
                No se registran gastos operativos en el período.
              </div>
            ) : (
              incomeStatement.gastosOperacionales.accounts.map((acc) => (
                <div
                  key={acc.id}
                  className="px-4 py-2.5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-stone-400 text-[11px]">{acc.code}</span>
                    <span className="font-medium text-stone-800 dark:text-stone-200">
                      {acc.name}
                    </span>
                  </div>
                  <span className="font-mono font-semibold text-stone-900 dark:text-stone-100">
                    {formatMoney(acc.amount)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Total Final: UTILIDAD NETA */}
        <div
          className={`p-5 rounded-2xl border-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            incomeStatement.utilidadNeta >= 0
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-950 dark:text-emerald-100'
              : 'bg-rose-500/10 border-rose-500/40 text-rose-950 dark:text-rose-100'
          }`}
        >
          <div>
            <span className="text-xs uppercase font-extrabold tracking-wider block">
              (=) Utilidad Neta del Ejercicio
            </span>
            <p className="text-xs opacity-80 mt-0.5">
              Margen Bruto − Gastos Operacionales (Superávit contable final)
            </p>
          </div>
          <div className="text-right">
            <span
              className={`text-3xl font-black font-mono block ${
                incomeStatement.utilidadNeta >= 0
                  ? 'text-emerald-700 dark:text-emerald-400'
                  : 'text-rose-700 dark:text-rose-400'
              }`}
            >
              {formatMoney(incomeStatement.utilidadNeta)}
            </span>
            <span className="text-xs font-bold font-mono opacity-80">
              Margen Neto: {incomeStatement.margenNetoPercentage}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

