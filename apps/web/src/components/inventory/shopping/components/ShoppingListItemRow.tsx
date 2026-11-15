import React from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { ShoppingItem } from '../../../../types';

interface ShoppingListItemRowProps {
  item: ShoppingItem;
  onSelectPurchase: (item: ShoppingItem) => void;
}

export const ShoppingListItemRow: React.FC<ShoppingListItemRowProps> = ({
  item,
  onSelectPurchase,
}) => {
  const isOutOfStock = item.stock <= 0;
  const deficit = Math.max(0, item.minStock - item.stock);
  const unit = item.unit || 'un';

  return (
    <li
      onClick={() => onSelectPurchase(item)}
      className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors cursor-pointer group select-none ${
        isOutOfStock
          ? 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
          : 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20'
      }`}
    >
      {/* Lado izquierdo: Checkbox + Identificación */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        {/* Botón circular tipo checklist */}
        <div
          className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
            isOutOfStock
              ? 'border-rose-300 dark:border-rose-800 text-rose-500 group-hover:bg-rose-100 dark:group-hover:bg-rose-950/60'
              : 'border-amber-300 dark:border-amber-800 text-amber-600 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/60'
          }`}
          title="Haz clic para registrar compra"
        >
          <CheckCircle2 className="w-5 h-5 opacity-70 group-hover:opacity-100" />
        </div>

        {/* Emoji y datos del ítem */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Estado: Agotado o Queda Poco */}
            {isOutOfStock ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                🚨 AGOTADO (0 {unit})
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                ⚠️ QUEDA POCO ({item.stock} de {item.minStock} {unit})
              </span>
            )}

            {/* Badge de Rubro */}
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                item.kind === 'ingredient'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                  : item.kind === 'resale'
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : item.kind === 'packaging'
                  ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                  : 'bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-300'
              }`}
            >
              {item.kind === 'ingredient'
                ? '🌾 Insumo'
                : item.kind === 'resale'
                ? '🥤 Reventa'
                : item.kind === 'packaging'
                ? '📦 Empaque'
                : '🧤 Insumo General'}
            </span>

            <span className="text-[11px] text-stone-400 font-medium">
              &bull; {item.category}
            </span>

            {item.supplierName && (
              <span className="text-[10px] text-stone-500 font-medium">
                (Prov: {item.supplierName})
              </span>
            )}
          </div>

          {/* Nombre */}
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl select-none shrink-0">{item.icon || '📦'}</span>
            <h3 className="font-bold text-base sm:text-lg text-stone-900 dark:text-[#FBF4EB] group-hover:text-[#8C1F25] dark:group-hover:text-[#E8A598] transition-colors leading-tight">
              {item.name}
            </h3>
          </div>

          {/* Descripción */}
          {item.description && (
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 italic line-clamp-1">
              "{item.description}"
            </p>
          )}
        </div>
      </div>

      {/* Lado derecho: Cuánto se debe comprar + Botón */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
        <div
          className={`px-4 py-2 rounded-xl border text-center ${
            isOutOfStock
              ? 'bg-rose-100/70 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
              : 'bg-amber-100/70 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
          }`}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
            Faltan por comprar
          </span>
          <span className="text-lg sm:text-xl font-black font-sans block">
            {deficit} <span className="text-xs font-bold uppercase">{unit}</span>
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSelectPurchase(item);
          }}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
        >
          <span>Anotar Compra</span>
          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </li>
  );
};
