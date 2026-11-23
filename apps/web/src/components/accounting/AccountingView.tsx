import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, LoaderCircle, RefreshCw } from 'lucide-react';
import type {
  AccountLedgerData,
  AccountingAccount,
  AccountingEntry,
  BalanceRow,
  PeriodCheckResult,
  ToastMessage,
} from '../../types';
import { createIdempotencyKey } from '../../lib/api';
import { accountingService } from '../../services/accountingService';
import { accountingPeriodService } from '../../services/accountingPeriodService';
import {
  formatMoney,
  getChileMonthRange,
  getChileTodayIso,
} from '../../utils/formatters';
import { AccountingJournalTab } from './AccountingJournalTab';
import { AccountingLedgerTab } from './AccountingLedgerTab';
import { AccountingBalanceTab } from './AccountingBalanceTab';
import {
  AccountingEntryModal,
  type EntryFormLine,
} from './AccountingEntryModal';
import { VoidEntryModal } from './VoidEntryModal';
import { FinancialReportsTab } from './FinancialReportsTab';
import { AccountingPeriodsTab } from './AccountingPeriodsTab';
import { TaxControlTab } from './TaxControlTab';

interface AccountingViewProps {
  section:
    | 'contabilidad-diario'
    | 'contabilidad-mayor'
    | 'contabilidad-balances'
    | 'contabilidad-reportes'
    | 'contabilidad-periodos'
    | 'contabilidad-impuestos';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

const INITIAL_ENTRY_LINES: EntryFormLine[] = [
  { accountId: '', debit: 0, credit: 0, desc: '' },
  { accountId: '', debit: 0, credit: 0, desc: '' },
];

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
  const defaultMonth = getChileMonthRange(0);
  const [selectedLedgerAccountId, setSelectedLedgerAccountId] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(defaultMonth.start);
  const [endDate, setEndDate] = useState<string>(defaultMonth.end);
  const [ledgerData, setLedgerData] = useState<AccountLedgerData | null>(null);
  const [isLoadingLedger, setIsLoadingLedger] = useState<boolean>(false);

  // Estados del modal de nuevo asiento
  const [showModal, setShowModal] = useState(false);
  const [entryDate, setEntryDate] = useState(() => getChileTodayIso());
  const [concept, setConcept] = useState('');
  const [formLines, setFormLines] = useState<EntryFormLine[]>(INITIAL_ENTRY_LINES);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [periodCheck, setPeriodCheck] = useState<PeriodCheckResult | null>(null);
  const [checkingPeriod, setCheckingPeriod] = useState(false);

