import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Trash2,
  X,
  LoaderCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Calendar,
} from 'lucide-react';
import type { ToastMessage } from '../../types';
import { apiFetch } from '../../lib/api';

interface AccountingViewProps {
  section: 'contabilidad-diario' | 'contabilidad-mayor' | 'contabilidad-balances' | 'contabilidad-reportes';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface EntryLine {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string;
}

interface AccountingEntry {
  id: string;
  entryNumber: number;
  entryDate: string;
  concept: string;
  origin: 'manual' | 'pos';
  ticketNumber?: string;
  totalAmount: number;
  isBalanced: boolean;
  items: EntryLine[];
}

interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isActive: boolean;
}

interface BalanceRow {
  id: string;
  code: string;
  name: string;
  accountType: string;
  totalDebit: number;
  totalCredit: number;
  debitBalance: number;
  creditBalance: number;
}

interface LedgerMovement {
  id: string;
  entryId: string;
  entryNumber: number;
  entryDate: string;
  concept: string;
  description: string | null;
  debit: number;
  credit: number;
  runningBalance: number;
}

interface AccountLedgerData {
  account: {
    id: string;
    code: string;
    name: string;
    accountType: string;
    nature: 'deudora' | 'acreedora';
  };
  period: { startDate: string | null; endDate: string | null };
  initialBalance: number;
  movements: LedgerMovement[];
  totalDebit: number;
  totalCredit: number;
  finalBalance: number;
  finalBalanceType: 'deudor' | 'acreedor' | 'cero';
}

const getMonthDateRange = (monthsAgo = 0) => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - monthsAgo;
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatMoney = (val: number) =>
  val.toLocaleString('es-CL', { maximumFractionDigits: 0 });

