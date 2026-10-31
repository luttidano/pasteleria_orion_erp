import { useEffect, useState } from 'react';
import {
  Plus,
  Trash2,
  X,
  LoaderCircle,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import type { ToastMessage } from '../../types';
import { apiFetch } from '../../lib/api';

interface AccountingViewProps {
  section: 'contabilidad-diario' | 'contabilidad-balances' | 'contabilidad-reportes';
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

const todayISO = () => new Date().toISOString().slice(0, 10);

const formatMoney = (val: number) =>
  val.toLocaleString('es-CL', { maximumFractionDigits: 0 });

export const AccountingView: React.FC<AccountingViewProps> = ({ section, addToast }) => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [balance, setBalance] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  // Estado del modal de nuevo asiento
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

      setAccounts(accsRes || []);
      setEntries(entriesRes || []);
      setPendingCount(pendingRes.pendingCount || 0);

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

  const handleSyncPending = async () => {
    setSyncing(true);
    try {
      const res = await apiFetch<{ synced: number; failed: number }>('/accounting/sync-pending-sales', {
        method: 'POST',
      });
      addToast({
        type: res.failed > 0 ? 'warning' : 'success',
        title: 'Sincronización completada',
        message: `${res.synced} venta(s) contabilizadas exitosamente.${res.failed > 0 ? ` ${res.failed} quedaron pendientes.` : ''}`,
      });
      void loadData();
    } catch (error) {
      addToast({
        type: 'error',
        title: 'Fallo al sincronizar',
        message: error instanceof Error ? error.message : 'Error desconocido.',
      });
    } finally {
      setSyncing(false);
    }
  };

  // Cuadre en tiempo real del formulario
  const sumDebit = formLines.reduce((acc, l) => acc + (Number(l.debit) || 0), 0);
  const sumCredit = formLines.reduce((acc, l) => acc + (Number(l.credit) || 0), 0);
  const isSquare = Math.abs(sumDebit - sumCredit) < 0.01 && sumDebit > 0;

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!concept.trim()) {
      setFormError('Ingresa una glosa o concepto para el asiento.');
      return;
    }
    if (!isSquare) {
      setFormError(`El asiento no cuadra. Debe: $${formatMoney(sumDebit)} | Haber: $${formatMoney(sumCredit)}`);
      return;
    }
    if (formLines.some((l) => !l.accountId)) {
      setFormError('Todas las líneas deben tener una cuenta seleccionada.');
      return;
    }

    setSaving(true);
    try {
      await apiFetch('/accounting/entries', {
        method: 'POST',
        body: JSON.stringify({
          entryDate,
          concept,
          items: formLines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
            description: l.desc,
          })),
        }),
      });

      addToast({
        type: 'success',
        title: 'Asiento registrado',
        message: 'El asiento contable quedó asentado y cuadrado.',
      });

      setShowModal(false);
      setConcept('');
      setFormLines([
        { accountId: '', debit: 0, credit: 0, desc: '' },
        { accountId: '', debit: 0, credit: 0, desc: '' },
      ]);
      void loadData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar asiento.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* Banner de Sincronización POS */}
      {pendingCount > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <div>
              <p className="text-sm font-bold text-amber-900 dark:text-amber-200">
                {pendingCount} venta(s) del POS pendientes de contabilizar
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Fueron cobradas en mostrador pero requieren generar su asiento formal.
              </p>
            </div>
          </div>
          <button
            onClick={handleSyncPending}
            disabled={syncing}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
          </button>
        </div>
      )}

      {/* SECCIÓN 1: LIBRO DIARIO */}
      {section === 'contabilidad-diario' && (
        <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
          <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Libro Diario Contable (Partida Doble)
              </h3>
              <p className="text-xs text-stone-500 mt-1">
                Registro cronológico de asientos con Débitos y Créditos balanceados.
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-bold flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Asiento</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 text-center text-stone-500 text-sm flex items-center justify-center gap-2">
              <LoaderCircle className="w-5 h-5 animate-spin text-[#8C1F25]" />
              <span>Cargando libro diario...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="py-12 text-center text-stone-400 text-sm">
              No hay asientos contables registrados.
            </div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl border border-stone-200 dark:border-[#2C1F1A] overflow-hidden"
                >
                  {/* Encabezado del Asiento */}
                  <div className="bg-[#FAF5ED] dark:bg-[#201613] p-3 px-4 flex items-center justify-between text-xs font-bold">
                    <div className="flex items-center gap-3">
                      <span className="text-[#8C1F25] dark:text-[#E8A598]">
                        Asiento #{entry.entryNumber}
                      </span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-600 dark:text-stone-300 font-normal">
                        {entry.entryDate}
                      </span>
                      <span className="text-stone-400">•</span>
                      <span className="text-stone-800 dark:text-stone-200">
                        {entry.concept}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {entry.origin === 'pos' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          POS {entry.ticketNumber}
                        </span>
                      )}
                      <span className="text-emerald-600 font-bold font-mono">
                        ${formatMoney(entry.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* Líneas del Asiento */}
                  <table className="w-full text-left text-xs">
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

      {/* SECCIÓN 2: BALANCE DE COMPROBACIÓN */}
      {section === 'contabilidad-balances' && (
        <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
          <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Balance de Comprobación y Saldos
            </h3>
            <p className="text-xs text-stone-500 mt-1">
              Sumas y saldos acumulados de todas las cuentas del catálogo.
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
                  className="text-xs text-[#8C1F25] font-bold flex items-center gap-1 mt-2"
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
                  className="px-4 py-2 rounded-xl text-xs text-stone-500"
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