  // Estados del modal de anulación de asiento
  const [voidModalEntry, setVoidModalEntry] = useState<AccountingEntry | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingEntry, setVoidingEntry] = useState(false);

  const saveEntryIdempotencyKeyRef = useRef<string | null>(null);
  const syncPendingIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    saveEntryIdempotencyKeyRef.current = null;
  }, [entryDate, concept, formLines, showModal]);

  const loadData = useCallback(async () => {
    if (
      section === 'contabilidad-periodos' ||
      section === 'contabilidad-reportes' ||
      section === 'contabilidad-impuestos'
    ) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [accountsResult, entriesResult, pendingResult] = await Promise.allSettled([
        accountingService.getAccounts(),
        accountingService.getEntries(),
        accountingService.getPendingSalesCount(),
      ]);

      if (accountsResult.status === 'rejected') {
        throw accountsResult.reason;
      }
      if (entriesResult.status === 'rejected') {
        throw entriesResult.reason;
      }

      const loadedAccounts = accountsResult.value || [];
      setAccounts(loadedAccounts);
      setEntries(entriesResult.value || []);

      if (pendingResult.status === 'fulfilled') {
        setPendingCount(pendingResult.value.pendingCount || 0);
      } else {
        console.warn(
          'No se pudo obtener el contador de ventas POS pendientes:',
          pendingResult.reason,
        );
        setPendingCount(0);
      }

      setSelectedLedgerAccountId((prev) => {
        if (prev || loadedAccounts.length === 0) return prev;
        const defaultAcc = loadedAccounts.find((a) => a.code === '1101') || loadedAccounts[0];
        return defaultAcc.id;
      });

      if (section === 'contabilidad-balances') {
        const balRes = await accountingService.getBalance();
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
  }, [section, addToast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!showModal || !entryDate) {
      setPeriodCheck(null);
      return;
    }

    let cancelled = false;
    setCheckingPeriod(true);
    accountingPeriodService
      .checkDate(entryDate)
      .then((res) => {
        if (!cancelled) setPeriodCheck(res);
      })
      .catch(() => {
        if (!cancelled) setPeriodCheck(null);
      })
      .finally(() => {
        if (!cancelled) setCheckingPeriod(false);
      });

    return () => {
      cancelled = true;
    };
  }, [showModal, entryDate]);

  const fetchLedger = useCallback(
    async (accId?: string, sDate?: string, eDate?: string) => {
      const targetId = accId || selectedLedgerAccountId;
      if (!targetId) return;

      setIsLoadingLedger(true);
      try {
        const currentStart = sDate !== undefined ? sDate : startDate;
        const currentEnd = eDate !== undefined ? eDate : endDate;
        const data = await accountingService.getLedger(targetId, currentStart, currentEnd);
        setLedgerData(data);
      } catch (err) {
        addToast({
          type: 'error',
          title: 'Error al consultar Libro Mayor',
          message:
            err instanceof Error ? err.message : 'No se pudo cargar el mayor de la cuenta.',
        });
      } finally {
        setIsLoadingLedger(false);
      }
    },
    [selectedLedgerAccountId, startDate, endDate, addToast],
  );

  useEffect(() => {
    if (section === 'contabilidad-mayor' && selectedLedgerAccountId) {
      void fetchLedger();
    }
  }, [section, selectedLedgerAccountId, startDate, endDate, fetchLedger]);

  const handleApplyPreset = (monthsAgo: number | null) => {
    if (monthsAgo === null) {
      setStartDate('');
      setEndDate('');
    } else {
      const range = getChileMonthRange(monthsAgo);
      setStartDate(range.start);
      setEndDate(range.end);
    }
  };

  const handleSyncPending = async () => {
    setSyncing(true);
    try {
      const idempotencyKey =
        syncPendingIdempotencyKeyRef.current ?? createIdempotencyKey();
      syncPendingIdempotencyKeyRef.current = idempotencyKey;

      const res = await accountingService.syncPendingSales(idempotencyKey);
      syncPendingIdempotencyKeyRef.current = null;
      addToast({
        type: 'success',
        title: 'Sincronización completada',
        message: `Se sincronizaron ${res.synced} operación(es) con el Libro Diario. Fallidas: ${res.failed}`,
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
      setFormError(
        `El asiento está descuadrado: Debe (${formatMoney(sumDebit)}) != Haber (${formatMoney(
          sumCredit,
        )}).`,
      );
      return;
    }

    setSaving(true);
    try {
      const idempotencyKey =
        saveEntryIdempotencyKeyRef.current ?? createIdempotencyKey();
      saveEntryIdempotencyKeyRef.current = idempotencyKey;

      await accountingService.createEntry(
        {
          entryDate,
          concept: concept.trim(),
          items: validLines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit || 0,
            credit: l.credit || 0,
            description: l.desc.trim() || undefined,
          })),
        },
        idempotencyKey,
      );
      saveEntryIdempotencyKeyRef.current = null;

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

  const handleVoidEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!voidModalEntry || !voidReason.trim()) return;

    setVoidingEntry(true);
    try {
      const res = await accountingPeriodService.voidEntry(voidModalEntry.id, voidReason.trim());
      addToast({
        type: 'success',
        title: 'Asiento anulado',
        message: res.message,
      });
      setVoidModalEntry(null);
      setVoidReason('');
      await loadData();
    } catch (err) {
      addToast({
        type: 'error',
        title: 'No se pudo anular el asiento',
        message: err instanceof Error ? err.message : 'Error anulando asiento.',
      });
    } finally {
      setVoidingEntry(false);
    }
  };

  const isSelectedPeriodClosed = periodCheck ? !periodCheck.isOpen : false;

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
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-amber-900 dark:text-amber-200 text-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Hay <b>{pendingCount}</b> operación(es) (POS / Inventario) pendiente(s) de generar asiento contable.
            </span>
          </div>
          <button
            type="button"
            onClick={() => void handleSyncPending()}
            disabled={syncing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando...' : 'Sincronizar ahora'}
          </button>
        </div>
      )}

      {section === 'contabilidad-diario' && (
        <AccountingJournalTab
          entries={entries}
          onOpenNewEntryModal={() => setShowModal(true)}
          onSelectVoidEntry={(entry) => {
            setVoidReason('');
            setVoidModalEntry(entry);
          }}
        />
      )}

      {section === 'contabilidad-mayor' && (
        <AccountingLedgerTab
          accounts={accounts}
          selectedAccountId={selectedLedgerAccountId}
          onSelectAccount={setSelectedLedgerAccountId}
          startDate={startDate}
          onStartDateChange={setStartDate}
          endDate={endDate}
          onEndDateChange={setEndDate}
          onApplyPreset={handleApplyPreset}
          ledgerData={ledgerData}
          isLoading={isLoadingLedger}
          onRefresh={() => void fetchLedger()}
        />
      )}

      {section === 'contabilidad-balances' && (
        <AccountingBalanceTab
          balance={balance}
          onOpenLedgerForAccount={(accountId) => {
            setSelectedLedgerAccountId(accountId);
            navigate('/contabilidad-mayor');
          }}
        />
      )}

      {section === 'contabilidad-reportes' && <FinancialReportsTab addToast={addToast} />}

      {section === 'contabilidad-periodos' && <AccountingPeriodsTab addToast={addToast} />}

      {section === 'contabilidad-impuestos' && <TaxControlTab addToast={addToast} />}

      <AccountingEntryModal
        isOpen={showModal}
        accounts={accounts}
        entryDate={entryDate}
        onEntryDateChange={setEntryDate}
        concept={concept}
        onConceptChange={setConcept}
        formLines={formLines}
        onFormLinesChange={setFormLines}
        periodCheck={periodCheck}
        checkingPeriod={checkingPeriod}
        isSelectedPeriodClosed={isSelectedPeriodClosed}
        formError={formError}
        saving={saving}
        onClose={() => setShowModal(false)}
        onSubmit={(e) => void handleSaveEntry(e)}
      />

      <VoidEntryModal
        entry={voidModalEntry}
        voidReason={voidReason}
        onVoidReasonChange={setVoidReason}
        isVoiding={voidingEntry}
        onClose={() => setVoidModalEntry(null)}
        onSubmit={(e) => void handleVoidEntry(e)}
      />
    </div>
  );
};
