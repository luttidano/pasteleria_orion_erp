import React from 'react';
import { Boxes, Building2, CreditCard, ShieldCheck } from 'lucide-react';
import type { BalanceSheetData } from '../../types';
import { formatMoney } from '../../utils/formatters';
import { InventoryValuationCard } from './InventoryValuationCard';

interface BalanceSheetSectionProps {
  balanceSheet: BalanceSheetData;
}

export const BalanceSheetSection: React.FC<BalanceSheetSectionProps> = ({ balanceSheet }) => {
  const { inventoryValuation } = balanceSheet;

  return (
    <>
      {/* 4. SECCIÓN: BALANCE GENERAL (SITUACIÓN FINANCIERA) */}
      <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
          <div>
            <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Balance General / Estado de Situación Financiera
            </h4>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Agrupación formal: Activo = Pasivo + Patrimonio (Permite saber cuánto vale la empresa y
              cuánto se debe)
            </p>
          </div>
          <div className="text-xs text-stone-500 font-mono">Corte al: {balanceSheet.asOfDate}</div>
        </div>

        {/* Grid 2 Columnas: ACTIVOS vs PASIVOS + PATRIMONIO */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* LADO IZQUIERDO: ACTIVOS */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-100 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                <span className="font-bold text-sm text-stone-900 dark:text-white uppercase">
                  TOTAL ACTIVOS
                </span>
              </div>
              <span className="text-xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {formatMoney(balanceSheet.activos.total)}
              </span>
            </div>

            {/* Grupo Disponible */}
            <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
              <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <span>Activo Disponible (Caja y Bancos)</span>
                <span className="font-mono">{formatMoney(balanceSheet.activos.disponible.total)}</span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                {balanceSheet.activos.disponible.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo Inventarios */}
            <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
              <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <span>Inventarios Contables (Materias Primas y Terminado)</span>
                <span className="font-mono">
                  {formatMoney(balanceSheet.activos.inventarios.total)}
                </span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                {balanceSheet.activos.inventarios.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Grupo Otros Activos */}
            {balanceSheet.activos.otrosActivos.accounts.length > 0 && (
              <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
                <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                  <span>Otros Activos (Crédito Fiscal y Otros)</span>
                  <span className="font-mono">
                    {formatMoney(balanceSheet.activos.otrosActivos.total)}
                  </span>
                </div>
                <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                  {balanceSheet.activos.otrosActivos.accounts.map((acc) => (
                    <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                      <span className="text-stone-600 dark:text-stone-400 font-medium">
                        <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                        {acc.name}
                      </span>
                      <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* LADO DERECHO: PASIVOS Y PATRIMONIO */}
          <div className="space-y-4">
            {/* Pasivos */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-100 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-rose-600" />
                <span className="font-bold text-sm text-stone-900 dark:text-white uppercase">
                  TOTAL PASIVOS (DEUDAS)
                </span>
              </div>
              <span className="text-xl font-bold font-mono text-rose-700 dark:text-rose-400">
                {formatMoney(balanceSheet.pasivos.total)}
              </span>
            </div>

            {/* Desglose Pasivos */}
            <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
              <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <span>Obligaciones, Impuestos y Otros Pasivos</span>
                <span className="font-mono">{formatMoney(balanceSheet.pasivos.total)}</span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                {balanceSheet.pasivos.obligaciones.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                  </div>
                ))}
                {balanceSheet.pasivos.impuestos.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                  </div>
                ))}
                {balanceSheet.pasivos.otrosPasivos.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Patrimonio */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-100 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span className="font-bold text-sm text-stone-900 dark:text-white uppercase">
                  PATRIMONIO NETO
                </span>
              </div>
              <span className="text-xl font-bold font-mono text-blue-700 dark:text-blue-400">
                {formatMoney(balanceSheet.patrimonio.total)}
              </span>
            </div>

            {/* Desglose Patrimonio */}
            <div className="rounded-2xl border border-stone-200/80 dark:border-[#2C1F1A] overflow-hidden">
              <div className="bg-stone-50 dark:bg-[#1C1411] px-4 py-2.5 flex items-center justify-between text-xs font-bold text-stone-700 dark:text-stone-300">
                <span>Composición del Patrimonio</span>
                <span className="font-mono">{formatMoney(balanceSheet.patrimonio.total)}</span>
              </div>
              <div className="divide-y divide-stone-100 dark:divide-[#281C17] bg-white dark:bg-[#16100E]">
                {balanceSheet.patrimonio.capital.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-stone-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold">{formatMoney(acc.amount)}</span>
                  </div>
                ))}
                {balanceSheet.patrimonio.resultadosAcumulados?.accounts.map((acc) => (
                  <div key={acc.id} className="px-4 py-2 flex items-center justify-between text-xs bg-amber-50/20 dark:bg-amber-950/10">
                    <span className="text-stone-600 dark:text-stone-400 font-medium">
                      <b className="font-mono text-amber-700 dark:text-amber-400 mr-2">{acc.code}</b>
                      {acc.name}
                    </span>
                    <span className="font-mono font-semibold text-stone-800 dark:text-stone-200">
                      {formatMoney(acc.amount)}
                    </span>
                  </div>
                ))}
                <div className="px-4 py-2.5 flex items-center justify-between text-xs bg-blue-50/40 dark:bg-blue-950/20">
                  <span className="font-semibold text-blue-900 dark:text-blue-300">
                    Resultado del Ejercicio
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400">
                    {formatMoney(balanceSheet.patrimonio.resultadoEjercicio)}
                  </span>
                </div>
              </div>
            </div>

            {/* Total Pasivo + Patrimonio */}
            <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border-2 border-stone-300 dark:border-stone-700 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold uppercase text-stone-600 dark:text-stone-300">
                  Total Pasivo + Patrimonio
                </span>
                <p className="text-[11px] text-stone-400">Pasivo ($) + Patrimonio ($)</p>
              </div>
              <span className="text-2xl font-black font-mono text-stone-900 dark:text-white">
                {formatMoney(balanceSheet.totalPasivoMasPatrimonio)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. SECCIÓN: VALORIZACIÓN EN TIEMPO REAL DE BODEGA E INVENTARIOS */}
      <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
        <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <Boxes className="w-5 h-5 text-[#8C1F25]" />
              <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Valorización de Inventario Físico en Bodega & Mostrador
              </h4>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              Muestra en tiempo real cuánta harina, materias primas e insumos hay almacenados y
              cuánto producto terminado está listo para venta.
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs uppercase font-bold text-stone-400 block">
              Total Inventario Valorizado
            </span>
            <span className="text-xl font-bold font-mono text-[#8C1F25] dark:text-[#E8A598]">
              {formatMoney(inventoryValuation.totalWarehouseValue)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <InventoryValuationCard
            title="Harina e Insumos en Bodega (Materia Prima)"
            totalValue={inventoryValuation.rawMaterialsValue}
            items={inventoryValuation.topRawMaterials}
            itemHeaderLabel="Insumo"
            emptyLabel="Sin materias primas registradas."
            headerClassName="bg-amber-50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
          />

          <InventoryValuationCard
            title="Cajas y Empaques (Stock)"
            totalValue={inventoryValuation.packagingValue ?? 0}
            items={inventoryValuation.topPackaging}
            itemHeaderLabel="Empaque"
            costHeaderLabel="Costo"
            totalHeaderLabel="Total"
            emptyLabel="Sin empaques registrados."
            headerClassName="bg-orange-50 dark:bg-orange-950/20 text-orange-900 dark:text-orange-200"
          />

          <InventoryValuationCard
            title="Productos Terminados Listos para Venta"
            totalValue={inventoryValuation.finishedProductsValue}
            items={inventoryValuation.topProducts}
            itemHeaderLabel="Producto"
            emptyLabel="Sin productos en catálogo."
            headerClassName="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200"
          />
        </div>
      </div>
    </>
  );
};

