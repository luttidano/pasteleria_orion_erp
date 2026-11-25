import { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { createIdempotencyKey } from '../../lib/api';
import { authService } from '../../services/authService';
import { productService } from '../../services/productService';
import { packagingService } from '../../services/packagingService';
import { posSaleService } from '../../services/posSaleService';
import { formatMoney } from '../../utils/formatters';
import type {
  ToastMessage,
  CatalogProduct,
  Packaging,
} from '../../types';
import { mapSaleToTicket, type SaleTicket } from './posPrint';
import { usePosCart } from './hooks/usePosCart';
import { usePosTotals } from './hooks/usePosTotals';
import { usePosShift } from './hooks/usePosShift';
import { PosCatalogPanel } from './PosCatalogPanel';
import { PosCartPanel } from './PosCartPanel';
import { PosSalesHistoryTab } from './PosSalesHistoryTab';
import { PosShiftCloseTab } from './PosShiftCloseTab';
import { PosCloseShiftModal } from './PosCloseShiftModal';

interface PosViewProps {
  section: 'pos-caja' | 'pos-historial' | 'pos-cierre';
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  isOnline?: boolean;
}

export const PosView: React.FC<PosViewProps> = ({
  section,
  addToast,
  isOnline = true,
}) => {
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.role === 'admin';

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [secondaryPackaging, setSecondaryPackaging] = useState<Packaging[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [onlyInStock, setOnlyInStock] = useState(false);

  const [tickets, setTickets] = useState<SaleTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [isSavingSale, setIsSavingSale] = useState(false);

  const addToastRef = useRef(addToast);
  useEffect(() => {
    addToastRef.current = addToast;
  }, [addToast]);

  const isFetchingSalesRef = useRef(false);
  const saleIdempotencyKeyRef = useRef<string | null>(null);

  const {
    cart,
    paymentMethod,
    setPaymentMethod,
    addToCart,
    addPackagingToCart,
    updateQuantity,
    clearCart,
  } = usePosCart({ addToast });

  const { subtotal, iva, total } = usePosTotals(cart);

  const {
    shiftOverview,
    todayKey,
    shiftsHistory,
    isLoadingShift,
    openingCashInput,
    setOpeningCashInput,
    isSavingOpeningCash,
    isCloseModalOpen,
    setIsCloseModalOpen,
    countedCashInput,
    setCountedCashInput,
    closeNotes,
    setCloseNotes,
    printOnClose,
    setPrintOnClose,
    isClosingShift,
    lastReceiptShift,
    savedOpeningCash,
    expectedCashPreview,
    hasClosingActivity,
    modalCashDiff,
    isOpeningCashDirty,
    loadShiftSummary,
    handleSaveOpeningCash,
    openCloseShiftModal,
    handlePrintShift,
    handleConfirmCloseShift,
  } = usePosShift({ isAdmin, isOnline, addToastRef });

  useEffect(() => {
    saleIdempotencyKeyRef.current = null;
  }, [cart, paymentMethod]);

  const loadProducts = useCallback(async () => {
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
  }, []);

  const loadPackaging = useCallback(async () => {
    try {
      const data = await packagingService.getAll('secundario');
      setSecondaryPackaging(data);
    } catch (err) {
      console.warn('No se pudieron cargar los empaques secundarios del POS.', err);
    }
  }, []);

  useEffect(() => {
    if (section === 'pos-caja') {
      void loadProducts();
      void loadPackaging();
    } else if (section === 'pos-cierre') {
      void loadShiftSummary();
    }
  }, [section, loadProducts, loadPackaging, loadShiftSummary]);

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

  const handleCompleteSale = async () => {
    if (isSavingSale) return;

    if (!isOnline) {
      addToast({
        type: 'error',
        title: 'Sin conexión con el servidor',
        message: 'Restablece la conexión con el servidor ERP antes de cobrar la venta.',
      });
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
            isOnline={isOnline}
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
          isOnline={isOnline}
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
