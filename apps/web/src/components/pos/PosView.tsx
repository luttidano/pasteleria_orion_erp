import { useEffect, useState, useMemo, useRef } from 'react';
import { apiFetch } from '../../lib/api';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';
import {
  Store,
  CreditCard,
  Banknote,
  CheckCircle2,
  Calendar,
  Search,
  Package,
  RefreshCw,
  X,
  User,
} from 'lucide-react';
import type { ToastMessage, CatalogProduct } from '../../types';

interface PosViewProps {
  section: 'pos-caja' | 'pos-historial' | 'pos-cierre';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
  unit: string;
  category: string;
  icon: string;
}

interface SaleTicket {
  id: string;
  ticketNumber: string;
  time: string;
  cashierName?: string;
  cashierRole?: string;
  itemsSummary: string;
  total: number;
  paymentMethod: string;
  status: 'completada' | 'anulada';
  accountingStatus?: 'posted' | 'pending';
}

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
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
  soldAt: string;
  dataOrigin: 'demo' | 'real';
  cashierName?: string;
  cashierRole?: string;
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
  cashierName: sale.cashierName || 'Caja Mostrador',
  cashierRole: sale.cashierRole,
  itemsSummary: sale.items
    .map((item) => `${item.quantity}x ${item.product_name}`)
    .join(', '),
  total: Number(sale.total),
  paymentMethod: paymentMethodLabel(sale.paymentMethod),
  status: sale.status,
  accountingStatus: sale.accountingStatus,
});