export const AccountingView: React.FC<AccountingViewProps> = ({ section, addToast }) => {
  const navigate = useNavigate();

  // Estados generales de contabilidad
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Estados para Libro Mayor
  const defaultMonth = getMonthDateRange(0);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(defaultMonth.start);
  const [endDate, setEndDate] = useState<string>(defaultMonth.end);
  const [ledgerData, setLedgerData] = useState<AccountLedgerData | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);

  // Estados del modal de nuevo asiento
  const [showModal, setShowModal] = useState(false);
  const [entryDate, setEntryDate] = useState(todayISO);
  const [concept, setConcept] = useState('');
  const [formLines, setFormLines] = useState<Array<{ accountId: string; debit: number; credit: number; desc: string }>>([
    { accountId: '', debit: 0, credit: 0, desc: '' },
    { accountId: '', debit: 0, credit: 0, desc: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const [accsRes, entriesRes, pendingRes] = await Promise.all([
        apiFetch<AccountingAccount[]>('/accounting/accounts'),
        apiFetch<AccountingEntry[]>('/accounting/entries'),
        apiFetch<{ pendingCount: number }>('/accounting/pending-sales-count').catch(() => ({ pendingCount: 0 })),
      ]);

      const loadedAccounts = accsRes || [];
      setAccounts(loadedAccounts);
      setEntries(entriesRes || []);
      setPendingCount(pendingRes.pendingCount || 0);

      // Si no hay cuenta seleccionada para el mayor, predeterminar Caja 1101 o la primera
      if (!selectedLedgerAccountId && loadedAccounts.length > 0) {
        const defaultAcc = loadedAccounts.find((a) => a.code === '1101') || loadedAccounts[0];
        setSelectedLedgerAccountId(defaultAcc.id);
      }

      if (section === 'contabilidad-balances') {
        const balRes = await apiFetch<BalanceRow[]>('/accounting/balance');
        setBalance(balRes || []);
      }
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error contable',
        message: err instanceof Error ? err.message : 'No se pudo cargar la información.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [section]);

  // Carga del Libro Mayor de la cuenta seleccionada
  const fetchLedger = useCallback(
    async (accId?: string, sDate?: string, eDate?: string) => {
      const targetId = accId || selectedLedgerAccountId;
      if (!targetId) return;

      setIsLoadingLedger(true);
      try {
        const currentStart = sDate !== undefined ? sDate : startDate;
        const currentEnd = eDate !== undefined ? eDate : endDate;

        const params = new URLSearchParams();
        if (currentStart) params.append('startDate', currentStart);
        if (currentEnd) params.append('endDate', currentEnd);

        const query = params.toString() ? `?${params.toString()}` : '';
        const data = await apiFetch<AccountLedgerData>(`/accounting/ledger/${targetId}${query}`);
        setLedgerData(data);
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Error al consultar Libro Mayor',
          message: err instanceof Error ? err.message : 'No se pudo cargar el mayor de la cuenta.',
        });
      } finally {
        setIsLoadingLedger(false);
      }
    },
    [selectedLedgerAccountId, startDate, endDate, addToast]
  );

  useEffect(() => {
    if (section === 'contabilidad-mayor' && selectedLedgerAccountId) {
      void fetchLedger();
    }
  }, [section, selectedLedgerAccountId, startDate, endDate, fetchLedger]);

  const handleApplyPreset = (monthsAgo: number | null) => {
    if (monthsAgo === null) {
      // Historial completo sin filtro de fechas
      setStartDate('');
      setEndDate('');
    } else {
      const range = getMonthDateRange(monthsAgo);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleSyncPending = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch<{ synced: number; failed: number }>('/accounting/sync-pending-sales', {
        method: 'POST',
      });
      addToast({
        type: 'success',
        title: 'Sincronización completada',
        message: `Se sincronizaron ${res.synced} ventas con el Libro Diario. Fallidas: ${res.failed}`,
      });
      await loadData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'Error de sincronización',
        message: err instanceof Error ? err.message : 'No se pudo sincronizar.',
      });
    } finally {
      setSyncing(false);
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const validLines = formLines.filter((l) => l.accountId && (l.debit > 0 || l.credit > 0));
    if (validLines.length < 2) {
      setFormError('El asiento debe tener al menos dos líneas con cuentas y montos asignados.');
      return;
    }

    const sumDebit = validLines.reduce((acc, l) => acc + (l.debit || 0), 0);
    const sumCredit = validLines.reduce((acc, l) => acc + (l.credit || 0), 0);

    if (Math.abs(sumDebit - sumCredit) > 0.01) {
      setFormError(`El asiento está descuadrado: Debe ($${formatMoney(sumDebit)}) != Haber ($${formatMoney(sumCredit)}).`);
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/accounting/entries', {
        method: 'POST',
        body: JSON.stringify({
          entryDate,
          concept: concept.trim(),
          items: validLines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit || 0,
            credit: l.credit || 0,
            description: l.desc || null,
          })),
        }),
      });

      addToast({
        type: 'success',
        title: 'Asiento registrado',
        message: 'El asiento contable se guardó exitosamente en el Libro Diario.',
      });

      setShowModal(false);
      setConcept('');
      setFormLines([
        { accountId: '', debit: 0, credit: 0, desc: '' },
        { accountId: '', debit: 0, credit: 0, desc: '' },
      ]);
      await loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar el asiento.');
    } finally {
      setSaving(false);
    }
  };

  const sumDebit = formLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const sumCredit = formLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isSquare = Math.abs(sumDebit - sumCredit) <= 0.01 && sumDebit > 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-stone-400 space-y-3">
        <LoaderCircle className="w-8 h-8 animate-spin text-[#8C1F25]" />
        <span className="text-xs font-medium">Cargando módulo contable...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Banner de Sincronización POS si hay ventas pendientes */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Hay <b>{pendingCount}</b> venta(s) del POS pendiente(s) de generar asiento contable.
            </span>
          </div>
          <button
            onClick={handleSyncPending}
            disabled={syncing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      )}

      {/* SECCIÓN 1: LIBRO DIARIO */}
      {section === 'contabilidad-diario' && (
        <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Libro Diario (Partida Doble)
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Registro cronológico formal de asientos contables. Cada asiento valida balance estricto Debe = Haber.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Nuevo Asiento Manual
            </button>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-12 text-stone-400 text-xs">
              No hay asientos registrados en el Libro Diario.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-stone-200/80 dark:border-[#35251F] bg-stone-50/40 dark:bg-[#1C1411]/50 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-stone-200/60 dark:border-[#2C1F1A] pb-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-stone-500">#{entry.entryNumber}</span>
                      <span className="font-bold text-[#2A1B16] dark:text-[#FDF5EE]">{entry.concept}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          entry.origin === 'pos'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                            : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                        }`}
                      >
                        {entry.origin === 'pos' ? 'Venta POS' : 'Manual'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 font-mono text-stone-500 text-[11px]">
                      <span>{entry.entryDate}</span>
                      <span>Total: ${formatMoney(entry.totalAmount)}</span>
                    </div>
                  </div>

                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="border-b border-stone-100 dark:border-[#281C17] text-stone-400 uppercase text-[10px]">
                        <th className="py-2 px-4">Código</th>
                        <th className="py-2 px-4">Cuenta Contable</th>
                        <th className="py-2 px-4 text-right">DEBE</th>
                        <th className="py-2 px-4 text-right">HABER</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50 dark:divide-[#1C1411]">
                      {entry.items.map((it) => (
                        <tr key={it.id}>
                          <td className="py-2 px-4 font-mono text-stone-500">{it.accountCode}</td>
                          <td className="py-2 px-4 font-semibold text-stone-700 dark:text-stone-200">
                            {it.accountName}
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-stone-900 dark:text-white">
                            {it.debit > 0 ? `$${formatMoney(it.debit)}` : '-'}
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-bold text-stone-900 dark:text-white">
                            {it.credit > 0 ? `$${formatMoney(it.credit)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SECCIÓN 2: LIBRO MAYOR (GENERAL LEDGER / CUENTA T) */}
      {section === 'contabilidad-mayor' && (
        <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Libro Mayor (General Ledger)
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Extracto analítico de movimientos, saldo acumulado y formato de Cuenta T por cuenta contable.
              </p>
            </div>
            <button
              onClick={() => fetchLedger()}
              disabled={isLoadingLedger}
              className="px-3.5 py-2 rounded-xl bg-stone-100 hover:bg-stone-200 dark:bg-[#201613] text-stone-700 dark:text-stone-300 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLedger ? 'animate-spin' : ''}`} />
              Actualizar
            </button>
          </div>

          {/* Barra de Filtros: Selector de Cuenta + Rango de Fechas */}
          <div className="p-4 rounded-2xl bg-stone-50/70 dark:bg-[#1C1411]/50 border border-stone-200/80 dark:border-[#35251F] space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] font-bold text-stone-600 dark:text-stone-400 block mb-1">
                  Cuenta Contable a Mayorizar
                </label>
                <select
                  value={selectedLedgerAccountId}
                  onChange={(e) => setSelectedLedgerAccountId(e.target.value)}
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
                  onChange={(e) => setStartDate(e.target.value)}
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
                  onChange={(e) => setEndDate(e.target.value)}
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
                onClick={() => handleApplyPreset(0)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-700 dark:text-stone-300 hover:border-[#8C1F25] transition-colors cursor-pointer"
              >
                Mes Actual
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(1)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-700 dark:text-stone-300 hover:border-[#8C1F25] transition-colors cursor-pointer"
              >
                Mes Anterior
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(null)}
                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-white dark:bg-[#16100E] border border-stone-200 dark:border-[#35251F] text-stone-700 dark:text-stone-300 hover:border-[#8C1F25] transition-colors cursor-pointer"
              >
                Historial Completo
              </button>
            </div>
          </div>

          {isLoadingLedger ? (
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

                {/* La Cuenta T visual */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Columna Izquierda: DEBE */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#16100E] border-t-4 border-emerald-500 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      DEBE (Total Débitos)
                    </span>
                    <span className="text-2xl font-mono font-bold text-stone-900 dark:text-white">
                      ${formatMoney(ledgerData.totalDebit)}
                    </span>
                    <p className="text-[11px] text-stone-500">
                      {ledgerData.account.nature === 'deudora'
                        ? 'Aumentos de saldo en el período'
                        : 'Disminuciones de saldo en el período'}
                    </p>
                  </div>

                  {/* Columna Derecha: HABER */}
                  <div className="p-4 rounded-xl bg-white dark:bg-[#16100E] border-t-4 border-rose-500 shadow-xs space-y-1">
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                      HABER (Total Créditos)
                    </span>
                    <span className="text-2xl font-mono font-bold text-stone-900 dark:text-white">
                      ${formatMoney(ledgerData.totalCredit)}
                    </span>
                    <p className="text-[11px] text-stone-500">
                      {ledgerData.account.nature === 'deudora'
                        ? 'Disminuciones de saldo en el período'
                        : 'Aumentos de saldo en el período'}
                    </p>
                  </div>
                </div>

                {/* Footer de la Cuenta T: Saldo Inicial y Saldo Final */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-stone-200/60 dark:border-[#2C1F1A] text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500 font-medium">Saldo Inicial al {ledgerData.period.startDate || 'inicio'}:</span>
                    <span className="font-mono font-bold">${formatMoney(ledgerData.initialBalance)}</span>
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
                      ${formatMoney(ledgerData.finalBalance)} ({ledgerData.finalBalanceType.toUpperCase()})
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
                    {/* Fila de Saldo Inicial */}
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
                          ${formatMoney(ledgerData.initialBalance)}
                        </td>
                      </tr>
                    )}

                    {ledgerData.movements.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-stone-400">
                          No se registraron movimientos para esta cuenta en el rango de fechas seleccionado.
                        </td>
                      </tr>
                    ) : (
                      ledgerData.movements.map((mov) => (
                        <tr key={mov.id} className="hover:bg-stone-50/50 dark:hover:bg-[#1C1411]/50">
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
                            {mov.debit > 0 ? `$${formatMoney(mov.debit)}` : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                            {mov.credit > 0 ? `$${formatMoney(mov.credit)}` : '-'}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono font-bold text-stone-900 dark:text-white bg-stone-50/30 dark:bg-[#201613]/30">
                            ${formatMoney(mov.runningBalance)}
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
      )}

      {/* SECCIÓN 3: BALANCE DE COMPROBACIÓN */}
      {section === 'contabilidad-balances' && (
        <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
          <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Balance de Comprobación y Saldos
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Sumas y saldos acumulados de todas las cuentas del catálogo. Haz clic en el botón de libro para abrir el Libro Mayor de cada cuenta.
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
                    <td className="py-2.5 px-4 uppercase text-[10px] text-stone-400">{row.accountType}</td>
                    <td className="py-2.5 px-4 text-right font-mono">${formatMoney(row.totalDebit)}</td>
                    <td className="py-2.5 px-4 text-right font-mono">${formatMoney(row.totalCredit)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-600">
                      {row.debitBalance > 0 ? `$${formatMoney(row.debitBalance)}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-rose-600">
                      {row.creditBalance > 0 ? `$${formatMoney(row.creditBalance)}` : '-'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLedgerAccountId(row.id);
                          navigate('/contabilidad-mayor');
                        }}
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
      )}

      {/* MODAL: REGISTRAR NUEVO ASIENTO */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#1C1411] w-full max-w-3xl rounded-3xl p-6 border border-[#EADBCE] dark:border-[#35251F] shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-[#2C1F1A] pb-3">
              <h4 className="font-bold text-base text-[#2A1B16] dark:text-white font-serif">
                Nuevo Asiento Contable (Partida Doble)
              </h4>
              <button onClick={() => setShowModal(false)} className="text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs border border-rose-200">
                {formError}
              </div>
            )}

            <form onSubmit={handleSaveEntry} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">Fecha</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F]"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-stone-600 block mb-1">Concepto / Glosa</label>
                  <input
                    type="text"
                    value={concept}
                    onChange={(e) => setConcept(e.target.value)}
                    placeholder="Ej.: Compra de sacos de harina en efectivo"
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F]"
                    required
                  />
                </div>
              </div>

              {/* Grilla de Líneas Debe y Haber */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-stone-700 block">Líneas del Asiento</span>
                {formLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={line.accountId}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].accountId = e.target.value;
                        setFormLines(updated);
                      }}
                      className="flex-1 text-xs p-2 rounded-xl border border-stone-200 dark:border-[#35251F]"
                      required
                    >
                      <option value="">Selecciona cuenta...</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.code} - {a.name}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      placeholder="DEBE"
                      value={line.debit || ''}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].debit = parseFloat(e.target.value) || 0;
                        setFormLines(updated);
                      }}
                      className="w-28 text-xs p-2 rounded-xl border border-stone-200 text-right font-mono"
                    />
                    <input
                      type="number"
                      placeholder="HABER"
                      value={line.credit || ''}
                      onChange={(e) => {
                        const updated = [...formLines];
                        updated[idx].credit = parseFloat(e.target.value) || 0;
                        setFormLines(updated);
                      }}
                      className="w-28 text-xs p-2 rounded-xl border border-stone-200 text-right font-mono"
                    />
                    {formLines.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setFormLines(formLines.filter((_, i) => i !== idx))}
                        className="text-stone-400 hover:text-rose-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={() => setFormLines([...formLines, { accountId: '', debit: 0, credit: 0, desc: '' }])}
                  className="text-xs text-[#8C1F25] font-bold flex items-center gap-1 mt-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar línea
                </button>
              </div>

              {/* Verificación de Cuadre */}
              <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#201613] flex justify-between items-center text-xs">
                <div className="flex items-center gap-2">
                  {isSquare ? (
                    <span className="flex items-center gap-1.5 text-emerald-600 font-bold">
                      <CheckCircle2 className="w-4 h-4" /> Asiento Cuadrado
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-rose-600 font-bold">
                      <AlertTriangle className="w-4 h-4" /> Descuadre: ${formatMoney(Math.abs(sumDebit - sumCredit))}
                    </span>
                  )}
                </div>
                <div className="font-mono space-x-4">
                  <span>Debe: <b>${formatMoney(sumDebit)}</b></span>
                  <span>Haber: <b>${formatMoney(sumCredit)}</b></span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs text-stone-500 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!isSquare || saving}
                  className="px-5 py-2 rounded-xl bg-[#8C1F25] text-white text-xs font-bold disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Asentar en Diario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
