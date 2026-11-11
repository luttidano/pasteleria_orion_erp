import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle,
  Calendar,
  CalendarCheck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  LoaderCircle,
  Lock,
  LockOpen,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type {
  AccountingPeriod,
  AccountingYearOverview,
  AnnualClosingPreview,
  ToastMessage,
} from '../../types';
import { accountingPeriodService } from '../../services/accountingPeriodService';

interface AccountingPeriodsTabProps {
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const formatMoney = (val: number): string =>
  Math.round(val).toLocaleString('es-CL');

const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('es-CL', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso.slice(0, 10);
  }
};

export const AccountingPeriodsTab: React.FC<AccountingPeriodsTabProps> = ({ addToast }) => {
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [overview, setOverview] = useState<AccountingYearOverview | null>(null);
  const [preview, setPreview] = useState<AnnualClosingPreview | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal confirmar cierre o reapertura mensual
  const [periodModal, setPeriodModal] = useState<{
    action: 'close' | 'reopen';
    period: AccountingPeriod;
  } | null>(null);
  const [periodNotes, setPeriodNotes] = useState('');
  const [submittingPeriod, setSubmittingPeriod] = useState(false);

  // Modales Cierre Anual (ejecutar o reversar)
  const [showClosingModal, setShowClosingModal] = useState(false);
  const [closingNotes, setClosingNotes] = useState('');
  const [executingClosing, setExecutingClosing] = useState(false);

  const [showReverseModal, setShowReverseModal] = useState(false);
  const [reverseReason, setReverseReason] = useState('');
  const [reversingClosing, setReversingClosing] = useState(false);

  // Fecha mínima global de inicio contable (apertura del negocio en ERP)
  const [startDateInput, setStartDateInput] = useState('');
  const [savingStartDate, setSavingStartDate] = useState(false);

  const loadData = useCallback(
    async (yearToLoad = selectedYear) => {
      setLoading(true);
      try {
        const [ov, prev] = await Promise.all([
          accountingPeriodService.getYearOverview(yearToLoad),
          accountingPeriodService.previewAnnualClosing(yearToLoad),
        ]);
        setOverview(ov);
        setPreview(prev);
        setStartDateInput(ov.accountingStartDate ?? '');
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Error cargando períodos contables',
          message: err instanceof Error ? err.message : 'No se pudo obtener el estado del ejercicio.',
        });
      } finally {
        setLoading(false);
      }
    },
    [selectedYear, addToast],
  );

  useEffect(() => {
    void loadData(selectedYear);
  }, [selectedYear, loadData]);

  const handleConfirmPeriodAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!periodModal) return;

    setSubmittingPeriod(true);
    try {
      const payload = {
        year: periodModal.period.year,
        month: periodModal.period.month,
        ...(periodNotes.trim() ? { notes: periodNotes.trim() } : {}),
      };

      if (periodModal.action === 'close') {
        await accountingPeriodService.closePeriod(payload);
        addToast({
          type: 'success',
          title: 'Período cerrado',
          message: `${periodModal.period.monthLabel} ${periodModal.period.year} quedó bloqueado para nuevos asientos y anulaciones.`,
        });
      } else {
        await accountingPeriodService.reopenPeriod(payload);
        addToast({
          type: 'info',
          title: 'Período reabierto',
          message: `${periodModal.period.monthLabel} ${periodModal.period.year} vuelve a aceptar movimientos contables.`,
        });
      }

      setPeriodModal(null);
      setPeriodNotes('');
      await loadData(selectedYear);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Acción rechazada',
        message: err instanceof Error ? err.message : 'No se pudo actualizar el estado del período.',
      });
    } finally {
      setSubmittingPeriod(false);
    }
  };

  const handleExecuteAnnualClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    setExecutingClosing(true);
    try {
      const res = await accountingPeriodService.executeAnnualClosing({
        year: selectedYear,
        ...(closingNotes.trim() ? { notes: closingNotes.trim() } : {}),
      });
      addToast({
        type: 'success',
        title: 'Cierre Anual ejecutado',
        message: `Asiento #${res.entry.entryNumber} registrado al ${res.closingDate}. Todos los meses de ${selectedYear} quedaron cerrados.`,
      });
      setShowClosingModal(false);
      setClosingNotes('');
      await loadData(selectedYear);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'No se pudo ejecutar el Cierre Anual',
        message: err instanceof Error ? err.message : 'Error ejecutando la refundición anual.',
      });
    } finally {
      setExecutingClosing(false);
    }
  };

  const handleReverseAnnualClosing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reverseReason.trim()) return;
    setReversingClosing(true);
    try {
      const res = await accountingPeriodService.reverseAnnualClosing({
        year: selectedYear,
        reason: reverseReason.trim(),
      });
      addToast({
        type: 'info',
        title: 'Cierre Anual reversado',
        message: res.message,
      });
      setShowReverseModal(false);
      setReverseReason('');
      await loadData(selectedYear);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'No se pudo reversar el Cierre Anual',
        message: err instanceof Error ? err.message : 'Error al reversar el cierre anual.',
      });
    } finally {
      setReversingClosing(false);
    }
  };

  const handleSaveAccountingStartDate = async (clear = false) => {
    const targetDate = clear ? null : startDateInput.trim() || null;
    setSavingStartDate(true);
    try {
      const saved = await accountingPeriodService.updateSettings(targetDate);
      setStartDateInput(saved.accountingStartDate ?? '');
      addToast({
        type: clear ? 'info' : 'success',
        title: clear ? 'Límite de apertura eliminado' : 'Inicio contable actualizado',
        message: saved.accountingStartDate
          ? `Todo asiento o venta POS anterior al ${saved.accountingStartDate} quedará bloqueado automáticamente.`
          : 'Se eliminó la fecha mínima global de inicio contable.',
      });
      await loadData(selectedYear);
    } catch (err) {
      addToast({
        type: 'error',
        title: 'No se pudo actualizar el inicio contable',
        message: err instanceof Error ? err.message : 'Error guardando la configuración contable.',
      });
    } finally {
      setSavingStartDate(false);
    }
  };

  if (loading && !overview) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-400 space-y-3">
        <LoaderCircle className="w-8 h-8 animate-spin text-[#8C1F25]" />
        <span className="text-xs font-medium">Cargando períodos contables...</span>
      </div>
    );
  }

  const periods = overview?.periods || [];
  const beforeStartCount = periods.filter((p) => p.isBeforeAccountingStart).length;
  const closedCount = periods.filter(
    (p) => !p.isBeforeAccountingStart && p.status === 'cerrado',
  ).length;
  const openCount = Math.max(0, 12 - beforeStartCount - closedCount);
  const totalPendingSales = periods.reduce((acc, p) => acc + p.pendingSalesCount, 0);

  return (
    <div className="space-y-6">
      {/* 1. Cabecera y Selector de Año Fiscal */}
      <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Cierre de Períodos Contables
              </h3>
              {overview?.isYearClosed ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                  <FileCheck2 className="w-3.5 h-3.5" />
                  Cierre Anual #{overview.closingEntry?.entryNumber} Ejecutado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <CalendarCheck className="w-3.5 h-3.5" />
                  Ejercicio {selectedYear} Activo
                </span>
              )}
            </div>
            <p className="text-xs text-stone-500 mt-1">
              Controla el bloqueo mensual para evitar registros o anulaciones fuera de plazo y ejecuta la refundición anual al 31 de diciembre.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#FAF5ED] dark:bg-[#201613] border border-[#EADBCE] dark:border-[#35251F] rounded-xl p-1">
              <button
                type="button"
                onClick={() => setSelectedYear((y) => Math.max(2020, y - 1))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2C1F1A] text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
                title="Año anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 font-mono font-bold text-sm text-[#2A1B16] dark:text-[#FDF5EE]">
                {selectedYear}
              </span>
              <button
                type="button"
                onClick={() => setSelectedYear((y) => Math.min(2099, y + 1))}
                className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-[#2C1F1A] text-stone-600 dark:text-stone-300 transition-colors cursor-pointer"
                title="Año siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={() => void loadData(selectedYear)}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-[#201613] dark:hover:bg-[#2C1F1A] text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Resumen rápido */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/70 dark:border-emerald-900/40 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300 uppercase">
                Meses Abiertos
              </span>
              <div className="text-2xl font-mono font-bold text-emerald-900 dark:text-emerald-100">
                {openCount} / 12
              </div>
            </div>
            <LockOpen className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
          </div>

          <div className="p-3.5 rounded-2xl bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/70 dark:border-rose-900/40 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300 uppercase">
                Meses Cerrados
              </span>
              <div className="text-2xl font-mono font-bold text-rose-900 dark:text-rose-100">
                {closedCount} / 12
              </div>
            </div>
            <Lock className="w-6 h-6 text-rose-600 dark:text-rose-400" />
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 uppercase">
                Ventas POS sin Asiento ({selectedYear})
              </span>
              <div className="text-2xl font-mono font-bold text-amber-950 dark:text-amber-100">
                {totalPendingSales}
              </div>
            </div>
            <AlertTriangle
              className={`w-6 h-6 ${
                totalPendingSales > 0 ? 'text-amber-600 animate-pulse' : 'text-amber-500/60'
              }`}
            />
          </div>
        </div>

        {/* Barra de Fecha Mínima de Inicio Contable */}
        <div className="p-4 rounded-2xl bg-[#FAF5ED]/80 dark:bg-[#1C1411] border border-[#EADBCE] dark:border-[#35251F] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center shrink-0 mt-0.5">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-[#2A1B16] dark:text-[#FDF5EE]">
                  Fecha de Inicio Contable (Apertura)
                </span>
                {overview?.accountingStartDate ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    Desde {overview.accountingStartDate}
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-200/80 text-stone-600 dark:bg-[#2A1E1A] dark:text-stone-400">
                    Sin límite inferior configurado
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                Bloquea automáticamente cualquier asiento o venta POS anterior a la existencia real de la pastelería, sin tener que cerrar meses o años vacíos.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <input
              type="date"
              value={startDateInput}
              onChange={(e) => setStartDateInput(e.target.value)}
              className="text-xs px-3 py-2 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-white dark:bg-[#16100E] text-[#2A1B16] dark:text-[#FDF5EE] font-mono"
            />
            <button
              type="button"
              disabled={
                savingStartDate ||
                !startDateInput ||
                startDateInput === (overview?.accountingStartDate ?? '')
              }
              onClick={() => void handleSaveAccountingStartDate(false)}
              className="px-3.5 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              {savingStartDate ? 'Guardando...' : 'Guardar Inicio'}
            </button>
            {overview?.accountingStartDate && (
              <button
                type="button"
                disabled={savingStartDate}
                onClick={() => void handleSaveAccountingStartDate(true)}
                className="px-3 py-2 rounded-xl border border-stone-300 dark:border-[#3E2C25] hover:bg-stone-100 dark:hover:bg-[#251A16] text-stone-600 dark:text-stone-300 text-xs font-semibold disabled:opacity-45 transition-colors cursor-pointer"
              >
                Quitar límite
              </button>
            )}
          </div>
        </div>

        {/* Grilla de los 12 meses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
          {periods.map((period) => {
            const isBeforeStart = Boolean(period.isBeforeAccountingStart);
            const isClosed = period.status === 'cerrado';
            return (
              <div
                key={`${period.year}-${period.month}`}
                className={`rounded-2xl border p-4 flex flex-col justify-between gap-3 transition-all ${
                  isBeforeStart
                    ? 'border-stone-200/70 dark:border-[#2C1F1A] bg-stone-100/60 dark:bg-[#130E0C] opacity-80'
                    : isClosed
                    ? 'border-rose-200/80 dark:border-rose-900/50 bg-rose-50/30 dark:bg-rose-950/15'
                    : 'border-stone-200/80 dark:border-[#35251F] bg-stone-50/40 dark:bg-[#1C1411]/60'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-stone-400">
                        {String(period.month).padStart(2, '0')}/{period.year}
                      </span>
                      <h4 className="text-base font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif leading-tight">
                        {period.monthLabel}
                      </h4>
                    </div>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isBeforeStart
                          ? 'bg-stone-200 text-stone-700 dark:bg-[#2A1F1B] dark:text-stone-300'
                          : isClosed
                          ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      }`}
                    >
                      {isBeforeStart || isClosed ? (
                        <Lock className="w-3 h-3" />
                      ) : (
                        <LockOpen className="w-3 h-3" />
                      )}
                      {isBeforeStart ? 'Previo a apertura' : isClosed ? 'Cerrado' : 'Abierto'}
                    </span>
                  </div>

                  <div className="text-[11px] text-stone-600 dark:text-stone-300 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-400">Asientos en el mes:</span>
                      <span className="font-mono font-bold">{period.entriesCount}</span>
                    </div>
                    {period.pendingSalesCount > 0 && (
                      <div className="flex items-center justify-between text-amber-700 dark:text-amber-300 font-semibold">
                        <span>Ventas POS pendientes:</span>
                        <span className="font-mono">{period.pendingSalesCount}</span>
                      </div>
                    )}
                  </div>

                  {isBeforeStart && overview?.accountingStartDate && (
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 border-t border-stone-200/70 dark:border-[#2C1F1A] pt-1.5">
                      Bloqueado automáticamente (anterior al {overview.accountingStartDate}).
                    </p>
                  )}

                  {!isBeforeStart && isClosed && period.closedAt && (
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 border-t border-rose-200/50 dark:border-rose-900/30 pt-1.5">
                      Cerrado el {formatDateTime(period.closedAt)}
                      {period.closedBy?.name ? ` por ${period.closedBy.name}` : ''}
                    </p>
                  )}

                  {!isBeforeStart && !isClosed && period.reopenedAt && (
                    <p className="text-[10px] text-stone-500 dark:text-stone-400 border-t border-stone-200/60 dark:border-[#2C1F1A] pt-1.5">
                      Reabierto el {formatDateTime(period.reopenedAt)}
                      {period.reopenedBy?.name ? ` por ${period.reopenedBy.name}` : ''}
                    </p>
                  )}

                  {period.notes && (
                    <p className="text-[10px] italic text-stone-500 dark:text-stone-400 line-clamp-2">
                      "{period.notes}"
                    </p>
                  )}
                </div>

                {isBeforeStart ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2 px-3 rounded-xl border border-stone-200 dark:border-[#2C1F1A] bg-stone-100 dark:bg-[#1A1310] text-stone-500 dark:text-stone-400 text-xs font-semibold flex items-center justify-center gap-1.5 cursor-not-allowed"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Bloqueado por apertura
                  </button>
                ) : isClosed ? (
                  <button
                    type="button"
                    disabled={Boolean(overview?.isYearClosed)}
                    onClick={() => {
                      setPeriodNotes('');
                      setPeriodModal({ action: 'reopen', period });
                    }}
                    title={
                      overview?.isYearClosed
                        ? 'Reversa primero el cierre anual para reabrir este mes.'
                        : 'Reabrir período contable'
                    }
                    className="w-full py-2 px-3 rounded-xl border border-stone-300 dark:border-[#3E2C25] bg-white dark:bg-[#16100E] hover:bg-stone-100 dark:hover:bg-[#251A16] text-stone-700 dark:text-stone-200 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-45 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >
                    <LockOpen className="w-3.5 h-3.5" />
                    Reabrir Mes
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setPeriodNotes('');
                      setPeriodModal({ action: 'close', period });
                    }}
                    className="w-full py-2 px-3 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    Cerrar Período
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Asiento de Cierre Anual / Refundición de Cuentas al 31 de Diciembre */}
      <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
          <div>
            <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Asiento de Cierre Anual — Refundición de Cuentas (31/12/{selectedYear})
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Salda a <b>$0</b> todas las cuentas nominales (Ingresos, Costos y Gastos) contra la cuenta patrimonial{' '}
              <b>{preview?.equityAccount ? `${preview.equityAccount.code} ${preview.equityAccount.name}` : 'Resultado del Ejercicio'}</b>.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {overview?.isYearClosed ? (
              <button
                type="button"
                onClick={() => {
                  setReverseReason('');
                  setShowReverseModal(true);
                }}
                className="px-4 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-800 dark:text-rose-200 font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reversar Cierre {selectedYear}
              </button>
            ) : (
              <button
                type="button"
                disabled={!preview?.canExecute}
                onClick={() => {
                  setClosingNotes('');
                  setShowClosingModal(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white font-bold text-xs flex items-center gap-2 shadow-xs disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                Ejecutar Cierre Anual {selectedYear}
              </button>
            )}
          </div>
        </div>

        {preview && (
          <>
            {overview?.isYearClosed && overview.closingEntry ? (
              <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/25 border border-purple-200 dark:border-purple-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-purple-900 dark:text-purple-200">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5 h-5 text-purple-600 shrink-0" />
                  <div>
                    <div className="font-bold">
                      Asiento #{overview.closingEntry.entryNumber} — {overview.closingEntry.concept}
                    </div>
                    <div className="text-[11px] opacity-80">
                      Fecha contable: {overview.closingEntry.entryDate}. Todos los meses de {selectedYear} están bloqueados.
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              preview.blockingReason && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center gap-2.5 text-xs text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>{preview.blockingReason}</span>
                </div>
              )
            )}

            {/* Totales previos a la refundición */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#1C1411] border border-stone-200/80 dark:border-[#35251F]">
                <span className="text-[10px] font-bold uppercase text-stone-400 block">
                  Ingresos a Saldar
                </span>
                <span className="text-lg font-mono font-bold text-emerald-700 dark:text-emerald-400">
                  ${formatMoney(preview.totalIngresos)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#1C1411] border border-stone-200/80 dark:border-[#35251F]">
                <span className="text-[10px] font-bold uppercase text-stone-400 block">
                  Costos a Saldar
                </span>
                <span className="text-lg font-mono font-bold text-rose-700 dark:text-rose-400">
                  ${formatMoney(preview.totalCostos)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#1C1411] border border-stone-200/80 dark:border-[#35251F]">
                <span className="text-[10px] font-bold uppercase text-stone-400 block">
                  Gastos a Saldar
                </span>
                <span className="text-lg font-mono font-bold text-rose-700 dark:text-rose-400">
                  ${formatMoney(preview.totalGastos)}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#FAF5ED] dark:bg-[#231814] border border-[#EADBCE] dark:border-[#42312A]">
                <span className="text-[10px] font-bold uppercase text-[#8C1F25] dark:text-[#D4A373] block">
                  Resultado del Ejercicio (3102)
                </span>
                <span
                  className={`text-lg font-mono font-bold ${
                    preview.resultadoEjercicio >= 0
                      ? 'text-emerald-700 dark:text-emerald-400'
                      : 'text-rose-700 dark:text-rose-400'
                  }`}
                >
                  {preview.resultadoEjercicio >= 0 ? 'Utilidad ' : 'Pérdida '}
                  ${formatMoney(Math.abs(preview.resultadoEjercicio))}
                </span>
              </div>
            </div>

            {/* Tabla previa del asiento de refundición */}
            {preview.lines.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-stone-200/80 dark:border-[#35251F]">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#FAF5ED] dark:bg-[#201613] text-[10px] font-bold uppercase text-stone-700 dark:text-stone-300 border-b border-stone-200 dark:border-[#35251F]">
                      <th className="py-3 px-4">Código</th>
                      <th className="py-3 px-4">Cuenta Contable</th>
                      <th className="py-3 px-4">Tipo</th>
                      <th className="py-3 px-4 text-right">Saldo Actual</th>
                      <th className="py-3 px-4 text-right">DEBE (Cierre)</th>
                      <th className="py-3 px-4 text-right">HABER (Cierre)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                    {preview.lines.map((line) => (
                      <tr
                        key={`${line.accountId}-${line.accountType}`}
                        className={
                          line.accountType === 'patrimonio'
                            ? 'bg-purple-50/40 dark:bg-purple-950/20 font-semibold'
                            : 'hover:bg-stone-50/50 dark:hover:bg-[#1C1411]/50'
                        }
                      >
                        <td className="py-2.5 px-4 font-mono font-bold">{line.accountCode}</td>
                        <td className="py-2.5 px-4">{line.accountName}</td>
                        <td className="py-2.5 px-4 uppercase text-[10px] text-stone-500">
                          {line.accountType}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-stone-500">
                          {line.accountType === 'patrimonio'
                            ? 'Contrapartida'
                            : `$${formatMoney(line.currentBalance)}`}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-900 dark:text-white">
                          {line.debit > 0 ? `$${formatMoney(line.debit)}` : '-'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-900 dark:text-white">
                          {line.credit > 0 ? `$${formatMoney(line.credit)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-[#FAF5ED]/80 dark:bg-[#201613] font-mono font-bold text-xs border-t border-stone-200 dark:border-[#35251F]">
                      <td colSpan={4} className="py-2.5 px-4 text-right">
                        Totales Asiento de Cierre:
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400">
                        ${formatMoney(preview.lines.reduce((s, l) => s + l.debit, 0))}
                      </td>
                      <td className="py-2.5 px-4 text-right text-emerald-700 dark:text-emerald-400">
                        ${formatMoney(preview.lines.reduce((s, l) => s + l.credit, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* Modal: Confirmar cierre / reapertura mensual */}
      {periodModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#1C1411] w-full max-w-md rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
                <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
                  {periodModal.action === 'close' ? (
                    <>
                      <Lock className="w-4 h-4 text-[#8C1F25]" />
                      Cerrar {periodModal.period.monthLabel} {periodModal.period.year}
                    </>
                  ) : (
                    <>
                      <LockOpen className="w-4 h-4 text-emerald-600" />
                      Reabrir {periodModal.period.monthLabel} {periodModal.period.year}
                    </>
                  )}
                </h4>
                <button
                  type="button"
                  onClick={() => setPeriodModal(null)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                {periodModal.action === 'close'
                  ? `Una vez cerrado ${periodModal.period.monthLabel} ${periodModal.period.year}, ningún usuario podrá registrar nuevos asientos ni anular asientos existentes con fecha dentro de este mes.`
                  : `Al reabrir ${periodModal.period.monthLabel} ${periodModal.period.year}, volverá a permitirse el registro y la anulación de asientos en este mes.`}
              </p>

              <form onSubmit={handleConfirmPeriodAction} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                    Observación / Nota contable (opcional)
                  </label>
                  <textarea
                    rows={3}
                    value={periodNotes}
                    onChange={(e) => setPeriodNotes(e.target.value)}
                    placeholder={
                      periodModal.action === 'close'
                        ? 'Ej.: Conciliación bancaria y F29 revisados.'
                        : 'Ej.: Ajuste solicitado por auditoría.'
                    }
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-[#2C1F1A]">
                  <button
                    type="button"
                    onClick={() => setPeriodModal(null)}
                    className="px-4 py-2 rounded-xl text-xs text-stone-500 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={submittingPeriod}
                    className={`px-4 py-2 rounded-xl text-white text-xs font-bold disabled:opacity-50 cursor-pointer ${
                      periodModal.action === 'close'
                        ? 'bg-[#8C1F25] hover:bg-[#73191E]'
                        : 'bg-emerald-600 hover:bg-emerald-700'
                    }`}
                  >
                    {submittingPeriod
                      ? 'Procesando...'
                      : periodModal.action === 'close'
                      ? 'Confirmar Cierre'
                      : 'Confirmar Reapertura'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal: Ejecutar Cierre Anual */}
      {showClosingModal &&
        preview &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#1C1411] w-full max-w-lg rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
                <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
                  <FileCheck2 className="w-4 h-4 text-[#8C1F25]" />
                  Confirmar Cierre Anual {selectedYear}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowClosingModal(false)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 text-xs text-amber-900 dark:text-amber-200 space-y-1">
                <p className="font-bold">Se generará el asiento de refundición al 31-12-{selectedYear}:</p>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  <li>Todas las cuentas de ingresos, costos y gastos quedarán saldadas en $0.</li>
                  <li>
                    El resultado neto (<b>${formatMoney(preview.resultadoEjercicio)}</b>) se traspasará a{' '}
                    <b>{preview.equityAccount?.code} {preview.equityAccount?.name}</b>.
                  </li>
                  {preview.openMonthsCount > 0 && (
                    <li>
                      Los <b>{preview.openMonthsCount}</b> meses aún abiertos de {selectedYear} se cerrarán automáticamente.
                    </li>
                  )}
                </ul>
              </div>

              <form onSubmit={handleExecuteAnnualClosing} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                    Notas del Cierre Anual (opcional)
                  </label>
                  <textarea
                    rows={2}
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="Ej.: Cierre tributario y balance anual aprobado."
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-[#2C1F1A]">
                  <button
                    type="button"
                    onClick={() => setShowClosingModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-stone-500 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={executingClosing}
                    className="px-5 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {executingClosing ? 'Ejecutando...' : `Confirmar Cierre Anual ${selectedYear}`}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}

      {/* Modal: Reversar Cierre Anual */}
      {showReverseModal &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="bg-white dark:bg-[#1C1411] w-full max-w-md rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
                <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-rose-600" />
                  Reversar Cierre Anual {selectedYear}
                </h4>
                <button
                  type="button"
                  onClick={() => setShowReverseModal(false)}
                  className="text-stone-400 hover:text-stone-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-stone-600 dark:text-stone-300">
                Se generará un contra-asiento contable para revertir la refundición del 31-12-{selectedYear}. Los 12 meses permanecerán cerrados hasta que decidas reabrir alguno manualmente.
              </p>

              <form onSubmit={handleReverseAnnualClosing} className="space-y-4">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 dark:text-stone-300 block mb-1">
                    Motivo del reverso *
                  </label>
                  <input
                    type="text"
                    required
                    value={reverseReason}
                    onChange={(e) => setReverseReason(e.target.value)}
                    placeholder="Ej.: Corrección de gasto omitido en diciembre"
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-[#2C1F1A]">
                  <button
                    type="button"
                    onClick={() => setShowReverseModal(false)}
                    className="px-4 py-2 rounded-xl text-xs text-stone-500 cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={reversingClosing || !reverseReason.trim()}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                  >
                    {reversingClosing ? 'Reversando...' : 'Confirmar Reverso'}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

