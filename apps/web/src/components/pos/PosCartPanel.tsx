import React from 'react';
import {
  ArrowLeftRight,
  Banknote,
  CheckCircle2,
  CreditCard,
  Store,
  WifiOff,
} from 'lucide-react';
import type { PosPaymentMethod } from '../../types';
import { formatMoney } from '../../utils/formatters';
import type { CartItem } from './posPrint';

interface PosCartPanelProps {
  cart: CartItem[];
  subtotal: number;
  iva: number;
  total: number;
  paymentMethod: PosPaymentMethod;
  onPaymentMethodChange: (method: PosPaymentMethod) => void;
  isSavingSale: boolean;
  isOnline?: boolean;
  onUpdateQuantity: (cartKey: string, delta: number) => void;
  onClearCart: () => void;
  onCompleteSale: () => void;
}

const PAYMENT_OPTIONS: Array<{
  value: PosPaymentMethod;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { value: 'debito', label: 'Débito', Icon: CreditCard },
  { value: 'efectivo', label: 'Efectivo', Icon: Banknote },
  { value: 'credito', label: 'Crédito', Icon: CreditCard },
  { value: 'transferencia', label: 'Transferencia', Icon: ArrowLeftRight },
];

export const PosCartPanel: React.FC<PosCartPanelProps> = ({
  cart,
  subtotal,
  iva,
  total,
  paymentMethod,
  onPaymentMethodChange,
  isSavingSale,
  isOnline = true,
  onUpdateQuantity,
  onClearCart,
  onCompleteSale,
}) => {
  return (
    <div className="lg:col-span-5 space-y-4">
      <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
        <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
          <div className="flex items-center gap-2">
            <Store className="w-5 h-5 text-[#8C1F25] dark:text-[#E8A598]" />
            <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 font-serif">
              Ticket en Mostrador
            </h3>
          </div>
          {cart.length > 0 && (
            <button
              type="button"
              onClick={onClearCart}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer"
            >
              Vaciar
            </button>
          )}
        </div>

        {/* Items en el ticket */}
        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {cart.length === 0 ? (
            <div className="py-8 text-center text-stone-400 text-xs">
              El carrito está vacío. Haz clic en los productos para agregarlos.
            </div>
          ) : (
            cart.map((item) => (
              <div
                key={item.cartKey}
                className="p-2.5 rounded-xl bg-[#FAF5ED] dark:bg-[#1E1512] flex items-center justify-between gap-2 border border-[#EADBCE]/60 dark:border-[#35251F]"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                    {item.name}
                  </div>
                  <div className="text-[11px] text-stone-500 font-sans">
                    {formatMoney(item.price)} c/u • Máx: {item.stock} {item.unit}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.cartKey, -1)}
                    className="w-6 h-6 rounded-md bg-white dark:bg-[#2A1D18] flex items-center justify-center text-xs text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="font-bold text-xs w-4 text-center">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onUpdateQuantity(item.cartKey, 1)}
                    disabled={item.quantity >= item.stock}
                    className="w-6 h-6 rounded-md bg-white dark:bg-[#2A1D18] flex items-center justify-center text-xs text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>

                <div className="font-bold text-xs text-stone-900 dark:text-stone-100 w-16 text-right font-sans shrink-0">
                  {formatMoney(item.price * item.quantity)}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totales */}
        <div className="pt-3 border-t border-[#EADBCE] dark:border-[#35251F] space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
          <div className="flex justify-between">
            <span>Subtotal Neto:</span>
            <span className="font-mono">{formatMoney(subtotal - iva)}</span>
          </div>
          <div className="flex justify-between">
            <span>IVA (19%):</span>
            <span className="font-mono">{formatMoney(iva)}</span>
          </div>
          <div className="flex justify-between text-base font-extrabold text-stone-900 dark:text-white pt-2 border-t border-stone-100 dark:border-[#281C17]">
            <span>Total a Pagar:</span>
            <span className="text-[#8C1F25] dark:text-[#E25C64] font-sans">
              {formatMoney(total)}
            </span>
          </div>
        </div>

        {/* Selector de Método de Pago */}
        <div>
          <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
            Medio de Pago:
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            {PAYMENT_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onPaymentMethodChange(value)}
                className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer ${
                  paymentMethod === value
                    ? 'bg-[#8C1F25] text-white border-[#8C1F25]'
                    : 'bg-white dark:bg-[#1E1512] text-stone-700 dark:text-stone-300 border-[#EADBCE] dark:border-[#35251F]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>

        {!isOnline && (
          <div
            role="status"
            className="flex items-center gap-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-200 text-xs font-medium"
          >
            <WifiOff className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>Sin conexión con el servidor ERP. Cobro deshabilitado hasta recuperar red.</span>
          </div>
        )}

        {/* Botón de Cobro */}
        <button
          type="button"
          onClick={onCompleteSale}
          disabled={!isOnline || isSavingSale || cart.length === 0}
          className="w-full py-3.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white text-sm font-bold shadow-btn transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>
            {!isOnline
              ? 'Sin conexión (Cobro bloqueado)'
              : isSavingSale
                ? 'Registrando venta...'
                : `Cobrar ${formatMoney(total)}`}
          </span>
        </button>
      </div>
    </div>
  );
};

