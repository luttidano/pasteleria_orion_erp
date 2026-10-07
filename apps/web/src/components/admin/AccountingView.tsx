import { useState } from 'react';
import {
  DollarSign,
  PieChart,
  FileSpreadsheet,
  Download,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { ToastMessage } from '../../types';

interface AccountingViewProps {
  section: 'contabilidad-diario' | 'contabilidad-balances' | 'contabilidad-reportes';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface AccountingEntry {
  id: string;
  date: string;
  concept: string;
  category: 'ingreso' | 'egreso';
  account: string;
  amount: number;
}

const INITIAL_ENTRIES: AccountingEntry[] = [
  { id: 'acc-1', date: '07/10/2026', concept: 'Ventas Turno Mañana Mostrador POS', category: 'ingreso', account: '1101 - Caja Efectivo', amount: 87200 },
  { id: 'acc-2', date: '07/10/2026', concept: 'Ventas Transbank Tarjetas', category: 'ingreso', account: '1102 - Banco Santander', amount: 145900 },
  { id: 'acc-3', date: '07/10/2026', concept: 'Compra Harina y Polvos (Molino Central)', category: 'egreso', account: '5101 - Costo Materia Prima', amount: 48500 },
  { id: 'acc-4', date: '06/10/2026', concept: 'Compra Mantequilla y Crema (Distribuidora)', category: 'egreso', account: '5101 - Costo Materia Prima', amount: 62000 },
  { id: 'acc-5', date: '06/10/2026', concept: 'Cajas y Empaques Pastelería (Envases Chile)', category: 'egreso', account: '5201 - Insumos Operativos', amount: 18500 },
  { id: 'acc-6', date: '05/10/2026', concept: 'Pago Servicios Luz y Gas Hornos Industriales', category: 'egreso', account: '6102 - Gastos Generales', amount: 55000 },
];

export const AccountingView: React.FC<AccountingViewProps> = ({ section, addToast }) => {
  const [entries] = useState<AccountingEntry[]>(INITIAL_ENTRIES);

  const totalIngresos = entries
    .filter((e) => e.category === 'ingreso')
    .reduce((acc, e) => acc + e.amount, 0);

  const totalEgresos = entries
    .filter((e) => e.category === 'egreso')
    .reduce((acc, e) => acc + e.amount, 0);

  const flujoNeto = totalIngresos - totalEgresos;

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
                +${totalIngresos.toLocaleString('es-CL')}
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
                -${totalEgresos.toLocaleString('es-CL')}
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
                ${flujoNeto.toLocaleString('es-CL')}
              </div>
              <span className="text-[11px] text-emerald-600 font-semibold mt-1 block">Margen operativo positivo</span>
            </div>
          </div>

          {/* Tabla de Asientos Contables */}
          <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
              <div>
                <h3 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                  Libro Diario & Movimientos de Caja
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Registro cronológico de operaciones financieras de la pastelería.
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  addToast({
                    type: 'info',
                    title: 'Nuevo Movimiento',
                    message: 'Formulario de asiento contable rápido habilitado.',
                  })
                }
                className="px-4 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                + Registrar Gasto / Entrada
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300">
                    <th className="py-3 px-4">Fecha</th>
                    <th className="py-3 px-6">Concepto / Glosa</th>
                    <th className="py-3 px-4">Cuenta Contable</th>
                    <th className="py-3 px-4 text-center">Tipo</th>
                    <th className="py-3 px-4 text-right">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                  {entries.map((item) => (
                    <tr key={item.id} className="hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-stone-500">{item.date}</td>
                      <td className="py-3 px-6 font-semibold text-xs text-stone-900 dark:text-stone-100">
                        {item.concept}
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-stone-600 dark:text-stone-400">
                        {item.account}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            item.category === 'ingreso'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {item.category}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-bold text-xs font-sans ${
                          item.category === 'ingreso'
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {item.category === 'ingreso' ? '+' : '-'}${item.amount.toLocaleString('es-CL')}
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
