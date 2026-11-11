import { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../lib/api';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';
import { packagingService } from '../../services/packagingService';
import { posShiftService } from '../../services/posShiftService';
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
  ShoppingBag,
  Printer,
  AlertTriangle,
  Clock,
  Lock,
} from 'lucide-react';
import type {
  ToastMessage,
  CatalogProduct,
  Packaging,
  PosActiveShiftOverview,
  PosShiftRecord,
} from '../../types';

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
  isPackaging?: boolean;
}

interface SaleTicket {
  id: string;
  ticketNumber: string;
  date: string;
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

const EMPTY_SHIFT_OVERVIEW: PosActiveShiftOverview = {
  hasOpenShift: false,
  activeShiftId: null,
  shiftNumber: null,
  openedAt: null,
  openedByName: null,
  openingCash: 0,
  totalSales: 0,
  transactionsCount: 0,
  cashSalesTotal: 0,
  cardPosTotal: 0,
  debitTotal: 0,
  creditTotal: 0,
  transferTotal: 0,
  expectedCash: 0,
  lastClosedShift: null,
};

const STORE_TIMEZONE = 'America/Santiago';

const formatChileDate = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  },
): string =>
  new Date(value).toLocaleDateString('es-CL', {
    ...options,
    timeZone: STORE_TIMEZONE,
  });

const formatChileTime = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
  },
): string =>
  new Date(value).toLocaleTimeString('es-CL', {
    ...options,
    timeZone: STORE_TIMEZONE,
  });

