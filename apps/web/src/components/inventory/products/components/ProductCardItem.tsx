import React from 'react';
import {
  BookOpen,
  Edit2,
  Sparkles,
  Trash2,
  Truck,
} from 'lucide-react';
import type { CatalogProduct } from '../../../../types';
import { formatMoney } from '../../../../utils/formatters';

interface ProductCardItemProps {
  product: CatalogProduct;
  isAdmin: boolean;
  onOpenAdjustmentModal: (product: CatalogProduct, delta: number) => void;
  onEdit: (product: CatalogProduct) => void;
  onDelete: (product: CatalogProduct) => void;
}

export const ProductCardItem: React.FC<ProductCardItemProps> = ({
  product: p,
  isAdmin,
  onOpenAdjustmentModal,
  onEdit,
  onDelete,
}) => {
  const isManufactured = p.productType === 'manufactured';
  const margin =
    p.costPrice && p.salePrice > 0
      ? Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100)
      : null;

  return (
    <div className="p-5 rounded-2xl bg-white dark:bg-[#16100E] border border-[#E8D7BE] dark:border-[#2C1D18] shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="text-3xl select-none p-1.5 bg-[#FAF5ED] dark:bg-[#201612] rounded-xl border border-[#DFCAA9]/50">
              {p.icon || (isManufactured ? '🧁' : '🥤')}
            </span>
            <div>
              <h4 className="text-sm font-bold text-[#1C120D] dark:text-[#FBF4EB] leading-tight">
                {p.name}
              </h4>
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${
                  isManufactured
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                }`}
              >
                {isManufactured ? <Sparkles className="w-2.5 h-2.5" /> : <Truck className="w-2.5 h-2.5" />}
                {isManufactured ? 'Elaboración Propia' : 'Reventa'}
              </span>
            </div>
          </div>

          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md ${
              p.status === 'suficiente'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                : p.status === 'bajo'
                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
                : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
            }`}
          >
            {p.status === 'suficiente' ? 'Disponible' : p.status === 'bajo' ? 'Poco Stock' : 'Agotado'}
          </span>
        </div>

        {/* Origen (Receta o Proveedor) */}
        <div className="text-xs text-stone-600 dark:text-stone-400 mt-2 space-y-1">
          {isManufactured && p.recipeName && (
            <p className="flex items-center gap-1 text-[11px]">
              <BookOpen className="w-3 h-3 text-[#8C1F25]" />
              <span>Receta: {p.recipeName}</span>
            </p>
          )}
          {!isManufactured && p.supplierName && (
            <p className="flex items-center gap-1 text-[11px]">
              <Truck className="w-3 h-3 text-blue-600" />
              <span>Proveedor: {p.supplierName}</span>
            </p>
          )}
        </div>

        {/* Precios y Margen */}
        <div className="mt-3 pt-3 border-t border-stone-100 dark:border-[#221814] flex items-center justify-between text-xs">
          <div>
            <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Precio Venta</span>
            <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
              {formatMoney(p.salePrice)}
            </span>
          </div>
          {p.costPrice ? (
            <div className="text-right">
              <span className="text-[10px] text-stone-500 dark:text-stone-400 block">Costo / Margen</span>
              <span className="text-xs font-semibold text-stone-700 dark:text-stone-300">
                {formatMoney(p.costPrice)} {margin !== null && `(${margin}%)`}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Stock y Acciones */}
      <div className="mt-4 pt-3 border-t border-stone-100 dark:border-[#221814] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onOpenAdjustmentModal(p, -1)}
            disabled={p.stock <= 0}
            className="w-7 h-7 rounded-lg border border-stone-300 dark:border-stone-700 font-bold text-xs hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-40 cursor-pointer"
          >
            -
          </button>
          <span className="text-sm font-bold min-w-10 text-center">
            {p.stock} <span className="text-[10px] text-stone-500 font-normal">{p.unit}</span>
          </span>
          <button
            type="button"
            onClick={() => onOpenAdjustmentModal(p, 1)}
            className={`w-7 h-7 rounded-lg border font-bold text-xs cursor-pointer ${
              p.productType === 'manufactured'
                ? 'border-dashed border-stone-300 dark:border-stone-700 text-stone-400 hover:text-amber-700 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/30'
                : 'border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800'
            }`}
            title={
              p.productType === 'manufactured'
                ? 'Para aumentar stock, hornea tandas en Gestión de Recetas'
                : 'Registrar compra o sobrante'
            }
          >
            +
          </button>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onEdit(p)}
              className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              title="Modificar"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(p)}
              className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
              title="Eliminar"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
