import { useEffect, useState, useMemo, useRef } from 'react';
import { createIdempotencyKey } from '../../lib/api';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';
import { packagingService } from '../../services/packagingService';
import { posSaleService } from '../../services/posSaleService';
import { posShiftService } from '../../services/posShiftService';
import { formatMoney, getChileTodayIso } from '../../utils/formatters';
import type {
  ToastMessage,
  CatalogProduct,
  Packaging,
  PosActiveShiftOverview,
  PosShiftRecord,
  PosPaymentMethod,
} from '../../types';
import {
  buildCartKey,
  mapSaleToTicket,
  printShiftReceipt,
  resolveSecondaryPackagingPrice,
  type CartItem,
  type SaleTicket,
} from './posPrint';
import { PosCatalogPanel } from './PosCatalogPanel';
import { PosCartPanel } from './PosCartPanel';
import { PosSalesHistoryTab } from './PosSalesHistoryTab';
import { PosShiftCloseTab } from './PosShiftCloseTab';
import { PosCloseShiftModal } from './PosCloseShiftModal';

interface PosViewProps {
  section: 'pos-caja' | 'pos-historial' | 'pos-cierre';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
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

export const PosView: React.FC<PosViewProps> = ({ section, addToast }) => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  // Productos del catálogo comercial y empaques rápidos
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [secondaryPackaging, setSecondaryPackaging] = useState<Packaging[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState(false);

  // Carrito de mostrador
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>('debito');

  // Historial de ventas
  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);

  // Indicadores reales de turno de caja y cierre con reinicio
  const [shiftOverview, setShiftOverview] =
    useState<PosActiveShiftOverview>(EMPTY_SHIFT_OVERVIEW);
  const todayKey = shiftOverview.businessDate ?? getChileTodayIso();
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

  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  const isFetchingSalesRef = useRef(false);
  const saleIdempotencyKeyRef = useRef<string | null>(null);
  const closeShiftIdempotencyKeyRef = useRef<string | null>(null);

  useEffect(() => {
    saleIdempotencyKeyRef.current = null;
  }, [cart, paymentMethod]);

  useEffect(() => {
    closeShiftIdempotencyKeyRef.current = null;
  }, [countedCashInput, closeNotes]);

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

  const loadPackaging = async () => {
    try {
      const data = await packagingService.getAll('secundario');
      setSecondaryPackaging(data);
    } catch (err) {
      console.warn('No se pudieron cargar los empaques secundarios del POS.', err);
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

  useEffect(() => {
    if (section !== 'pos-historial' && section !== 'pos-cierre') {
      return;
    }

    if (isFetchingSalesRef.current) {
      return;
    }

    let isMounted = true;
    isFetchingSalesRef.current = true;
    setIsLoadingTickets(true);

    const loadSales = async () => {
      try {
        const sales = await posSaleService.getSales();
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

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => {
      if (p.categoryName) set.add(p.categoryName);
    });
    return Array.from(set).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const query = searchTerm.toLowerCase();
    return products.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(query);
      const matchesCat = categoryFilter === 'all' || p.categoryName === categoryFilter;
      const matchesStock = !onlyInStock || p.stock > 0;
      return matchesSearch && matchesCat && matchesStock;
    });
  }, [products, searchTerm, categoryFilter, onlyInStock]);

  // Totales: los precios del catálogo incluyen IVA (19%)
  const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
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

    const cartKey = buildCartKey(product.id, false);
    setCart((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);
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
          item.cartKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          cartKey,
          id: product.id,
          name: product.name,
          price: product.salePrice,
          quantity: 1,
          stock: product.stock,
          unit: product.unit,
          category: product.categoryName || 'General',
          icon: product.icon || '🧁',
          isPackaging: false,
        },
      ];
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

    const salePrice = resolveSecondaryPackagingPrice(pack.name, pack.salePrice);
    const cartKey = buildCartKey(pack.id, true);