const formatChileDateTime = (
  value: Date | string,
  options: Intl.DateTimeFormatOptions = {
    dateStyle: 'short',
    timeStyle: 'short',
  },
): string =>
  new Date(value).toLocaleString('es-CL', {
    ...options,
    timeZone: STORE_TIMEZONE,
  });

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const printShiftReceipt = (shift: PosShiftRecord): boolean => {
  const printWindow = window.open('', '_blank', 'width=440,height=760');
  if (!printWindow) {
    return false;
  }

  const diff = Number(shift.cashDifference ?? 0);
  const diffLabel =
    Math.abs(diff) < 0.01
      ? 'Cuadratura exacta ($0)'
      : diff > 0
      ? `Sobrante (+$${diff.toLocaleString('es-CL')})`
      : `Faltante (-$${Math.abs(diff).toLocaleString('es-CL')})`;

  const openedStr = formatChileDateTime(shift.openedAt);
  const closedStr = shift.closedAt
    ? formatChileDateTime(shift.closedAt)
    : 'En curso';
  const responsibleName = escapeHtml(
    shift.closedBy?.name || shift.openedBy?.name || 'Cajero Mostrador',
  );
  const safeNotes = shift.notes ? escapeHtml(shift.notes) : '';

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Arqueo Turno #${shift.shiftNumber} - Pastelería Orion</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; margin: 0; padding: 20px; color: #1c1917; background: #fff; font-size: 12px; }
    .ticket { max-width: 340px; margin: 0 auto; border: 1px dashed #d6d3d1; padding: 16px; }
    .center { text-align: center; }
    h1 { font-size: 16px; margin: 0 0 4px; letter-spacing: 0.5px; }
    .sub { color: #57534e; font-size: 11px; margin-bottom: 12px; }
    .sep { border-top: 1px dashed #a8a29e; margin: 10px 0; }
    .row { display: flex; justify-content: space-between; margin: 4px 0; gap: 8px; }
    .bold { font-weight: 700; }
    .big { font-size: 14px; font-weight: 800; }
    .muted { color: #57534e; }
    .box { background: #fafaf9; border: 1px solid #e7e5e4; padding: 8px; margin-top: 8px; }
    @media print { body { padding: 0; } .ticket { border: none; } }
  </style>
</head>
<body>
  <div class="ticket">
    <div class="center">
      <h1>PASTELERÍA ORION</h1>
      <div class="sub">Comprobante de Arqueo y Cierre de Caja</div>
    </div>
    <div class="sep"></div>
    <div class="row"><span>Turno N°:</span><span class="bold">#${shift.shiftNumber}</span></div>
    <div class="row"><span>Responsable:</span><span class="bold">${responsibleName}</span></div>
    <div class="row"><span>Apertura:</span><span>${escapeHtml(openedStr)}</span></div>
    <div class="row"><span>Cierre:</span><span>${escapeHtml(closedStr)}</span></div>
    <div class="row"><span>Transacciones:</span><span>${shift.transactionsCount}</span></div>
    <div class="sep"></div>
    <div class="bold">RESUMEN POR MEDIO DE PAGO</div>
    <div class="row"><span>Ventas Efectivo:</span><span>$${shift.cashSalesTotal.toLocaleString('es-CL')}</span></div>
    <div class="row"><span>Tarjeta Débito:</span><span>$${shift.debitTotal.toLocaleString('es-CL')}</span></div>
    <div class="row"><span>Tarjeta Crédito:</span><span>$${shift.creditTotal.toLocaleString('es-CL')}</span></div>
    <div class="row"><span>Transferencias:</span><span>$${shift.transferTotal.toLocaleString('es-CL')}</span></div>
    <div class="row bold"><span>Total Tarjetas POS:</span><span>$${shift.cardPosTotal.toLocaleString('es-CL')}</span></div>
    <div class="row big"><span>TOTAL VENTAS TURNO:</span><span>$${shift.totalSales.toLocaleString('es-CL')}</span></div>
    <div class="sep"></div>
    <div class="bold">CUADRATURA DE GAVETA (EFECTIVO)</div>
    <div class="row"><span>Fondo Inicial:</span><span>$${shift.openingCash.toLocaleString('es-CL')}</span></div>
    <div class="row"><span>(+) Ventas Efectivo:</span><span>$${shift.cashSalesTotal.toLocaleString('es-CL')}</span></div>
    <div class="row bold"><span>(=) Efectivo Esperado:</span><span>$${shift.expectedCash.toLocaleString('es-CL')}</span></div>
    <div class="row bold"><span>Efectivo Contado:</span><span>$${Number(shift.countedCash ?? shift.expectedCash).toLocaleString('es-CL')}</span></div>
    <div class="row big"><span>Diferencia:</span><span>${escapeHtml(diffLabel)}</span></div>
    ${
      shift.closingEntryNumber
        ? `<div class="box"><div class="bold">Contabilidad:</div><div>Asiento de ajuste #${shift.closingEntryNumber} contabilizado automáticamente.</div></div>`
        : shift.accountingStatus === 'pending'
        ? `<div class="box"><div class="bold">Contabilidad:</div><div>Ajuste pendiente de contabilización (período bloqueado).</div></div>`
        : `<div class="box"><div class="bold">Contabilidad:</div><div>Caja cuadrada sin asiento de diferencia requerido.</div></div>`
    }
    ${safeNotes ? `<div class="box"><div class="bold">Observaciones:</div><div>${safeNotes}</div></div>` : ''}
    <div class="sep"></div>
    <div class="center muted" style="margin-top: 24px;">______________________________<br/>Firma Cajero / Administrador</div>
  </div>
  <script>
    window.addEventListener('load', () => { window.print(); });
  </script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  return true;
};

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
  date: formatChileDate(sale.soldAt),
  time: formatChileTime(sale.soldAt),
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

  // Indicadores reales de turno de caja y cierre con reinicio
  const [shiftOverview, setShiftOverview] =
    useState<PosActiveShiftOverview>(EMPTY_SHIFT_OVERVIEW);
  const todayKey =
    shiftOverview.businessDate ??
    new Date().toLocaleDateString('en-CA', { timeZone: STORE_TIMEZONE });
  const [shiftsHistory, setShiftsHistory] = useState<PosShiftRecord[]>([]);
  const [isLoadingShift, setIsLoadingShift] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState('0');
  const [isSavingOpeningCash, setIsSavingOpeningCash] = useState(false);

  // Modal de Arqueo y Cierre
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [countedCashInput, setCountedCashInput] = useState('0');
  const [closeNotes, setCloseNotes] = useState('');
  const [printOnClose, setPrintOnClose] = useState(true);
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [lastReceiptShift, setLastReceiptShift] = useState<PosShiftRecord | null>(null);

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

  // Empaques secundarios para acceso rápido (Ley de Bolsas / Cajas)
  const [secondaryPackaging, setSecondaryPackaging] = useState<Packaging[]>([]);

  const loadPackaging = async () => {
    try {
      const data = await packagingService.getAll('secundario');
      setSecondaryPackaging(data);
    } catch {
      // Ignorar fallo no bloqueante
    }
  };

  const loadShiftSummary = async (silent = false) => {
    if (!silent) {
      setIsLoadingShift(true);
    }
    try {
      const [overview, history] = await Promise.all([
        posShiftService.getActiveOverview(),
        posShiftService.getShifts(),
      ]);
      setShiftOverview(overview);
      setOpeningCashInput(String(overview.openingCash));
      setShiftsHistory(history);
    } catch (err: unknown) {
      if (!silent) {
        addToastRef.current({
          type: 'error',
          title: 'Error al consultar turno de caja',
          message:
            err instanceof Error
              ? err.message
              : 'No se pudo obtener el estado actual de la caja.',
        });
      }
    } finally {
      if (!silent) {
        setIsLoadingShift(false);
      }
    }
  };

  useEffect(() => {
    if (section === 'pos-caja') {
      void loadProducts();
      void loadPackaging();
    } else if (section === 'pos-cierre') {
      void loadShiftSummary();
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

  const addPackagingToCart = (pack: Packaging) => {
    if (pack.stock <= 0) {
      addToast({
        type: 'warning',
        title: 'Empaque agotado',
        message: `No quedan unidades disponibles de "${pack.name}".`,
      });
      return;
    }

    // Precio por Ley de Bolsas o costo configurado (ej: $100 si es bolsa, o $0 si es caja incluida)
    const salePrice = pack.name.toLowerCase().includes('bolsa') ? 100 : 0;

    setCart((prev) => {
      const existing = prev.find((item) => item.id === pack.id && item.isPackaging);
      if (existing) {
        if (existing.quantity >= pack.stock) {
          addToast({
            type: 'warning',
            title: 'Límite de empaques alcanzado',
            message: `Solo hay ${pack.stock} ${pack.unit} disponibles en inventario de "${pack.name}".`,
          });
          return prev;
        }
        return prev.map((item) =>
          item.id === pack.id && item.isPackaging
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [
        ...prev,
        {
          id: pack.id,
          name: pack.name,
          price: salePrice,
          quantity: 1,
          stock: pack.stock,
          unit: pack.unit,
          category: 'Empaque / Servicio',
          icon: pack.icon || '🛍️',
          isPackaging: true,
        },
      ];
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
            productId: item.isPackaging ? undefined : item.id,
            packagingId: item.isPackaging ? item.id : undefined,
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

      // Vaciar carrito y recargar catálogo, empaques y resumen de caja
      clearCart();
      await Promise.all([loadProducts(), loadPackaging(), loadShiftSummary(true)]);
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

  const parsedOpeningCash = Math.max(0, Number(openingCashInput) || 0);
  const expectedCashPreview = parsedOpeningCash + shiftOverview.cashSalesTotal;
  const hasClosingActivity =
    shiftOverview.hasOpenShift ||
    shiftOverview.transactionsCount > 0 ||
    parsedOpeningCash > 0;
  const parsedCountedCash = Math.max(0, Number(countedCashInput) || 0);
  const modalCashDiff = parsedCountedCash - expectedCashPreview;
  const isOpeningCashDirty =
    parsedOpeningCash !== Number(shiftOverview.openingCash || 0);

  const handleSaveOpeningCash = async () => {
    if (isSavingOpeningCash) return;
    setIsSavingOpeningCash(true);
    try {
      const updated = await posShiftService.updateOpeningCash({
        openingCash: parsedOpeningCash,
      });
      setShiftOverview(updated);
      setOpeningCashInput(String(updated.openingCash));
      addToast({
        type: 'success',
        title: 'Fondo inicial guardado',
        message: `Fondo en gaveta registrado en $${updated.openingCash.toLocaleString('es-CL')}.`,
      });
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo guardar el fondo inicial',
        message:
          error instanceof Error
            ? error.message
            : 'Inténtalo nuevamente en unos segundos.',
      });
    } finally {
      setIsSavingOpeningCash(false);
    }
  };

  const openCloseShiftModal = () => {
    setCountedCashInput(String(expectedCashPreview));
    setCloseNotes('');
    setPrintOnClose(true);
    setIsCloseModalOpen(true);
  };

  const handleConfirmCloseShift = async () => {
    if (isClosingShift) return;
    setIsClosingShift(true);
    try {
      const closedShift = await posShiftService.closeShift({
        countedCash: parsedCountedCash,
        openingCash: parsedOpeningCash,
        notes: closeNotes.trim() || undefined,
      });

      setIsCloseModalOpen(false);
      setLastReceiptShift(closedShift);
      await loadShiftSummary();

      let printed = true;
      if (printOnClose) {
        printed = printShiftReceipt(closedShift);
      }

      if (isAdmin && closedShift.accountingWarning) {
        addToast({
          type: 'warning',
          title: `Turno #${closedShift.shiftNumber} cerrado (caja reiniciada)`,
          message: closedShift.accountingWarning,
        });
      } else if (printOnClose && !printed) {
        addToast({
          type: 'info',
          title: `¡Turno #${closedShift.shiftNumber} cerrado y caja en $0!`,
          message:
            'El navegador bloqueó la ventana de impresión. Usa "Reimprimir Comprobante" en el historial de arqueos.',
        });
      } else {
        const diff = Number(closedShift.cashDifference ?? 0);
        const diffDesc =
          Math.abs(diff) < 0.01
            ? 'Cuadratura exacta ($0).'
            : diff > 0
            ? `Sobrante de +$${diff.toLocaleString('es-CL')}${
                closedShift.closingEntryNumber
                  ? ` (Asiento #${closedShift.closingEntryNumber})`
                  : ''
              }.`
            : `Faltante de -$${Math.abs(diff).toLocaleString('es-CL')}${
                closedShift.closingEntryNumber
                  ? ` (Asiento #${closedShift.closingEntryNumber})`
                  : ''
              }.`;

        addToast({
          type: 'success',
          title: `¡Turno #${closedShift.shiftNumber} cerrado y caja reiniciada!`,
          message: `${diffDesc} Indicadores de efectivo y POS reiniciados en $0.`,
        });
      }
    } catch (error) {
      addToast({
        type: 'error',
        title: 'No se pudo cerrar el turno',
        message:
          error instanceof Error
            ? error.message
            : 'Ocurrió un error al generar el arqueo de caja.',
      });
    } finally {
      setIsClosingShift(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto">
      {/* 1. SECCIÓN: CAJA Y VENTAS (POS PRINCIPAL) */}
      {section === 'pos-caja' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Lado Izquierdo: Catálogo de productos para mostrador */}
          <div className="lg:col-span-7 space-y-4">
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

                {/* Refrescar catálogo compacto */}
                <button
                  type="button"
                  onClick={() => void Promise.all([loadProducts(), loadPackaging()])}
                  disabled={isLoadingProducts}
                  className="px-2.5 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
                  title="Refrescar catálogo y empaques"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingProducts ? 'animate-spin text-[#8C1F25]' : ''}`} />
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

            {/* Barra de Acceso Rápido: Empaques & Ley de Bolsas */}
            {secondaryPackaging.length > 0 && (
              <div className="p-3.5 rounded-2xl bg-[#FAF5ED] dark:bg-[#1C1411] border border-[#EADBCE] dark:border-[#35251F] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#8C1F25]" />
                    Empaques Rápidos (Ley de Bolsas / Cajas)
                  </span>
                  <span className="text-[11px] text-stone-400">Clic para agregar al ticket</span>
                </div>

                <div className="flex items-center gap-2 overflow-x-auto pb-1">
                  {secondaryPackaging.map((pack) => {
                    const isOutOfStock = pack.stock <= 0;
                    const inCartItem = cart.find((c) => c.id === pack.id && c.isPackaging);
                    const packPrice = pack.name.toLowerCase().includes('bolsa') ? 100 : 0;

                    return (
                      <button
                        key={pack.id}
                        type="button"
                        onClick={() => addPackagingToCart(pack)}
                        disabled={isOutOfStock}
                        className={`px-3 py-2 rounded-xl border text-left flex items-center gap-2.5 transition-all shrink-0 cursor-pointer ${
                          isOutOfStock
                            ? 'bg-stone-100 dark:bg-[#18110E] border-stone-200 dark:border-stone-800 opacity-50 cursor-not-allowed'
                            : inCartItem
                              ? 'bg-white dark:bg-[#201511] border-[#8C1F25] ring-1 ring-[#8C1F25]'
                              : 'bg-white dark:bg-[#201511] border-stone-200 dark:border-[#35251F] hover:border-[#8C1F25]'
                        }`}
                      >
                        <span className="text-xl select-none">{pack.icon || '🛍️'}</span>
                        <div>
                          <div className="font-bold text-xs text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                            <span>{pack.name}</span>
                            {isOutOfStock ? (
                              <span className="text-[9px] font-bold text-rose-600 bg-rose-50 dark:bg-rose-950 px-1 py-0.2 rounded">
                                Agotado
                              </span>
                            ) : (
                              <span className="text-[10px] text-stone-400 font-mono">
                                ({pack.stock} {pack.unit})
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono font-bold text-[#8C1F25] dark:text-[#E8A598]">
                            {packPrice > 0 ? `+${packPrice.toLocaleString('es-CL')}` : 'Cortesía ($0)'}
                          </div>
                        </div>
                        {inCartItem && (
                          <span className="ml-1 w-5 h-5 rounded-full bg-[#8C1F25] text-white text-[10px] font-bold flex items-center justify-center">
                            {inCartItem.quantity}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

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
                Últimas 20 ventas registradas en mostrador.
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-stone-500 font-mono">
              <Calendar className="w-4 h-4 text-[#8C1F25]" />
              <span>Hoy: {formatChileDate(new Date())}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-xs font-bold uppercase text-stone-700 dark:text-stone-300">
                  <th className="py-3 px-4">Ticket</th>
                  <th className="py-3 px-4">Fecha / Hora</th>
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

                      <td className="py-3 px-4 text-xs text-stone-500 font-mono whitespace-nowrap">
                        {t.date} • {t.time}
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
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#EADBCE] dark:border-[#35251F] pb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h3 className="text-xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                    Arqueo y Cierre de Turno de Caja
                  </h3>
                  {shiftOverview.hasOpenShift ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
                      Turno #{shiftOverview.shiftNumber} Abierto
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-stone-100 dark:bg-[#251A16] text-stone-600 dark:text-stone-300 border border-stone-200 dark:border-[#35251F]">
                      {shiftOverview.transactionsCount > 0
                        ? 'Movimientos Previos del Día'
                        : 'Caja Reiniciada ($0)'}
                    </span>
                  )}
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                  {shiftOverview.hasOpenShift && shiftOverview.openedAt
                    ? `Abierto el ${formatChileDateTime(shiftOverview.openedAt)}${
                        shiftOverview.openedByName ? ` por ${shiftOverview.openedByName}` : ''
                      }. Al cerrar el arqueo los indicadores vuelven a $0.`
                    : `Cuadratura del turno actual (${todayKey}). Al confirmar el cierre se emite el comprobante y la caja vuelve a $0.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void loadShiftSummary()}
                disabled={isLoadingShift}
                className="px-3.5 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2C1F1A] text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoadingShift ? 'animate-spin text-[#8C1F25]' : ''}`}
                />
                Actualizar
              </button>
            </div>

            {!shiftOverview.hasOpenShift &&
              shiftOverview.transactionsCount === 0 &&
              shiftOverview.lastClosedShift && (
                <div className="p-4 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-bold text-emerald-900 dark:text-emerald-200">
                        Último arqueo registrado: Turno #{shiftOverview.lastClosedShift.shiftNumber}
                      </p>
                      <p className="text-emerald-700 dark:text-emerald-400 mt-0.5">
                        Cerrado el{' '}
                        {formatChileDateTime(shiftOverview.lastClosedShift.closedAt)}{' '}
                        por {shiftOverview.lastClosedShift.closedByName} • Ventas $
                        {shiftOverview.lastClosedShift.totalSales.toLocaleString('es-CL')} •
                        Contado $
                        {shiftOverview.lastClosedShift.countedCash.toLocaleString('es-CL')}
                      </p>
                    </div>
                  </div>
                  {(lastReceiptShift || shiftsHistory[0]) && (
                    <button
                      type="button"
                      onClick={() => {
                        const target =
                          lastReceiptShift &&
                          lastReceiptShift.id === shiftOverview.lastClosedShift?.id
                            ? lastReceiptShift
                            : shiftsHistory[0];
                        if (target) {
                          const ok = printShiftReceipt(target);
                          if (!ok) {
                            addToast({
                              type: 'warning',
                              title: 'Ventana bloqueada',
                              message: 'Permite las ventanas emergentes del navegador para imprimir.',
                            });
                          }
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#16100E] border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer hover:bg-emerald-100/60"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Reimprimir Último Arqueo
                    </button>
                  )}
                </div>
              )}

            {/* Fondo Inicial Configurable de Gaveta */}
            <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#1C1411] border border-stone-200/80 dark:border-[#35251F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-bold text-stone-700 dark:text-stone-200 block">
                  Fondo Inicial en Gaveta (Sencillo)
                </span>
                <span className="text-[11px] text-stone-500 dark:text-stone-400">
                  Monto base en efectivo asignado al turno actual ({todayKey}). Se reinicia a $0 después de cada cierre.
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-stone-500">$</span>
                <input
                  type="number"
                  min={0}
                  step={500}
                  value={openingCashInput}
                  onChange={(e) => setOpeningCashInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      void handleSaveOpeningCash();
                    }
                  }}
                  className="w-32 text-xs font-mono font-bold px-3 py-2 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-white dark:bg-[#16100E] text-right"
                />
                <button
                  type="button"
                  onClick={() => void handleSaveOpeningCash()}
                  disabled={isSavingOpeningCash || !isOpeningCashDirty}
                  className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-900 dark:bg-[#8C1F25] dark:hover:bg-[#74191E] text-white text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  {isSavingOpeningCash ? 'Guardando...' : 'Guardar Fondo'}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">
                  Total Ventas Turno
                </span>
                <span className="text-2xl font-black text-stone-900 dark:text-white font-sans mt-1 block">
                  {isLoadingShift ? '...' : `$${shiftOverview.totalSales.toLocaleString('es-CL')}`}
                </span>
                <span className="text-[11px] text-emerald-600 font-semibold">
                  {shiftOverview.transactionsCount} transacciones en turno actual
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">
                  Efectivo en Gaveta
                </span>
                <span className="text-2xl font-black text-emerald-700 dark:text-emerald-400 font-sans mt-1 block">
                  {isLoadingShift ? '...' : `$${expectedCashPreview.toLocaleString('es-CL')}`}
                </span>
                <span className="text-[11px] text-stone-400">
                  Fondo (${parsedOpeningCash.toLocaleString('es-CL')}) + Ventas efectivo ($
                  {shiftOverview.cashSalesTotal.toLocaleString('es-CL')})
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F]">
                <span className="text-xs text-stone-500 font-bold uppercase tracking-wider block">
                  Tarjetas y POS Electrónico
                </span>
                <span className="text-2xl font-black text-[#8C1F25] dark:text-[#E8A598] font-sans mt-1 block">
                  {isLoadingShift
                    ? '...'
                    : `$${shiftOverview.cardPosTotal.toLocaleString('es-CL')}`}
                </span>
                <span className="text-[11px] text-stone-400">
                  Débito (${shiftOverview.debitTotal.toLocaleString('es-CL')}) • Crédito ($
                  {shiftOverview.creditTotal.toLocaleString('es-CL')})
                  {shiftOverview.transferTotal > 0
                    ? ` • Transf. ($${shiftOverview.transferTotal.toLocaleString('es-CL')})`
                    : ''}
                </span>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                {hasClosingActivity
                  ? 'El comprobante de arqueo se emite al cerrar el turno y queda guardado en el historial.'
                  : 'Registra una venta o asigna un fondo inicial para poder cerrar el turno.'}
              </span>
              <button
                type="button"
                onClick={openCloseShiftModal}
                disabled={isLoadingShift || !hasClosingActivity}
                className="px-6 py-3 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs sm:text-sm font-bold shadow-btn transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4" />
                <span>Arqueo y Cerrar Turno</span>
              </button>
            </div>
          </div>

          {/* HISTORIAL DE ARQUEOS CERRADOS */}
          <div className="bg-white dark:bg-[#16100E] p-6 sm:p-8 rounded-[26px] border border-[#EADBCE] dark:border-[#35251F] shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
              <div>
                <h4 className="text-base sm:text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                  Historial de Arqueos y Cierres de Caja
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Comprobantes cerrados por turno, diferencia física en gaveta y respaldo contable.
                </p>
              </div>
              <span className="text-xs font-mono text-stone-500">
                {shiftsHistory.length} cierre{shiftsHistory.length === 1 ? '' : 's'}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#FAF5ED] dark:bg-[#201613] border-b border-stone-200 dark:border-[#35251F] text-[11px] font-bold uppercase text-stone-700 dark:text-stone-300">
                    <th className="py-3 px-3">Turno</th>
                    <th className="py-3 px-3">Cierre</th>
                    <th className="py-3 px-3">Responsable</th>
                    <th className="py-3 px-3 text-right">Ventas</th>
                    <th className="py-3 px-3 text-right">Efectivo Esp. / Real</th>
                    <th className="py-3 px-3 text-right">POS / Transf.</th>
                    <th className="py-3 px-3 text-right">Diferencia</th>
                    <th className="py-3 px-3 text-center">Contab.</th>
                    <th className="py-3 px-3 text-center">Comprobante</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-[#281C17]">
                  {isLoadingShift ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-stone-500 text-xs">
                        Cargando historial de arqueos...
                      </td>
                    </tr>
                  ) : shiftsHistory.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-stone-500 text-xs">
                        Aún no hay cierres de turno registrados. Al cerrar este turno aparecerá aquí.
                      </td>
                    </tr>
                  ) : (
                    shiftsHistory.map((s) => {
                      const diff = Number(s.cashDifference ?? 0);
                      const isZeroDiff = Math.abs(diff) < 0.01;
                      const posPlusTransfer = s.cardPosTotal + s.transferTotal;
                      return (
                        <tr
                          key={s.id}
                          className="hover:bg-stone-50 dark:hover:bg-[#201613]/50 transition-colors"
                        >
                          <td className="py-3 px-3 font-bold text-[#8C1F25] dark:text-[#E8A598]">
                            #{s.shiftNumber}
                            <span className="block text-[10px] font-normal text-stone-400">
                              {s.transactionsCount} vta{s.transactionsCount === 1 ? '' : 's'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-xs text-stone-600 dark:text-stone-300 font-mono">
                            {s.closedAt ? formatChileDateTime(s.closedAt) : '-'}
                          </td>
                          <td className="py-3 px-3 text-xs font-medium text-stone-700 dark:text-stone-300">
                            {s.closedBy?.name || s.openedBy?.name || 'Cajero'}
                          </td>
                          <td className="py-3 px-3 text-right font-bold font-sans">
                            ${s.totalSales.toLocaleString('es-CL')}
                          </td>
                          <td className="py-3 px-3 text-right text-xs font-mono">
                            <span className="text-stone-500 block">
                              Esp: ${s.expectedCash.toLocaleString('es-CL')}
                            </span>
                            <span className="font-bold text-stone-900 dark:text-stone-100">
                              Real: ${Number(s.countedCash ?? s.expectedCash).toLocaleString('es-CL')}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-right text-xs font-mono text-stone-700 dark:text-stone-300">
                            ${posPlusTransfer.toLocaleString('es-CL')}
                          </td>
                          <td className="py-3 px-3 text-right text-xs font-bold font-mono">
                            <span
                              className={
                                isZeroDiff
                                  ? 'text-emerald-700 dark:text-emerald-400'
                                  : diff > 0
                                  ? 'text-sky-700 dark:text-sky-400'
                                  : 'text-rose-700 dark:text-rose-400'
                              }
                            >
                              {isZeroDiff
                                ? '$0'
                                : diff > 0
                                ? `+$${diff.toLocaleString('es-CL')}`
                                : `-$${Math.abs(diff).toLocaleString('es-CL')}`}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-center">
                            {s.accountingStatus === 'posted' && s.closingEntryNumber ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                                Asiento #{s.closingEntryNumber}
                              </span>
                            ) : s.accountingStatus === 'pending' ? (
                              <span
                                title={s.accountingWarning || 'Ajuste contable pendiente'}
                                className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300"
                              >
                                Pendiente
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-stone-100 dark:bg-[#251A16] text-stone-500">
                                Cuadrada
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                const ok = printShiftReceipt(s);
                                if (!ok) {
                                  addToast({
                                    type: 'warning',
                                    title: 'Ventana bloqueada',
                                    message:
                                      'Permite las ventanas emergentes del navegador para imprimir.',
                                  });
                                }
                              }}
                              className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-[#35251F] hover:bg-stone-100 dark:hover:bg-[#261A16] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#E8A598]" />
                              <span>Reimprimir</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ARQUEO FÍSICO Y CIERRE DE TURNO */}
      {isCloseModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="w-full max-w-lg my-auto bg-white dark:bg-[#16100E] rounded-[24px] border border-[#EADBCE] dark:border-[#35251F] shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[#EADBCE] dark:border-[#35251F] pb-3">
              <div>
                <h4 className="text-lg font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif">
                  Confirmar Arqueo y Cierre de Turno
                </h4>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                  Cuenta el efectivo físico en la gaveta. Al confirmar, el turno se cerrará y los indicadores volverán a $0.
                </p>
              </div>
              <button
                type="button"
                onClick={() => !isClosingShift && setIsCloseModalOpen(false)}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-[#261A16] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">Fondo Inicial:</span>
                <span className="font-mono font-semibold">
                  ${parsedOpeningCash.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-600 dark:text-stone-400">(+) Ventas en Efectivo:</span>
                <span className="font-mono font-semibold">
                  ${shiftOverview.cashSalesTotal.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="flex justify-between pt-2 border-t border-[#EADBCE] dark:border-[#35251F] text-sm font-bold text-stone-900 dark:text-white">
                <span>(=) Efectivo Esperado en Gaveta:</span>
                <span className="font-mono text-emerald-700 dark:text-emerald-400">
                  ${expectedCashPreview.toLocaleString('es-CL')}
                </span>
              </div>
              <div className="flex justify-between pt-1 text-[11px] text-stone-500">
                <span>Tarjetas POS y Transferencias (referencia):</span>
                <span className="font-mono">
                  ${(shiftOverview.cardPosTotal + shiftOverview.transferTotal).toLocaleString('es-CL')}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-200">
                Efectivo Físico Contado en Gaveta ($)
              </label>
              <input
                type="number"
                min={0}
                step={100}
                value={countedCashInput}
                onChange={(e) => setCountedCashInput(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-base font-mono font-bold text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />

              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  Math.abs(modalCashDiff) < 0.01
                    ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300'
                    : modalCashDiff > 0
                    ? 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900/40 text-sky-800 dark:text-sky-300'
                    : 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300'
                }`}
              >
                {Math.abs(modalCashDiff) < 0.01 ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {Math.abs(modalCashDiff) < 0.01
                      ? 'Cuadratura exacta ($0 de diferencia)'
                      : modalCashDiff > 0
                      ? `Sobrante de caja: +$${modalCashDiff.toLocaleString('es-CL')}`
                      : `Faltante de caja: -$${Math.abs(modalCashDiff).toLocaleString('es-CL')}`}
                  </p>
                  {Math.abs(modalCashDiff) >= 0.01 && (
                    <p className="text-[11px] opacity-90 mt-0.5">
                      Al confirmar, se contabilizará automáticamente el ajuste entre 1101 Caja Efectivo y{' '}
                      {modalCashDiff > 0
                        ? '4102 Sobrantes de Caja.'
                        : '6103 Faltantes y Diferencias de Caja.'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-200">
                Observaciones del cierre (opcional)
              </label>
              <textarea
                rows={2}
                maxLength={500}
                value={closeNotes}
                onChange={(e) => setCloseNotes(e.target.value)}
                placeholder="Ej: Retiro de efectivo a caja fuerte, cambio entregado al turno tarde..."
                className="w-full px-3 py-2 rounded-xl border border-[#EADBCE] dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-xs text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
              />
            </div>

            <label className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={printOnClose}
                onChange={(e) => setPrintOnClose(e.target.checked)}
                className="rounded border-stone-300 text-[#8C1F25] focus:ring-[#8C1F25]"
              />
              <span>Imprimir / descargar comprobante de arqueo automáticamente</span>
            </label>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#EADBCE] dark:border-[#35251F]">
              <button
                type="button"
                onClick={() => setIsCloseModalOpen(false)}
                disabled={isClosingShift}
                className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] text-xs font-bold text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-[#261A16] cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmCloseShift()}
                disabled={isClosingShift}
                className="px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-bold shadow-btn cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {isClosingShift ? 'Cerrando turno...' : 'Confirmar Cierre y Reiniciar Caja'}
                </span>
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};
