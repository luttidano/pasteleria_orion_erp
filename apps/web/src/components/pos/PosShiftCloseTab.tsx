import React from 'react';
import { CheckCircle2, Clock, Lock, Printer, RefreshCw } from 'lucide-react';
import type { PosActiveShiftOverview, PosShiftRecord } from '../../types';
import { formatChileDateTime, formatMoney } from '../../utils/formatters';

interface PosShiftCloseTabProps {
  shiftOverview: PosActiveShiftOverview;
  todayKey: string;
  shiftsHistory: PosShiftRecord[];
  lastReceiptShift: PosShiftRecord | null;
  isLoadingShift: boolean;
  openingCashInput: string;
  onOpeningCashInputChange: (value: string) => void;
  isSavingOpeningCash: boolean;
  isOpeningCashDirty: boolean;
  savedOpeningCash: number;
  expectedCashPreview: number;
  hasClosingActivity: boolean;
  onRefreshShift: () => void;
  onSaveOpeningCash: () => void;
  onOpenCloseModal: () => void;
  onPrintShift: (shift: PosShiftRecord) => void;
}

export const PosShiftCloseTab: React.FC<PosShiftCloseTabProps> = ({
  shiftOverview,
  todayKey,
  shiftsHistory,
  lastReceiptShift,
  isLoadingShift,
  openingCashInput,
  onOpeningCashInputChange,
  isSavingOpeningCash,
  isOpeningCashDirty,
  savedOpeningCash,
  expectedCashPreview,
  hasClosingActivity,
  onRefreshShift,
  onSaveOpeningCash,
  onOpenCloseModal,
  onPrintShift,
}) => {
  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Arqueo y Cierre de Turno de Caja
              </h3>
              {shiftOverview.hasOpenShift ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                  Turno #{shiftOverview.shiftNumber} Abierto
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-[#251A16] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-[#35251F]">
                  {shiftOverview.transactionsCount > 0
                    ? 'Movimientos Previos del Día'
                    : 'Caja Reiniciada ($0)'}
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              {shiftOverview.hasOpenShift && shiftOverview.openedAt
                ? `Abierto el ${formatChileDateTime(shiftOverview.openedAt)}${
                    shiftOverview.openedByName ? ` por ${shiftOverview.openedByName}` : ''
                  }. Al cerrar el arqueo los indicadores vuelven a $0.`
                : `Cuadratura del turno actual (${todayKey}). Al confirmar el cierre se emite el comprobante y la caja vuelve a $0.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onRefreshShift}
            disabled={isLoadingShift}
            className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2C1F1A] text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingShift ? 'animate-spin text-[#8C1F25]' : ''}`}
            />
            Actualizar
          </button>
        </div>

        {!shiftOverview.hasOpenShift &&
          shiftOverview.transactionsCount === 0 &&
          shiftOverview.lastClosedShift && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs">
                  <p className="font-bold text-emerald-900 dark:text-emerald-200">
                    Último arqueo registrado: Turno #{shiftOverview.lastClosedShift.shiftNumber}
                  </p>
                  <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                    Cerrado el {formatChileDateTime(shiftOverview.lastClosedShift.closedAt)} por{' '}
                    {shiftOverview.lastClosedShift.closedByName} • Ventas{' '}
                    {formatMoney(shiftOverview.lastClosedShift.totalSales)} • Contado{' '}
                    {formatMoney(shiftOverview.lastClosedShift.countedCash)}
                  </p>
                </div>
              </div>
              {(lastReceiptShift || shiftsHistory[0]) && (
                <button
                  type="button"
                  onClick={() => {
                    const target =
                      lastReceiptShift &&
                      lastReceiptShift.id === shiftOverview.lastClosedShift?.id
                        ? lastReceiptShift
                        : shiftsHistory[0];
                    if (target) {
                      onPrintShift(target);
                    }
                  }}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#16100E] border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer hover:bg-emerald-100/60"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Reimprimir Último Arqueo
                </button>
              )}
            </div>
          )}

        {/* Fondo Inicial Configurable de Gaveta */}
        <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#1C1411] border border-stone-200/80 dark:border-[#35251F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-stone-700 dark:text-stone-200 block">
              Fondo Inicial en Gaveta (Sencillo)
            </span>
            <span className="text-[11px] text-stone-500 dark:text-stone-400">
              Monto base en efectivo asignado al turno actual ({todayKey}). Se reinicia a $0 después
              de cada cierre.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-stone-500">$</span>
            <input
              type="number"
              min={0}
              step={500}
              value={openingCashInput}
              onChange={(e) => onOpeningCashInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  onSaveOpeningCash();
                }
              }}
              className="w-32 text-xs font-mono font-bold px-3 py-2 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-white dark:bg-[#16100E] text-right"
            />
            <button
              type="button"
              onClick={onSaveOpeningCash}
              disabled={isSavingOpeningCash || !isOpeningCashDirty}
              className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 dark:bg-[#8C1F25] dark:hover:bg-[#74191E] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
            >
              {isSavingOpeningCash ? 'Guardando...' : 'Guardar Fondo'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">
              Total Ventas Turno
            </span>
            <span className="text-2xl font-black text-stone-900 dark:text-white font-sans mt-1 block">
              {isLoadingShift ? '...' : formatMoney(shiftOverview.totalSales)}
            </span>
            <span className="text-[11px] text-emerald-600 font-semibold">
              {shiftOverview.transactionsCount} transacciones en turno actual
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">
              Efectivo en Gaveta
            </span>
            <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-sans mt-1 block">
              {isLoadingShift ? '...' : formatMoney(expectedCashPreview)}
            </span>
            <span className="text-[11px] text-stone-400">
              Fondo ({formatMoney(savedOpeningCash)}) + Ventas efectivo (
              {formatMoney(shiftOverview.cashSalesTotal)})
            </span>
          </div>

          <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
            <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">
              Tarjetas y POS Electrónico
            </span>
            <span className="text-2xl font-black text-[#8C1F25] dark:text-[#E8A598] font-sans mt-1 block">
              {isLoadingShift ? '...' : formatMoney(shiftOverview.cardPosTotal)}
            </span>
            <span className="text-[11px] text-stone-400">
              Débito ({formatMoney(shiftOverview.debitTotal)}) • Crédito (
              {formatMoney(shiftOverview.creditTotal)})
              {shiftOverview.transferTotal > 0
                ? ` • Transf. (${formatMoney(shiftOverview.transferTotal)})`
                : ''}
            </span>
          </div>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-stone-400" />
            {isOpeningCashDirty
              ? 'Guarda el cambio en el Fondo Inicial antes de cerrar el turno.'
              : hasClosingActivity
                ? 'El comprobante de arqueo se emite al cerrar el turno y queda guardado en el historial.'
                : 'Registra una venta o asigna un fondo inicial para poder cerrar el turno.'}
          </span>
          <button
            type="button"
            onClick={onOpenCloseModal}
            disabled={isLoadingShift || !hasClosingActivity || isOpeningCashDirty}
            className="px-6 py-3 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs sm:text-sm font-bold shadow-btn transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Lock className="w-4 h-4" />
            <span>Arqueo y Cerrar Turno</span>
          </button>
        </div>
      </div>

      {/* HISTORIAL DE ARQUEOS CERRADOS */}
      <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
          <div>
            <h4 className="text-base sm:text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Historial de Arqueos y Cierres de Caja
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Comprobantes cerrados por turno, diferencia física en gaveta y respaldo contable.
            </p>
          </div>
          <span className="text-xs font-mono text-stone-500">
            {shiftsHistory.length} cierre{shiftsHistory.length === 1 ? '' : 's'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-[11px] font-bold uppercase text-stone-700 dark:text-stone-300">
                <th className="py-3 px-3">Turno</th>
                <th className="py-3 px-3">Cierre</th>
                <th className="py-3 px-3">Responsable</th>
                <th className="py-3 px-3 text-right">Ventas</th>
                <th className="py-3 px-3 text-right">Efectivo Esp. / Real</th>
                <th className="py-3 px-3 text-right">POS / Transf.</th>
                <th className="py-3 px-3 text-right">Diferencia</th>
                <th className="py-3 px-3 text-center">Contab.</th>
                <th className="py-3 px-3 text-center">Comprobante</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
              {isLoadingShift ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500 text-xs">
                    Cargando historial de arqueos...
                  </td>
                </tr>
              ) : shiftsHistory.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-stone-500 text-xs">
                    Aún no hay cierres de turno registrados. Al cerrar este turno aparecerá aquí.
                  </td>
                </tr>
              ) : (
                shiftsHistory.map((s) => {
                  const diff = Number(s.cashDifference ?? 0);
                  const isZeroDiff = Math.abs(diff) < 0.01;
                  const posPlusTransfer = s.cardPosTotal + s.transferTotal;
                  return (
                    <tr
                      key={s.id}
                      className="hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors"
                    >
                      <td className="py-3 px-3 font-bold text-[#8C1F25] dark:text-[#E8A598]">
                        #{s.shiftNumber}
                        <span className="block text-[10px] font-normal text-stone-400">
                          {s.transactionsCount} vta{s.transactionsCount === 1 ? '' : 's'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-xs text-stone-600 dark:text-stone-300 font-mono">
                        {s.closedAt ? formatChileDateTime(s.closedAt) : '-'}
                      </td>
                      <td className="py-3 px-3 text-xs font-medium text-stone-700 dark:text-stone-300">
                        {s.closedBy?.name || s.openedBy?.name || 'Cajero'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold font-sans">
                        {formatMoney(s.totalSales)}
                      </td>
                      <td className="py-3 px-3 text-right text-xs font-mono">
                        <span className="text-stone-500 block">
                          Esp: {formatMoney(s.expectedCash)}
                        </span>
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          Real: {formatMoney(s.countedCash ?? s.expectedCash)}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right text-xs font-mono text-stone-700 dark:text-stone-300">
                        {formatMoney(posPlusTransfer)}
                      </td>
                      <td className="py-3 px-3 text-right text-xs font-bold font-mono">
                        <span
                          className={
                            isZeroDiff
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : diff > 0
                                ? 'text-sky-700 dark:text-sky-400'
                                : 'text-rose-700 dark:text-rose-400'
                          }
                        >
                          {isZeroDiff
                            ? '$0'
                            : diff > 0
                              ? `+${formatMoney(diff)}`
                              : formatMoney(-Math.abs(diff))}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {s.accountingStatus === 'posted' && s.closingEntryNumber ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                            Asiento #{s.closingEntryNumber}
                          </span>
                        ) : s.accountingStatus === 'pending' ? (
                          <span
                            title={s.accountingWarning || 'Ajuste contable pendiente'}
                            className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                          >
                            Pendiente
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-[#251A16] text-stone-500">
                            Cuadrada
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => onPrintShift(s)}
                          className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-[#261A16] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Printer className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
                          <span>Reimprimir</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