    setCart((prev) => {
      const existing = prev.find((item) => item.cartKey === cartKey);
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
          item.cartKey === cartKey ? { ...item, quantity: item.quantity + 1 } : item,
        );
      }
      return [
        ...prev,
        {
          cartKey,
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

  const updateQuantity = (cartKey: string, delta: number) => {
    setCart((prev) => {
      const target = prev.find((item) => item.cartKey === cartKey);
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
          if (item.cartKey === cartKey) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null);
    });
  };

  const clearCart = () => setCart([]);

  const handleCompleteSale = async () => {
    if (isSavingSale) return;

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
      const idempotencyKey =
        saleIdempotencyKeyRef.current ?? createIdempotencyKey();
      saleIdempotencyKeyRef.current = idempotencyKey;

      const savedSale = await posSaleService.createSale(
        {
          paymentMethod,
          items: cart.map((item) => ({
            productId: item.isPackaging ? undefined : item.id,
            packagingId: item.isPackaging ? item.id : undefined,
            quantity: item.quantity,
          })),
        },
        idempotencyKey,
      );
      saleIdempotencyKeyRef.current = null;

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
          message: `Total cobrado: ${formatMoney(savedSale.total)} mediante ${newTicket.paymentMethod}.`,
        });
      }

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
  const savedOpeningCash = Math.max(0, Number(shiftOverview.openingCash || 0));
  const expectedCashPreview = savedOpeningCash + shiftOverview.cashSalesTotal;
  const hasClosingActivity =
    shiftOverview.hasOpenShift ||
    shiftOverview.transactionsCount > 0 ||
    savedOpeningCash > 0;
  const parsedCountedCash = Math.max(0, Number(countedCashInput) || 0);
  const modalCashDiff = parsedCountedCash - expectedCashPreview;
  const isOpeningCashDirty = parsedOpeningCash !== savedOpeningCash;

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
        message: `Fondo en gaveta registrado en ${formatMoney(updated.openingCash)}.`,
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
    closeShiftIdempotencyKeyRef.current = null;
    setCountedCashInput(String(expectedCashPreview));
    setCloseNotes('');
    setPrintOnClose(true);
    setIsCloseModalOpen(true);
  };

  const handlePrintShift = (target: PosShiftRecord) => {
    const ok = printShiftReceipt(target);
    if (!ok) {
      addToast({
        type: 'warning',
        title: 'Ventana bloqueada',
        message: 'Permite las ventanas emergentes del navegador para imprimir.',
      });
    }
  };

  const handleConfirmCloseShift = async () => {
    if (isClosingShift) return;
    setIsClosingShift(true);
    try {
      const idempotencyKey =
        closeShiftIdempotencyKeyRef.current ?? createIdempotencyKey();
      closeShiftIdempotencyKeyRef.current = idempotencyKey;

      const closedShift = await posShiftService.closeShift(
        {
          countedCash: parsedCountedCash,
          notes: closeNotes.trim() || undefined,
        },
        idempotencyKey,
      );
      closeShiftIdempotencyKeyRef.current = null;

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
              ? `Sobrante de +${formatMoney(diff)}${
                  closedShift.closingEntryNumber
                    ? ` (Asiento #${closedShift.closingEntryNumber})`
                    : ''
                }.`
              : `Faltante de ${formatMoney(-Math.abs(diff))}${
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
      {section === 'pos-caja' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <PosCatalogPanel
            products={products}
            filteredProducts={filteredProducts}
            secondaryPackaging={secondaryPackaging}
            availableCategories={availableCategories}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            categoryFilter={categoryFilter}
            onCategoryFilterChange={setCategoryFilter}
            onlyInStock={onlyInStock}
            onToggleOnlyInStock={() => setOnlyInStock((prev) => !prev)}
            isLoadingProducts={isLoadingProducts}
            onRefresh={() => void Promise.all([loadProducts(), loadPackaging()])}
            onResetFilters={() => {
              setSearchTerm('');
              setCategoryFilter('all');
              setOnlyInStock(false);
            }}
            cart={cart}
            onAddProduct={addToCart}
            onAddPackaging={addPackagingToCart}
          />

          <PosCartPanel
            cart={cart}
            subtotal={subtotal}
            iva={iva}
            total={total}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            isSavingSale={isSavingSale}
            onUpdateQuantity={updateQuantity}
            onClearCart={clearCart}
            onCompleteSale={() => void handleCompleteSale()}
          />
        </div>
      )}

      {section === 'pos-historial' && (
        <PosSalesHistoryTab
          tickets={tickets}
          isLoading={isLoadingTickets}
          isAdmin={isAdmin}
        />
      )}

      {section === 'pos-cierre' && (
        <PosShiftCloseTab
          shiftOverview={shiftOverview}
          todayKey={todayKey}
          shiftsHistory={shiftsHistory}
          lastReceiptShift={lastReceiptShift}
          isLoadingShift={isLoadingShift}
          openingCashInput={openingCashInput}
          onOpeningCashInputChange={setOpeningCashInput}
          isSavingOpeningCash={isSavingOpeningCash}
          isOpeningCashDirty={isOpeningCashDirty}
          savedOpeningCash={savedOpeningCash}
          expectedCashPreview={expectedCashPreview}
          hasClosingActivity={hasClosingActivity}
          onRefreshShift={() => void loadShiftSummary()}
          onSaveOpeningCash={() => void handleSaveOpeningCash()}
          onOpenCloseModal={openCloseShiftModal}
          onPrintShift={handlePrintShift}
        />
      )}

      <PosCloseShiftModal
        isOpen={isCloseModalOpen}
        isClosing={isClosingShift}
        savedOpeningCash={savedOpeningCash}
        cashSalesTotal={shiftOverview.cashSalesTotal}
        expectedCashPreview={expectedCashPreview}
        electronicSalesTotal={shiftOverview.cardPosTotal + shiftOverview.transferTotal}
        countedCashInput={countedCashInput}
        onCountedCashChange={setCountedCashInput}
        modalCashDiff={modalCashDiff}
        closeNotes={closeNotes}
        onCloseNotesChange={setCloseNotes}
        printOnClose={printOnClose}
        onPrintOnCloseChange={setPrintOnClose}
        onClose={() => setIsCloseModalOpen(false)}
        onConfirm={() => void handleConfirmCloseShift()}
      />
    </div>
  );
};
