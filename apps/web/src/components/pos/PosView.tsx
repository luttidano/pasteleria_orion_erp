import { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import {
  Store,
  CreditCard,
  Banknote,
  CheckCircle2,
  Calendar,
} from 'lucide-react';
import type { ToastMessage } from '../../types';

interface PosViewProps {
  section: 'pos-caja' | 'pos-historial' | 'pos-cierre';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface PosProduct {
  id: string;
  name: string;
  price: number;
  category: string;
  icon: string;
}

const BAKERY_POS_ITEMS: PosProduct[] = [
  { id: 'pos-1', name: 'Torta Selva Negra (Porción)', price: 3800, category: 'Tortas', icon: '🎂' },
  { id: 'pos-2', name: 'Croissant Mantequilla', price: 1900, category: 'Bollería', icon: '🥐' },
  { id: 'pos-3', name: 'Cheesecake Frutos Rojos', price: 3900, category: 'Postres', icon: '🍰' },
  { id: 'pos-4', name: 'Pie de Limón Merengado', price: 3200, category: 'Tartas', icon: '🍋' },
  { id: 'pos-5', name: 'Medialunas Artesanales (x3)', price: 2600, category: 'Bollería', icon: '🥐' },
  { id: 'pos-6', name: 'Café Cappuccino Especial', price: 2400, category: 'Cafetería', icon: '☕' },
  { id: 'pos-7', name: 'Brownie Chocolate Nuez', price: 2200, category: 'Chocolates', icon: '🍫' },
  { id: 'pos-8', name: 'Torta Tres Leches (Porción)', price: 3600, category: 'Tortas', icon: '🧁' },
];

interface CartItem extends PosProduct {
  quantity: number;
}

interface SaleTicket {
  id: string;
  ticketNumber: string;
  time: string;
  itemsSummary: string;
  total: number;
  paymentMethod: string;
  status: 'completada' | 'anulada';
}
//los tickets ficticios
/* const INITIAL_TICKETS: SaleTicket[] = [
  { id: 'tk-1', ticketNumber: '#TK-1082', time: '11:42 AM', itemsSummary: '2x Selva Negra, 1x Café Cappuccino', total: 10000, paymentMethod: 'Tarjeta Débito', status: 'completada' },
  { id: 'tk-2', ticketNumber: '#TK-1081', time: '11:15 AM', itemsSummary: '1x Croissant Mantequilla, 1x Cappuccino', total: 4300, paymentMethod: 'Efectivo', status: 'completada' },
  { id: 'tk-3', ticketNumber: '#TK-1080', time: '10:48 AM', itemsSummary: '3x Medialunas, 2x Pie de Limón', total: 9000, paymentMethod: 'Transferencia', status: 'completada' },
  { id: 'tk-4', ticketNumber: '#TK-1079', time: '10:20 AM', itemsSummary: '1x Cheesecake Frutos Rojos', total: 3900, paymentMethod: 'Tarjeta Crédito', status: 'completada' },
]; */
interface SaleApiItem {
  id: string;
  sale_id: string;
  product_id: string | null;
  product_name: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
}

interface SaleApiResponse {
  id: string;
  ticketNumber: string;
  paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';
  subtotal: number;
  taxAmount: number;
  total: number;
  status: 'completada' | 'anulada';
  soldAt: string;
  dataOrigin: 'demo' | 'real';
  items: SaleApiItem[];
}

const paymentMethodLabel = (
  method: SaleApiResponse['paymentMethod'],
): string => {
  switch (method) {
    case 'efectivo':
      return 'Efectivo';
    case 'debito':
      return 'Tarjeta Débito';
    case 'credito':
      return 'Tarjeta Crédito';
    case 'transferencia':
      return 'Transferencia';
  }
};

const mapSaleToTicket = (sale: SaleApiResponse): SaleTicket => ({
  id: sale.id,
  ticketNumber: sale.ticketNumber.startsWith('#')
    ? sale.ticketNumber
    : `#${sale.ticketNumber}`,
  time: new Date(sale.soldAt).toLocaleTimeString('es-CL', {
    hour: '2-digit',
    minute: '2-digit',
  }),
  itemsSummary: sale.items
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(', '),
  total: Number(sale.total),
  paymentMethod: paymentMethodLabel(sale.paymentMethod),
  status: sale.status,
});

export const PosView: React.FC<PosViewProps> = ({ section, addToast }) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
  'efectivo' | 'debito' | 'credito' | 'transferencia'
  >('debito');

  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);


  useEffect(() => {
  if (section !== 'pos-historial' && section !== 'pos-cierre') {
    return;
  }

  let cancelled = false;

  const loadSales = async () => {
    setIsLoadingTickets(true);

    try {
      const sales = await apiFetch<SaleApiResponse[]>('/pos/sales');

      if (!cancelled) {
        setTickets(sales.map(mapSaleToTicket));
      }
    } catch (error) {
      if (!cancelled) {
        addToast({
          type: 'error',
          title: 'Error al cargar las ventas',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudo consultar el historial de ventas.',
        });
      }
    } finally {
      if (!cancelled) {
        setIsLoadingTickets(false);
      }
    }
  };

  void loadSales();

  return () => {
    cancelled = true;
  };
},
[section, addToast]);

  /* // Totales
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal; */

  // Totales: los precios del catálogo incluyen IVA.
const subtotal = cart.reduce(
  (acc, item) => acc + item.price * item.quantity,
  0,
);

const iva = Math.round((subtotal * 19) / 119);
const total = subtotal;

  const addToCart = (product: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.id === id) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const clearCart = () => setCart([]);

  const handleCompleteSale = async () => {
  if (isSavingSale) {
    return;
  }

  if (cart.length === 0) {
    addToast({
      type: 'error',
      title: 'Venta vacía',
      message: 'Agrega al menos un producto al carrito para cobrar.',
    });
    return;
  }

  setIsSavingSale(true);

  try {
    const savedSale = await apiFetch<SaleApiResponse>('/pos/sales', {
      method: 'POST',
      body: JSON.stringify({
        paymentMethod,
        subtotal: total - iva,
        taxAmount: iva,
        total,
        items: cart.map((item) => ({
          productName: item.name,
          quantity: item.quantity,
          unitPrice: item.price,

          // Los productos pos-1, pos-2, etc. son ficticios.
          // No enviamos productId porque no son UUID de Supabase.
        })),
      }),
    });

    const newTicket = mapSaleToTicket(savedSale);

    setTickets((previousTickets) => [
      newTicket,
      ...previousTickets.filter((ticket) => ticket.id !== newTicket.id),
    ]);

    addToast({
      type: 'success',
      title: `¡Venta registrada ${newTicket.ticketNumber}!`,
      message: `Total cobrado: $${savedSale.total.toLocaleString('es-CL')} mediante ${newTicket.paymentMethod}.`,
    });

    // Solo vaciar el carrito después de recibir
    // la confirmación satisfactoria del backend.
    clearCart();
  } catch (error) {
    addToast({
      type: 'error',
      title: 'No se pudo registrar la venta',
      message:
        error instanceof Error
          ? error.message
          : 'Ocurrió un error al guardar la venta. Inténtalo nuevamente.',
    });
  } finally {
    setIsSavingSale(false);
  }
};

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* 1. SECCIÓN: CAJA Y VENTAS (POS PRINCIPAL) */}
      {section === 'pos-caja' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lado Izquierdo: Catálogo de productos para mostrador */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white dark:bg-[#16100E] p-5 rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                  Mostrador de Pastelería Orión
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Selecciona los productos listos para la venta al cliente.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full border border-emerald-300 dark:border-emerald-800">
                ● Caja Abierta
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {BAKERY_POS_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => addToCart(item)}
                  className="p-4 rounded-2xl bg-white dark:bg-[#16100E] hover:bg-[#FAF5ED] dark:hover:bg-[#201511] border border-[#EADBCE] dark:border-[#35251F] hover:border-[#8C1F25] dark:hover:border-[#8C1F25] transition-all text-left shadow-xs flex flex-col justify-between group cursor-pointer"
                >
                  <div>
                    <span className="text-3xl select-none block mb-2">{item.icon}</span>
                    <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 leading-snug group-hover:text-[#8C1F25] dark:group-hover:text-[#E8A598]">
                      {item.name}
                    </h4>
                    <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-semibold">
                      {item.category}
                    </span>
                  </div>
                  <div className="mt-3 pt-2 border-t border-stone-100 dark:border-[#281C17] flex items-center justify-between">
                    <span className="text-sm font-extrabold text-[#8C1F25] dark:text-[#E25C64] font-sans">
                      ${item.price.toLocaleString('es-CL')}
                    </span>
                    <span className="w-6 h-6 rounded-lg bg-stone-100 dark:bg-[#281C17] group-hover:bg-[#8C1F25] group-hover:text-white flex items-center justify-center text-xs text-stone-600 transition-colors">
                      +
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Lado Derecho: Carrito de Compra y Cobro */}
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
                    onClick={clearCart}
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
                      key={item.id}
                      className="p-2.5 rounded-xl bg-[#FAF5ED] dark:bg-[#1E1512] flex items-center justify-between gap-2 border border-[#EADBCE]/60 dark:border-[#35251F]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-stone-900 dark:text-stone-100 truncate">
                          {item.name}
                        </div>
                        <div className="text-[11px] text-stone-500 font-sans">
                          ${item.price.toLocaleString('es-CL')} c/u
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, -1)}
                          className="w-6 h-6 rounded-md bg-white dark:bg-[#2A1D18] flex items-center justify-center text-xs text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-bold text-xs w-4 text-center">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.id, 1)}
                          className="w-6 h-6 rounded-md bg-white dark:bg-[#2A1D18] flex items-center justify-center text-xs text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer"
                        >
                          +
                        </button>
                      </div>

                      <div className="font-bold text-xs text-stone-900 dark:text-stone-100 w-16 text-right font-sans shrink-0">
                        ${(item.price * item.quantity).toLocaleString('es-CL')}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Totales */}
              <div className="pt-3 border-t border-[#EADBCE] dark:border-[#35251F] space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                <div className="flex justify-between">
                  <span>Subtotal Neto:</span>
                  <span className="font-mono">${(subtotal - iva).toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between">
                  <span>IVA (19%):</span>
                  <span className="font-mono">${iva.toLocaleString('es-CL')}</span>
                </div>
                <div className="flex justify-between text-base font-extrabold text-stone-900 dark:text-white pt-2 border-t border-stone-100 dark:border-[#281C17]">
                  <span>Total a Pagar:</span>
                  <span className="text-[#8C1F25] dark:text-[#E25C64] font-sans">
                    ${total.toLocaleString('es-CL')}
                  </span>
                </div>
              </div>

              {/* Selector de Método de Pago */}
              <div>
                <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
                  Medio de Pago:
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('debito')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'debito'
                        ? 'bg-[#8C1F25] text-white border-[#8C1F25]'
                        : 'bg-white dark:bg-[#1E1512] text-stone-700 dark:text-stone-300 border-[#EADBCE] dark:border-[#35251F]'
                    }`}
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    <span>Débito</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('efectivo')}
                    className={`p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all cursor-pointer ${
                      paymentMethod === 'efectivo'
                        ? 'bg-[#8C1F25] text-white border-[#8C1F25]'
                        : 'bg-white dark:bg-[#1E1512] text-stone-700 dark:text-stone-300 border-[#EADBCE] dark:border-[#35251F]'
                    }`}
                  >
                    <Banknote className="w-3.5 h-3.5" />
                    <span>Efectivo</span>
                  </button>
                </div>
              </div>

              {/* Botón de Cobro */}
              <button
                type="button"
                onClick={handleCompleteSale}
                disabled={isSavingSale || cart.length === 0}
                className="w-full py-3.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.98] text-white text-sm font-bold shadow-btn transition-all duration-150 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {isSavingSale
                    ? 'Registrando venta...'
                    : `Cobrar $${total.toLocaleString('es-CL')}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. SECCIÓN: HISTORIAL DE TICKETS */}
      {section === 'pos-historial' && (
        <div className="bg-white dark:bg-[#16100E] p-6 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <div>
              <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                Historial de Boletas & Tickets de Venta
              </h3>
              <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                Registro de ventas cerradas durante el día en mostrador.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
              <Calendar className="w-4 h-4 text-[#8C1F25]" />
              <span>Hoy: {new Date().toLocaleDateString('es-CL')}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Hora</th>
                  <th className="py-3 px-6">Detalle de Compra</th>
                  <th className="py-3 px-4">Pago</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                {isLoadingTickets ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-stone-500 text-sm"
                    >
                      Cargando ventas registradas...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-8 text-center text-stone-500 text-sm"
                    >
                      No hay ventas registradas en la base de datos.
                    </td>
                  </tr>
                ) : (
                  tickets.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors"
                    >
                      <td className="py-3 px-4 font-bold text-[#8C1F25] dark:text-[#E8A598]">
                        {t.ticketNumber}
                      </td>

                      <td className="py-3 px-4 text-xs text-stone-500 font-mono">
                        {t.time}
                      </td>

                      <td className="py-3 px-6 text-xs text-stone-700 dark:text-stone-300">
                        {t.itemsSummary}
                      </td>

                      <td className="py-3 px-4 text-xs font-semibold text-stone-600 dark:text-stone-400">
                        {t.paymentMethod}
                      </td>

                      <td className="py-3 px-4 font-bold text-right font-sans">
                        ${t.total.toLocaleString('es-CL')}
                      </td>

                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            t.status === 'completada'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                              : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                          }`}
                        >
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SECCIÓN: CIERRE DE TURNO */}
      {section === 'pos-cierre' && (
        <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
          <div className="border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
            <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
              Arqueo y Cierre de Turno de Caja
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
              Resumen de movimientos para cuadratura de caja antes del cambio de cajero.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">Total Ventas Turno</span>
              <span className="text-2xl font-black text-stone-900 dark:text-white font-sans mt-1 block">
                ${tickets.reduce((acc, t) => acc + t.total, 0).toLocaleString('es-CL')}
              </span>
              <span className="text-[11px] text-emerald-600 font-semibold">{tickets.length} transacciones registradas</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">Efectivo en Gaveta</span>
              <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-sans mt-1 block">
                $44.300
              </span>
              <span className="text-[11px] text-stone-400">Incluye fondo inicial de $40.000</span>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
              <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">Tarjetas y POS Electrónico</span>
              <span className="text-2xl font-black text-[#8C1F25] dark:text-[#E8A598] font-sans mt-1 block">
                $22.900
              </span>
              <span className="text-[11px] text-stone-400">Transbank / WebPay conciliado</span>
            </div>
          </div>

          <div className="pt-4 flex justify-end">
            <button
              type="button"
              onClick={() =>
                addToast({
                  type: 'success',
                  title: '¡Turno Cerrado!',
                  message: 'Comprobante de arqueo generado y enviado a contabilidad.',
                })
              }
              className="px-6 py-3 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs sm:text-sm font-bold shadow-btn transition-all cursor-pointer"
            >
              Imprimir Arqueo y Cerrar Turno
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
