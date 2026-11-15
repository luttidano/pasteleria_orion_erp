import { useState, useMemo, useEffect, useCallback } from 'react';
import type {
  Ingredient,
  CatalogProduct,
  Packaging,
  GeneralSupply,
  ToastMessage,
  ShoppingItem,
  ShoppingItemKind,
} from '../../../../types';
import { ingredientService } from '../../../../services/ingredientService';
import { productService } from '../../../../services/productService';
import { packagingService } from '../../../../services/packagingService';
import { generalSupplyService } from '../../../../services/generalSupplyService';
import { STORE_TIMEZONE } from '../../../../utils/formatters';
import type { ConfirmPurchaseDetails } from '../PurchaseItemModal';
import { formatShoppingListForWhatsApp } from '../utils/shoppingWhatsApp';
import type { ShoppingCounts } from '../components/ShoppingListFiltersBar';

interface UseShoppingListParams {
  ingredients: Ingredient[];
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export function useShoppingList({
  ingredients,
  onRefresh,
  addToast,
}: UseShoppingListParams) {
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'out' | 'low'>('all');
  const [kindFilter, setKindFilter] = useState<'all' | ShoppingItemKind>('all');
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<ShoppingItem | null>(null);
  const [copiedRecently, setCopiedRecently] = useState(false);

  // Estados locales para productos de reventa, empaques e insumos generales
  const [resaleProducts, setResaleProducts] = useState<CatalogProduct[]>([]);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [generalSupplies, setGeneralSupplies] = useState<GeneralSupply[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);

  // Cargar productos de reventa, empaques e insumos generales desde el backend
  const loadExtras = useCallback(async () => {
    setIsLoadingExtras(true);
    try {
      const [prodsRes, packsRes, suppliesRes] = await Promise.allSettled([
        productService.getAll('resale'),
        packagingService.getAll(),
        generalSupplyService.getAll(),
      ]);

      let failedCount = 0;

      if (prodsRes.status === 'fulfilled') {
        setResaleProducts(prodsRes.value);
      } else {
        failedCount++;
        console.error('[ShoppingList] Error cargando productos de reventa:', prodsRes.reason);
      }

      if (packsRes.status === 'fulfilled') {
        setPackagings(packsRes.value);
      } else {
        failedCount++;
        console.error('[ShoppingList] Error cargando empaques:', packsRes.reason);
      }

      if (suppliesRes.status === 'fulfilled') {
        setGeneralSupplies(suppliesRes.value);
      } else {
        failedCount++;
        console.error('[ShoppingList] Error cargando insumos generales:', suppliesRes.reason);
      }

      if (failedCount > 0) {
        addToast({
          type: 'warning',
          title: 'Carga parcial de reposición',
          message: 'Algunas categorías de reabastecimiento no pudieron sincronizarse.',
        });
      }
    } finally {
      setIsLoadingExtras(false);
    }
  }, [addToast]);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  // Consolidar todos los ítems adquiribles que necesitan reposición (stock <= minStock)
  const allNeededItems = useMemo<ShoppingItem[]>(() => {
    const list: ShoppingItem[] = [];

    // 1. Materias Primas / Insumos de Despensa
    ingredients.forEach((ing) => {
      if (ing.stock <= ing.minStock) {
        list.push({
          id: ing.id,
          name: ing.name,
          kind: 'ingredient',
          category: ing.category || 'Materia Prima',
          stock: ing.stock,
          minStock: ing.minStock,
          unit: ing.unit || 'kg',
          price: ing.price ?? 0,
          description: ing.description ?? undefined,
          icon: ing.icon || '🌾',
        });
      }
    });

    // 2. Productos de Reventa Comercial (ej: Bebidas)
    resaleProducts.forEach((prod) => {
      if (prod.stock <= prod.minStock) {
        list.push({
          id: prod.id,
          name: prod.name,
          kind: 'resale',
          category: prod.categoryName || 'Bebidas y Reventa',
          stock: prod.stock,
          minStock: prod.minStock,
          unit: prod.unit || 'un',
          price: prod.costPrice ?? 0,
          description: prod.description ?? undefined,
          icon: prod.icon || '🥤',
          supplierName: prod.supplierName ?? undefined,
        });
      }
    });

    // 3. Empaques y Envases (ej: Cajas de torta, bolsas kraft)
    packagings.forEach((pack) => {
      if (pack.stock <= pack.minStock) {
        list.push({
          id: pack.id,
          name: pack.name,
          kind: 'packaging',
          category: pack.category || (pack.packageType === 'primario' ? 'Envase Directo' : 'Empaque Secundario'),
          stock: pack.stock,
          minStock: pack.minStock,
          unit: pack.unit || 'un',
          price: pack.costPrice ?? 0,
          description: pack.description ?? undefined,
          icon: pack.icon || '📦',
          supplierName: pack.supplier?.name,
        });
      }
    });

    // 4. Insumos Generales (guantes, aseo y útiles)
    generalSupplies.forEach((sup) => {
      if (sup.stock <= sup.minStock) {
        list.push({
          id: sup.id,
          name: sup.name,
          kind: 'general_supply',
          category: sup.category || 'Insumo General',
          stock: sup.stock,
          minStock: sup.minStock,
          unit: sup.unit || 'un',
          price: sup.costPrice ?? 0,
          description: sup.description ?? undefined,
          icon: sup.icon || '🧤',
          supplierName: sup.supplier?.name,
        });
      }
    });

    return list;
  }, [ingredients, resaleProducts, packagings, generalSupplies]);

  // Lista según los filtros activos de urgencia y rubro
  const filteredItems = useMemo(() => {
    return allNeededItems.filter((item) => {
      if (urgencyFilter === 'out' && item.stock > 0) return false;
      if (urgencyFilter === 'low' && item.stock <= 0) return false;
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      return true;
    });
  }, [allNeededItems, urgencyFilter, kindFilter]);

  // Contadores clave consolidados
  const counts = useMemo<ShoppingCounts>(() => {
    return {
      totalCount: allNeededItems.length,
      outOfStockCount: allNeededItems.filter((p) => p.stock <= 0).length,
      lowStockCount: allNeededItems.filter((p) => p.stock > 0).length,
      ingredientCount: allNeededItems.filter((p) => p.kind === 'ingredient').length,
      resaleCount: allNeededItems.filter((p) => p.kind === 'resale').length,
      packagingCount: allNeededItems.filter((p) => p.kind === 'packaging').length,
      generalSupplyCount: allNeededItems.filter((p) => p.kind === 'general_supply').length,
      filteredCount: filteredItems.length,
    };
  }, [allNeededItems, filteredItems.length]);

  // Confirmar y registrar compra delegando al servicio correcto con respaldo contable
  const handleConfirmPurchase = async (
    item: ShoppingItem,
    quantityBought: number,
    details: ConfirmPurchaseDetails,
  ) => {
    try {
      let newStock = item.stock + quantityBought;
      let accountingWarning: string | null | undefined;
      const purchasePayload = {
        delta: quantityBought,
        reasonType: 'purchase' as const,
        totalCost: details.totalCost,
        hasInvoice: details.hasInvoice,
        paymentMethod: details.paymentMethod,
        reason: `Compra desde Lista de Compras (${details.hasInvoice ? 'Factura' : 'Boleta/Exento'})`,
      };

      if (item.kind === 'ingredient') {
        const updated = await ingredientService.registerPurchase(item.id, quantityBought, {
          totalCost: details.totalCost,
          hasInvoice: details.hasInvoice,
          paymentMethod: details.paymentMethod,
          reason: purchasePayload.reason,
        });
        newStock = updated.stock;
        accountingWarning = updated.accountingWarning;
        await onRefresh();
      } else if (item.kind === 'resale') {
        const updated = await productService.adjustStock(item.id, purchasePayload);
        newStock = updated.stock;
        accountingWarning = updated.accountingWarning;
        const prods = await productService.getAll('resale');
        setResaleProducts(prods);
        await onRefresh();
      } else if (item.kind === 'packaging') {
        const updated = await packagingService.adjustStock(item.id, purchasePayload);
        newStock = updated.stock;
        accountingWarning = updated.accountingWarning;
        const packs = await packagingService.getAll();
        setPackagings(packs);
        await onRefresh();
      } else if (item.kind === 'general_supply') {
        const updated = await generalSupplyService.adjustStock(item.id, purchasePayload);
        newStock = updated.stock;
        accountingWarning = updated.accountingWarning;
        const supplies = await generalSupplyService.getAll();
        setGeneralSupplies(supplies);
        await onRefresh();
      }

      const unit = item.unit || 'un';

      if (accountingWarning) {
        addToast({
          type: 'warning',
          title: 'Compra anotada con advertencia contable',
          message: accountingWarning,
        });
      } else if (newStock > item.minStock) {
        addToast({
          type: 'success',
          title: '✓ Compra registrada y contabilizada',
          message: `Se sumaron ${quantityBought} ${unit} de "${item.name}". ¡Stock ahora suficiente (${newStock} ${unit})! Sale de la lista.`,
        });
      } else {
        const stillMissing = Math.max(0, item.minStock - newStock);
        addToast({
          type: 'info',
          title: '✓ Compra parcial anotada y contabilizada',
          message: `Se sumaron ${quantityBought} ${unit} de "${item.name}". Nuevo stock: ${newStock} ${unit} (faltan ${stillMissing} ${unit} para el mínimo).`,
        });
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al registrar compra',
        message: err instanceof Error ? err.message : 'No se pudo actualizar el inventario.',
      });
      throw err;
    }
  };

  // Copiar lista formateada para WhatsApp organizada por categorías
  const handleCopyShoppingList = () => {
    if (allNeededItems.length === 0) {
      addToast({
        type: 'info',
        title: 'Lista vacía',
        message: 'No hay insumos ni productos pendientes de compra en este momento.',
      });
      return;
    }

    const text = formatShoppingListForWhatsApp(allNeededItems, STORE_TIMEZONE);

    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedRecently(true);
        setTimeout(() => setCopiedRecently(false), 3000);
        addToast({
          type: 'success',
          title: '¡Lista copiada!',
          message: 'Lista con formato lista para pegar en WhatsApp o enviar a comprar.',
        });
      })
      .catch(() => {
        addToast({
          type: 'error',
          title: 'No se pudo copiar',
          message: 'Copia los datos manualmente.',
        });
      });
  };

  return {
    urgencyFilter,
    setUrgencyFilter,
    kindFilter,
    setKindFilter,
    selectedItemForPurchase,
    setSelectedItemForPurchase,
    copiedRecently,
    isLoadingExtras,
    allNeededItems,
    filteredItems,
    counts,
    handleConfirmPurchase,
    handleCopyShoppingList,
  };
}
