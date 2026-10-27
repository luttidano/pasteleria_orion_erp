import { useEffect, useState } from 'react';
import {
  DollarSign,
  PieChart,
  FileSpreadsheet,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  X,
  LoaderCircle,
} from 'lucide-react';
import type { ToastMessage } from '../../types';
import { apiFetch } from '../../lib/api';

interface AccountingViewProps {
  section: 'contabilidad-diario' | 'contabilidad-balances' | 'contabilidad-reportes';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface AccountingEntry {
  id: string;
  movementNumber: number;
  date: string;
  concept: string;
  category: 'ingreso' | 'egreso';
  accountId: string;
  account: string;
  amount: number;
  origin: 'manual' | 'pos';
  paymentMethod?: 'efectivo' | 'debito' | 'credito' | 'transferencia' | string | null;
}

interface AccountingAccount {
  id: string;
  code: string;
  name: string;
  accountType: string;
  isActive: boolean;
}

interface CreateMovementPayload {
  movementDate: string;
  concept: string;
  movementType: 'ingreso' | 'egreso';
  accountId: string;
  amount: number;
  paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';
}

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const formatDate = (date: string) => {
  const [year, month, day] = date.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const formatMoney = (amount: number) =>
  amount.toLocaleString('es-CL', { maximumFractionDigits: 2 });

export const AccountingView: React.FC<AccountingViewProps> = ({ section, addToast }) => {
  const [entries, setEntries] = useState<AccountingEntry[]>([]);
  const [accounts, setAccounts] = useState<AccountingAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [movementDate, setMovementDate] = useState(todayISO);
  const [concept, setConcept] = useState('');
  const [movementType, setMovementType] = useState<'ingreso' | 'egreso'>('egreso');
  const [accountId, setAccountId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'efectivo' | 'debito' | 'credito' | 'transferencia'>('efectivo');

  const loadAccountingData = async () => {
    setLoading(true);
    try {
      const [loadedAccounts, loadedEntries, pendingData] = await Promise.all([
        apiFetch<AccountingAccount[]>('/accounting/accounts'),
        apiFetch<AccountingEntry[]>('/accounting/movements'),
        apiFetch<{ pendingCount: number }>('/accounting/pending-sales-count').catch(() => ({ pendingCount: 0 })),
      ]);
      setAccounts(loadedAccounts);
      setEntries(loadedEntries);
      setPendingCount(pendingData.pendingCount);
      setAccountId((current) => current || loadedAccounts[0]?.id || '');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo cargar la contabilidad.';
      addToast({ type: 'error', title: 'Error de contabilidad', message });
    } finally {
      setLoading(false);
    }
  };

  const handleSyncPendingSales = async () => {
    setSyncing(true);
    try {
      const result = await apiFetch<{ synced: number; failed: number }>('/accounting/sync-pending-sales', {
        method: 'POST',
      });
      if (result.synced > 0) {
        addToast({
          type: 'success',
          title: 'Sincronización completada',
          message: `Se contabilizaron ${result.synced} venta(s) del POS exitosamente.${result.failed > 0 ? ` (${result.failed} fallaron)` : ''}`,
        });
      } else if (result.failed > 0) {
        addToast({
          type: 'error',
          title: 'Fallo al sincronizar',
          message: `${result.failed} venta(s) no pudieron contabilizarse. Verifica que la cuenta 4101 exista y esté activa.`,
        });
      } else {
        addToast({
          type: 'info',
          title: 'Sin pendientes',
          message: 'No había ventas pendientes por contabilizar.',
        });
      }
      await loadAccountingData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error al sincronizar ventas.';
      addToast({ type: 'error', title: 'Error de sincronización', message });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    void loadAccountingData();
    // La carga inicial depende únicamente del montaje del componente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalIngresos = entries
    .filter((entry) => entry.category === 'ingreso')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const totalEgresos = entries
    .filter((entry) => entry.category === 'egreso')
    .reduce((sum, entry) => sum + entry.amount, 0);
  const flujoNeto = totalIngresos - totalEgresos;

  const submitMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError('');
    const parsedAmount = Number(amount);
    if (!concept.trim()) {
      setFormError('Ingresa un concepto para el movimiento.');
      return;
    }
    if (!accountId) {
      setFormError('Selecciona una cuenta contable.');
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setFormError('El monto debe ser mayor que cero.');
      return;
    }

    const payload: CreateMovementPayload = {
      movementDate,
      concept: concept.trim(),
      movementType,
      accountId,
      amount: Math.round(parsedAmount * 100) / 100,
      paymentMethod,
    };

    setSaving(true);
    try {
      const created = await apiFetch<AccountingEntry>('/accounting/movements', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setEntries((current) => [created, ...current]);
      setConcept('');
      setAmount('');
      setPaymentMethod('efectivo');
      setMovementDate(todayISO());
      setShowForm(false);
      addToast({
        type: 'success',
        title: 'Movimiento registrado',
        message: 'El movimiento contable se guardó correctamente.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar el movimiento.';
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* 1. SECCIÓN: LIBRO DIARIO Y FLUJO */}
      {section === 'contabilidad-diario' && (
        <div className="space-y-6">
          {/* Métricas de Finanzas Diarias */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
                <span>Ingresos Registrados</span>
                <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600">
                  <ArrowUpRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-emerald-700 dark:text-emerald-400 font-sans mt-2">
                +${formatMoney(totalIngresos)}
              </div>
              <span className="text-[11px] text-stone-400 mt-1 block">Ventas de pastelería y cafetería</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
                <span>Egresos & Materias</span>
                <span className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600">
                  <ArrowDownRight className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-rose-700 dark:text-rose-400 font-sans mt-2">
                -${formatMoney(totalEgresos)}
              </div>
              <span className="text-[11px] text-stone-400 mt-1 block">Compras de insumos y gastos</span>
            </div>

            <div className="p-5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#EADBCE] dark:border-[#35251F] shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-stone-500 uppercase tracking-wider">
                <span>Flujo Neto del Período</span>
                <span className="p-1.5 rounded-lg bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25]">
                  <DollarSign className="w-4 h-4" />
                </span>
              </div>
              <div className="text-2xl sm:text-3xl font-black text-[#8C1F25] dark:text-[#E8A598] font-sans mt-2">
                ${formatMoney(flujoNeto)}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">{flujoNeto >= 0 ? 'Flujo positivo' : 'Flujo negativo'}</span>
            </div>
          </div>

          {/* Libro diario conectado a la API */}
          <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                  Libro Diario & Movimientos de Caja
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Movimientos guardados en la base de datos contable.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setFormError(''); setShowForm(true); }}
                className="px-4 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                + Registrar Gasto / Entrada
              </button>
            </div>

            {/* Banner de ventas POS pendientes de contabilizar */}
            {pendingCount > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center gap-2.5">
                  <span className="text-base select-none">⚠️</span>
                  <div>
                    <span className="font-bold">Hay {pendingCount} venta(s) del POS pendiente(s) de contabilizar.</span>
                    <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80 mt-0.5">
                      Fueron cobradas en caja pero su asiento automático requiere sincronización (ej.: cuenta 4101).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSyncPendingSales}
                  disabled={syncing}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-[0.98] text-white font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0 transition-all shadow-xs"
                >
                  {syncing && <LoaderCircle className="w-3.5 h-3.5 animate-spin" />}
                  <span>{syncing ? 'Sincronizando...' : 'Sincronizar ahora'}</span>
                </button>
              </div>
            )}

            {showForm && (
              <form onSubmit={submitMovement} className="rounded-2xl border border-[#EADBCE] dark:border-[#35251F] bg-[#FAF5ED] dark:bg-[#201613] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="font-bold text-sm text-[#2A1B16] dark:text-[#FDF5EE]">Nuevo movimiento contable</h4>
                  <button type="button" aria-label="Cerrar formulario" onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-stone-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 space-y-1.5">
                    Fecha
                    <input type="date" required value={movementDate} onChange={(event) => setMovementDate(event.target.value)} className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#16100E] px-3 py-2.5 text-sm" />
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 space-y-1.5">
                    Tipo de movimiento
                    <select value={movementType} onChange={(event) => setMovementType(event.target.value as 'ingreso' | 'egreso')} className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#16100E] px-3 py-2.5 text-sm">
                      <option value="egreso">Egreso / Gasto</option>
                      <option value="ingreso">Ingreso / Entrada</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 space-y-1.5 sm:col-span-2">
                    Concepto / Glosa
                    <input required maxLength={200} value={concept} onChange={(event) => setConcept(event.target.value)} placeholder="Ej.: Compra de harina para producción" className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#16100E] px-3 py-2.5 text-sm" />
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 space-y-1.5">
                    Cuenta contable
                    <select required value={accountId} onChange={(event) => setAccountId(event.target.value)} className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#16100E] px-3 py-2.5 text-sm">
                      <option value="" disabled>Selecciona una cuenta</option>
                      {accounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.code} - {account.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 space-y-1.5">
                    Método de pago
                    <select required value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as typeof paymentMethod)} className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#16100E] px-3 py-2.5 text-sm">
                      <option value="efectivo">Efectivo</option>
                      <option value="debito">Débito</option>
                      <option value="credito">Crédito</option>
                      <option value="transferencia">Transferencia</option>
                    </select>
                  </label>
                  <label className="text-xs font-semibold text-stone-700 dark:text-stone-300 space-y-1.5">
                    Monto (CLP)
                    <input required type="number" min="0.01" max="9999999999.99" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0" className="w-full rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#16100E] px-3 py-2.5 text-sm" />
                  </label>
                </div>
                {formError && <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">{formError}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 text-xs font-bold">Cancelar</button>
                  <button type="submit" disabled={saving || accounts.length === 0} className="px-4 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] disabled:opacity-50 text-white text-xs font-bold inline-flex items-center gap-2">
                    {saving && <LoaderCircle className="w-4 h-4 animate-spin" />}
                    {saving ? 'Guardando...' : 'Guardar movimiento'}
                  </button>
                </div>
              </form>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300">
                    <th className="py-3 px-3 text-center">N.º</th>
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-6">Concepto / Glosa</th>
                    <th className="py-3 px-4">Cuenta Contable</th>
                    <th className="py-3 px-4 text-center">Método de pago</th>
                    <th className="py-3 px-4 text-center">Tipo</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                  {loading ? (
                    <tr><td colSpan={7} className="py-10 text-center text-sm text-stone-500">Cargando movimientos contables...</td></tr>
                  ) : entries.length === 0 ? (
                    <tr><td colSpan={7} className="py-10 text-center text-sm text-stone-500">Todavía no hay movimientos contables registrados.</td></tr>
                  ) : entries.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors">
                      <td className="py-3 px-3 text-center text-xs font-mono font-bold text-stone-500">{item.movementNumber ? String(item.movementNumber).padStart(5, '0') : '—'}</td>
                      <td className="py-3 px-4 text-xs font-mono text-stone-500">{formatDate(item.date)}</td>
                      <td className="py-3 px-6 font-semibold text-xs text-stone-900 dark:text-stone-100">
                        {item.concept}
                        {item.origin === 'pos' && <span className="ml-2 text-[9px] font-bold uppercase text-sky-700 dark:text-sky-300">POS</span>}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-stone-600 dark:text-stone-400">{item.account}</td>
                      <td className="py-3 px-4 text-center">
                        {item.paymentMethod ? (
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-sky-100 dark:bg-sky-950/60 text-sky-800 dark:text-sky-300 text-[10px] font-bold uppercase">
                            {({ efectivo: 'Efectivo', debito: 'Débito', credito: 'Crédito', transferencia: 'Transferencia' } as Record<string, string>)[item.paymentMethod] ?? item.paymentMethod}
                          </span>
                        ) : (
                          <span className="text-xs text-stone-400">No aplica</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${item.category === 'ingreso' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'}`}>
                          {item.category}
                        </span>
                      </td>
                      <td className={`py-3 px-4 text-right font-bold text-xs font-sans ${item.category === 'ingreso' ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                        {item.category === 'ingreso' ? '+' : '-'}${formatMoney(item.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. SECCIÓN: COSTOS Y BALANCES */}
      {section === 'contabilidad-balances' && (
        <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
          <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Márgenes de Contribución por Línea de Producto
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Relación entre el costo de insumos en bodega y el precio de venta en mostrador.
              </p>
            </div>
            <PieChart className="w-6 h-6 text-[#8C1F25] dark:text-[#D4A373]" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100">🎂 Tortas & Pasteles</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                  74% Margen
                </span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '74%' }}></div>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Costo Insumos: 26%</span>
                <span>Margen Bruto: 74%</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100">🥐 Bollería Francesa</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                  66% Margen
                </span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '66%' }}></div>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Costo Insumos: 34%</span>
                <span>Margen Bruto: 66%</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100">☕ Cafetería de Especialidad</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                  81% Margen
                </span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '81%' }}></div>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Costo Insumos: 19%</span>
                <span>Margen Bruto: 81%</span>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sm text-stone-900 dark:text-stone-100">🍫 Chocolatería Artesanal</span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-100 text-emerald-800">
                  68% Margen
                </span>
              </div>
              <div className="w-full bg-stone-200 dark:bg-stone-700 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-600 h-full rounded-full" style={{ width: '68%' }}></div>
              </div>
              <div className="flex justify-between text-xs text-stone-500">
                <span>Costo Insumos: 32%</span>
                <span>Margen Bruto: 68%</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. SECCIÓN: REPORTES FINANCIEROS */}
      {section === 'contabilidad-reportes' && (
        <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
          <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Informes Financieros & Balance Mensual
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                Genera estados de resultados para análisis tributario y gestión del negocio.
              </p>
            </div>
            <FileSpreadsheet className="w-6 h-6 text-[#8C1F25] dark:text-[#D4A373]" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">Estado de Resultados (P&L)</h4>
                <p className="text-xs text-stone-500 mt-0.5">Ventas netas, costos directos y utilidad bruta</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  addToast({
                    type: 'success',
                    title: 'Descarga iniciada',
                    message: 'Generando Estado_Resultados_Orion_Octubre.xlsx',
                  })
                }
                className="p-2.5 rounded-xl bg-white dark:bg-[#2C1D18] border border-stone-200 dark:border-stone-700 hover:text-[#8C1F25] flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            </div>

            <div className="p-5 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] flex items-center justify-between">
              <div>
                <h4 className="font-bold text-sm text-stone-900 dark:text-stone-100">Libro de Compras & Ventas</h4>
                <p className="text-xs text-stone-500 mt-0.5">Conciliación con Servicio de Impuestos Internos</p>
              </div>
              <button
                type="button"
                onClick={() =>
                  addToast({
                    type: 'success',
                    title: 'Descarga iniciada',
                    message: 'Generando Libro_Compras_Ventas_Octubre.csv',
                  })
                }
                className="p-2.5 rounded-xl bg-white dark:bg-[#2C1D18] border border-stone-200 dark:border-stone-700 hover:text-[#8C1F25] flex items-center gap-1.5 text-xs font-bold cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Exportar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