export const PosView: React.FC<PosViewProps> = ({ section, addToast }) => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // Productos del catálogo comercial
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Carrito de mostrador
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<
    'efectivo' | 'debito' | 'credito' | 'transferencia'
  >('debito');

  // Historial de ventas
  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);

  // 1. Ref estable para addToast (evita re-ejecuciones por re-renders del padre)
  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  // 2. Candado para evitar peticiones duplicadas en paralelo (StrictMode / doble render)
  const isFetchingSalesRef = useRef(false);

  // Cargar catálogo de productos para el mostrador
  const loadProducts = async () => {
    setIsLoadingProducts(true);
    try {
      const data = await productService.getAll();
      setProducts(data);
    } catch (err: unknown) {
      addToastRef.current({
        type: 'error',
        title: 'Error al cargar catálogo',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudieron consultar los productos del catálogo.',
      });
    } finally {
      setIsLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (section === 'pos-caja') {
      void loadProducts();
    }
  }, [section]);

  // Cargar historial de ventas cuando se accede a esa sección
  useEffect(() => {
    if (section !== 'pos-historial' && section !== 'pos-cierre') {
      return;
    }

    // Si ya hay una consulta en vuelo, bloqueamos la segunda simultánea
    if (isFetchingSalesRef.current) {
      return;
    }

    let isMounted = true;
    isFetchingSalesRef.current = true;
    setIsLoadingTickets(true);

    const loadSales = async () => {
      try {
        const sales = await apiFetch<SaleApiResponse[]>('/pos/sales');

        if (isMounted) {
          setTickets(sales.map(mapSaleToTicket));
        }
      } catch (error) {
        if (isMounted) {
          addToastRef.current({
            type: 'error',
            title: 'Error al cargar las ventas',
            message:
              error instanceof Error
                ? error.message
                : 'No se pudo consultar el historial de ventas.',
          });
        }
      } finally {
        isFetchingSalesRef.current = false;
        if (isMounted) {
          setIsLoadingTickets(false);
        }
      }
    };

    void loadSales();

    return () => {
      isMounted = false;
      isFetchingSalesRef.current = false;
    };
  }, [section]);

  // Lista de categorías únicas derivadas de los productos existentes
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [products]);

  // Filtro en tiempo real por búsqueda, categoría y disponibilidad
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCat = categoryFilter === 'all' || p.categoryName === categoryFilter;
      const matchesStock = !onlyInStock || p.stock > 0;
      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchTerm, categoryFilter, onlyInStock]);

  // Totales: los precios del catálogo incluyen IVA (19%)
  const subtotal = cart.reduce(
    (acc, item) => acc + item.price * item.quantity,
    0,
  );

  const iva = Math.round((subtotal * 19) / 119);
  const total = subtotal;

  const addToCart = (product: CatalogProduct) => {
    if (product.stock <= 0) {
      addToast({
        type: 'warning',
        title: 'Producto agotado',
        message: `"${product.name}" no cuenta con unidades disponibles en este momento.`,
      });
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          addToast({
            type: 'warning',
            title: 'Límite de stock alcanzado',
            message: `Solo hay ${product.stock} ${product.unit} disponibles en inventario de "${product.name}".`,
          });
          return prev;
        }
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          id: product.id,
          name: product.name,
          price: product.salePrice,
          quantity: 1,
          stock: product.stock,
          unit: product.unit,
          category: product.categoryName || 'General',
          icon: product.icon || '🧁',
        },
      ];
    });
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart((prev) => {
      const target = prev.find((item) => item.id === id);
      if (!target) return prev;

      if (delta > 0 && target.quantity >= target.stock) {
        addToast({
          type: 'warning',
          title: 'Stock máximo alcanzado',
          message: `Solo hay ${target.stock} ${target.unit} disponibles de "${target.name}".`,
        });
        return prev;
      }

      return prev
        .map((item) => {
          if (item.id === id) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
    });
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
            productId: item.id,
            productName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
          })),
        }),
      });

      const newTicket = mapSaleToTicket(savedSale);

      setTickets((previousTickets) => [
        newTicket,
        ...previousTickets.filter((ticket) => ticket.id !== newTicket.id),
      ]);

      if (isAdmin && savedSale.accountingWarning) {
        addToast({
          type: 'warning',
          title: `¡Venta registrada ${newTicket.ticketNumber}!`,
          message: savedSale.accountingWarning,
        });
      } else {
        addToast({
          type: 'success',
          title: `¡Venta registrada ${newTicket.ticketNumber}!`,
          message: `Total cobrado: $${savedSale.total.toLocaleString('es-CL')} mediante ${newTicket.paymentMethod}.`,
        });
      }

      // Vaciar carrito y recargar productos para actualizar el stock visible
      clearCart();
      await loadProducts();
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
            {/* Header del mostrador */}
            <div className="bg-white dark:bg-[#16100E] p-4 sm:p-5 rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                  Mostrador de Pastelería Orión
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Selecciona los productos listos para la venta al cliente.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadProducts}
                  disabled={isLoadingProducts}
                  className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201612] text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
                  title="Refrescar catálogo"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingProducts ? 'animate-spin text-[#8C1F25]' : ''}`} />
                </button>
                <span className="px-3 py-1 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold text-xs rounded-full border border-emerald-300 dark:border-emerald-800">
                  ● Caja Abierta
                </span>
              </div>
            </div>

            {/* Barra de Filtros y Búsqueda */}
            <div className="bg-white dark:bg-[#16100E] p-3 sm:p-4 rounded-[20px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row gap-2.5">
                {/* Input Búsqueda */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Buscar producto por nombre..."
                    className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filtro Sólo con Stock */}
                <button
                  type="button"
                  onClick={() => setOnlyInStock(!onlyInStock)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    onlyInStock
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                      : 'bg-stone-50 dark:bg-[#201612] text-stone-600 dark:text-stone-400 border-stone-200 dark:border-[#35251F] hover:bg-stone-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Solo con stock</span>
                </button>
              </div>

              {/* Categorías (Pills) */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setCategoryFilter('all')}
                  className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    categoryFilter === 'all'
                      ? 'bg-[#8C1F25] text-white shadow-xs'
                      : 'bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                  }`}
                >
                  Todas ({products.length})
                </button>
                {availableCategories.map((cat) => {
                  const count = products.filter((p) => p.categoryName === cat).length;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-[#8C1F25] text-white shadow-xs'
                          : 'bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800'
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Grilla de Productos */}
            {isLoadingProducts ? (
              <div className="py-16 text-center text-stone-400 space-y-2">
                <RefreshCw className="w-8 h-8 mx-auto animate-spin text-[#8C1F25]" />
                <p className="text-xs">Cargando productos del catálogo...</p>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-14 text-center bg-white dark:bg-[#16100E] rounded-3xl border border-[#EADBCE] dark:border-[#35251F] p-6 space-y-2">
                <Package className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-600" />
                <h4 className="text-sm font-bold text-stone-700 dark:text-stone-300">
                  No se encontraron productos
                </h4>
                <p className="text-xs text-stone-500 max-w-sm mx-auto">
                  {searchTerm || categoryFilter !== 'all' || onlyInStock
                    ? 'Intenta ajustar los filtros de búsqueda o categoría.'
                    : 'Aún no hay productos registrados en el catálogo. Ve a Inventario > Productos para crearlos.'}
                </p>
                {(searchTerm || categoryFilter !== 'all' || onlyInStock) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCategoryFilter('all');
                      setOnlyInStock(false);
                    }}
                    className="text-xs text-[#8C1F25] font-bold hover:underline cursor-pointer pt-1"
                  >
                    Restablecer filtros
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {filteredProducts.map((item) => {
                  const isOutOfStock = item.stock <= 0;
                  const isLowStock = !isOutOfStock && item.stock <= item.minStock;
                  const inCartItem = cart.find((c) => c.id === item.id);
                  const isMaxInCart = inCartItem ? inCartItem.quantity >= item.stock : false;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addToCart(item)}
                      disabled={isOutOfStock || isMaxInCart}
                      className={`p-4 rounded-2xl border text-left shadow-xs flex flex-col justify-between group transition-all cursor-pointer relative overflow-hidden ${
                        isOutOfStock
                          ? 'bg-stone-50 dark:bg-[#18110E] border-stone-200 dark:border-stone-800 opacity-60 cursor-not-allowed'
                          : 'bg-white dark:bg-[#16100E] hover:bg-[#FAF5ED] dark:hover:bg-[#201511] border-[#EADBCE] dark:border-[#35251F] hover:border-[#8C1F25] dark:hover:border-[#8C1F25]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-3xl select-none">{item.icon || '🧁'}</span>
                          {/* Badge de stock */}
                          {isOutOfStock ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300">
                              Agotado
                            </span>
                          ) : isLowStock ? (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200">
                              {item.stock} {item.unit}
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300">
                              {item.stock} {item.unit}
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-xs sm:text-sm text-stone-900 dark:text-stone-100 leading-snug group-hover:text-[#8C1F25] dark:group-hover:text-[#E8A598] line-clamp-2">
                          {item.name}
                        </h4>
                        <span className="text-[10px] text-stone-400 dark:text-stone-500 uppercase font-semibold block mt-0.5">
                          {item.categoryName || 'General'}
                        </span>
                      </div>

                      <div className="mt-3 pt-2 border-t border-stone-100 dark:border-[#281C17] flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[#8C1F25] dark:text-[#E25C64] font-sans">
                          ${item.salePrice.toLocaleString('es-CL')}
                        </span>
                        <span
                          className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs transition-colors ${
                            isOutOfStock || isMaxInCart
                              ? 'bg-stone-200 dark:bg-stone-800 text-stone-400'
                              : 'bg-stone-100 dark:bg-[#281C17] group-hover:bg-[#8C1F25] group-hover:text-white text-stone-600'
                          }`}
                        >
                          {inCartItem ? inCartItem.quantity : '+'}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
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
                          ${item.price.toLocaleString('es-CL')} c/u • Máx: {item.stock} {item.unit}
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
                          disabled={item.quantity >= item.stock}
                          className="w-6 h-6 rounded-md bg-white dark:bg-[#2A1D18] flex items-center justify-center text-xs text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-700 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                  <th className="py-3 px-4">Atendido por</th>
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
                      colSpan={7}
                      className="py-8 text-center text-stone-500 text-sm"
                    >
                      Cargando ventas registradas...
                    </td>
                  </tr>
                ) : tickets.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
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

                      <td className="py-3 px-4 text-xs text-stone-700 dark:text-stone-300">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
                          <span className="font-semibold">{t.cashierName || 'Caja Mostrador'}</span>
                        </div>
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
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              t.status === 'completada'
                                ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300'
                                : 'bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300'
                            }`}
                          >
                            {t.status.toUpperCase()}
                          </span>
                          {isAdmin && t.accountingStatus === 'pending' && (
                            <span
                              title="Asiento contable pendiente de sincronización"
                              className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                            >
                              ⏳ CONTAB. PENDIENTE
                            </span>
                          )}
                        </div>
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
