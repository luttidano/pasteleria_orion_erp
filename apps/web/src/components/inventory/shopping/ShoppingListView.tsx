import { useState, useMemo, useEffect } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import type {
  Ingredient,
  CatalogProduct,
  Packaging,
  ToastMessage,
  ShoppingItem,
  ShoppingItemKind,
} from '../../../types';
import { ingredientService } from '../../../services/ingredientService';
import { productService } from '../../../services/productService';
import { packagingService } from '../../../services/packagingService';
import { PurchaseItemModal } from './PurchaseItemModal';

interface ShoppingListViewProps {
  ingredients: Ingredient[];
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const ShoppingListView: React.FC<ShoppingListViewProps> = ({
  ingredients,
  onRefresh,
  addToast,
}) => {
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'out' | 'low'>('all');
  const [kindFilter, setKindFilter] = useState<'all' | ShoppingItemKind>('all');
  const [selectedItemForPurchase, setSelectedItemForPurchase] = useState<ShoppingItem | null>(null);
  const [copiedRecently, setCopiedRecently] = useState(false);

  // Estados locales para productos de reventa y empaques
  const [resaleProducts, setResaleProducts] = useState<CatalogProduct[]>([]);
  const [packagings, setPackagings] = useState<Packaging[]>([]);
  const [isLoadingExtras, setIsLoadingExtras] = useState(false);

  // Cargar productos de reventa y empaques desde el backend
  const loadExtras = async () => {
    setIsLoadingExtras(true);
    try {
      const [prods, packs] = await Promise.all([
        productService.getAll('resale').catch(() => []),
        packagingService.getAll().catch(() => []),
      ]);
      setResaleProducts(prods);
      setPackagings(packs);
    } catch (err) {
      console.error('[ShoppingList] Error cargando catálogo de reventa y empaques:', err);
    } finally {
      setIsLoadingExtras(false);
    }
  };

  useEffect(() => {
    loadExtras();
  }, []);

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
          description: ing.description,
          icon: ing.icon || '🌾',
        });
      }
    });

    // 2. Productos de Reventa Comercial (ej: Coca-Cola Express)
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
          description: prod.description,
          icon: prod.icon || '🥤',
          supplierName: prod.supplierName,
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
          description: pack.description,
          icon: pack.icon || '📦',
          supplierName: pack.supplier?.name,
        });
      }
    });

    return list;
  }, [ingredients, resaleProducts, packagings]);

  // Contadores clave
  const totalCount = allNeededItems.length;
  const outOfStockCount = allNeededItems.filter((p) => p.stock <= 0).length;
  const lowStockCount = allNeededItems.filter((p) => p.stock > 0).length;

  const ingredientCount = allNeededItems.filter((p) => p.kind === 'ingredient').length;
  const resaleCount = allNeededItems.filter((p) => p.kind === 'resale').length;
  const packagingCount = allNeededItems.filter((p) => p.kind === 'packaging').length;

  // Lista según los filtros activos de urgencia y rubro
  const filteredItems = useMemo(() => {
    return allNeededItems.filter((item) => {
      if (urgencyFilter === 'out' && item.stock > 0) return false;
      if (urgencyFilter === 'low' && item.stock <= 0) return false;
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      return true;
    });
  }, [allNeededItems, urgencyFilter, kindFilter]);

  // Confirmar y registrar compra delegando al servicio correcto
  const handleConfirmPurchase = async (item: ShoppingItem, quantityBought: number) => {
    try {
      if (item.kind === 'ingredient') {
        await ingredientService.registerPurchase(item.id, quantityBought);
        await onRefresh();
      } else if (item.kind === 'resale') {
        await productService.adjustStock(item.id, quantityBought, item.stock);
        const prods = await productService.getAll('resale');
        setResaleProducts(prods);
      } else if (item.kind === 'packaging') {
        await packagingService.adjustStock(item.id, quantityBought);
        const packs = await packagingService.getAll();
        setPackagings(packs);
      }

      const newStock = item.stock + quantityBought;
      const unit = item.unit || 'un';

      if (newStock > item.minStock) {
        addToast({
          type: 'success',
          title: '✓ Compra registrada',
          message: `Se sumaron ${quantityBought} ${unit} de "${item.name}". ¡Stock ahora suficiente (${newStock} ${unit})! Sale de la lista.`,
        });
      } else {
        const stillMissing = Math.max(0, item.minStock - newStock);
        addToast({
          type: 'info',
          title: '✓ Compra parcial anotada',
          message: `Se sumaron ${quantityBought} ${unit} de "${item.name}". Nuevo stock: ${newStock} ${unit} (faltan ${stillMissing} ${unit} para el mínimo).`,
        });
      }
    } catch (err: unknown) {
      addToast({
        type: 'error',
        title: 'Error al registrar compra',
        message: err instanceof Error ? err.message : 'No se pudo actualizar el inventario.',
      });
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

    const today = new Date().toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const ingItems = allNeededItems.filter((p) => p.kind === 'ingredient');
    const resItems = allNeededItems.filter((p) => p.kind === 'resale');
    const packItems = allNeededItems.filter((p) => p.kind === 'packaging');

    let text = `🛒 *LISTA DE COMPRAS - PASTELERÍA ORIÓN*\n`;
    text += `📅 Fecha: ${today}\n`;
    text += `📦 Total de ítems a reponer: *${allNeededItems.length}*\n\n`;

    if (ingItems.length > 0) {
      text += `🌾 *MATERIAS PRIMAS / INSUMOS (${ingItems.length}):*\n`;
      ingItems.forEach((item) => {
        const deficit = Math.max(0, item.minStock - item.stock);
        const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
        text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
      });
      text += `\n`;
    }

    if (resItems.length > 0) {
      text += `🥤 *PRODUCTOS DE REVENTA (${resItems.length}):*\n`;
      resItems.forEach((item) => {
        const deficit = Math.max(0, item.minStock - item.stock);
        const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
        text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
      });
      text += `\n`;
    }

    if (packItems.length > 0) {
      text += `📦 *EMPAQUES Y ENVASES (${packItems.length}):*\n`;
      packItems.forEach((item) => {
        const deficit = Math.max(0, item.minStock - item.stock);
        const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
        text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
      });
      text += `\n`;
    }

    text += `🍰 _Pastelería Orión ERP_`;

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

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      {/* 1. Contenedor Principal de Lista de Compras */}
      <div className="bg-white dark:bg-[#16100E] rounded-[28px] border-2 border-[#EADBCE] dark:border-[#35251F] shadow-sm overflow-hidden">
        {/* Cabecera */}
        <div className="p-5 sm:p-6 bg-[#FAF5ED] dark:bg-[#1E1512] border-b border-[#EADBCE] dark:border-[#35251F] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-[#8C1F25] text-white flex items-center justify-center shadow-xs shrink-0">
              <ClipboardList className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#2A1B16] dark:text-[#FDF5EE]">
                  Lista de Compras
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E8A598] flex items-center gap-1.5">
                  {isLoadingExtras && (
                    <div className="w-3 h-3 border-2 border-[#8C1F25]/30 border-t-[#8C1F25] rounded-full animate-spin" />
                  )}
                  <span>{totalCount} {totalCount === 1 ? 'pendiente' : 'pendientes'}</span>
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Central de compras: Insumos de pastelería, productos de reventa y materiales de empaque.
              </p>
            </div>
          </div>

          {/* Botón: Copiar para WhatsApp */}
          <button
            type="button"
            onClick={handleCopyShoppingList}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-stone-300 dark:border-[#42312A] bg-white dark:bg-[#251A15] hover:bg-stone-50 dark:hover:bg-[#2D1F1A] text-stone-800 dark:text-[#FBF4EB] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
            title="Copiar lista de compras formateada para WhatsApp"
          >
            {copiedRecently ? (
              <>
                <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-emerald-700 dark:text-emerald-400">¡Copiado a WhatsApp!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-[#8C1F25] dark:text-[#D4A373]" />
                <span>Copiar para WhatsApp</span>
              </>
            )}
          </button>
        </div>

        {/* 2. Filtro por Rubro (Pills) */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#FAF5ED]/80 dark:bg-[#1C1411] border-b border-[#EADBCE] dark:border-[#35251F] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-stone-500 dark:text-stone-400 font-semibold mr-1">Rubro:</span>
            <button
              type="button"
              onClick={() => setKindFilter('all')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                kindFilter === 'all'
                  ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xs'
                  : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              Todos ({totalCount})
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('ingredient')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                kindFilter === 'ingredient'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              <span>🌾 Insumos ({ingredientCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('resale')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                kindFilter === 'resale'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-800 dark:text-blue-200 hover:bg-blue-100'
              }`}
            >
              <span>🥤 Reventa ({resaleCount})</span>
            </button>
            <button
              type="button"
              onClick={() => setKindFilter('packaging')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                kindFilter === 'packaging'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 text-purple-800 dark:text-purple-200 hover:bg-purple-100'
              }`}
            >
              <span>📦 Empaques ({packagingCount})</span>
            </button>
          </div>
        </div>

        {/* 3. Filtro por Urgencia (Agotados vs Stock Bajo) */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#FAF5ED]/50 dark:bg-[#1A120F] border-b border-[#EADBCE]/80 dark:border-[#35251F] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-stone-500 dark:text-stone-400 font-semibold mr-1">Urgencia:</span>

            <button
              type="button"
              onClick={() => setUrgencyFilter('all')}
              className={`px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                urgencyFilter === 'all'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              Todos los faltantes ({totalCount})
            </button>

            <button
              type="button"
              onClick={() => setUrgencyFilter('out')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                urgencyFilter === 'out'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Agotados / Urgentes ({outOfStockCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setUrgencyFilter('low')}
              className={`flex items-center gap-1 px-3 py-1 rounded-xl font-bold transition-all cursor-pointer ${
                urgencyFilter === 'low'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200 hover:bg-amber-100'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Queda poco ({lowStockCount})</span>
            </button>
          </div>

          <div className="text-[11px] font-semibold text-stone-500 dark:text-stone-400">
            Mostrando <strong>{filteredItems.length}</strong> de {totalCount} pendientes
          </div>
        </div>

        {/* 4. Lista de Compras */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 border border-emerald-200 dark:border-emerald-800">
              ✓
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
              {allNeededItems.length === 0
                ? '¡No hay compras pendientes!'
                : 'No hay ítems con este filtro'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {allNeededItems.length === 0
                ? 'Todos los insumos, productos de reventa y empaques cuentan con existencias suficientes.'
                : 'Selecciona otro filtro para revisar los pendientes.'}
            </p>
            {allNeededItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setUrgencyFilter('all');
                  setKindFilter('all');
                }}
                className="mt-3 px-3.5 py-1.5 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold hover:bg-stone-200 cursor-pointer"
              >
                Ver todos los faltantes
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-[#EADBCE]/70 dark:divide-[#2C1D18]">
            {filteredItems.map((item) => {
              const isOutOfStock = item.stock <= 0;
              const deficit = Math.max(0, item.minStock - item.stock);
              const unit = item.unit || 'un';

              return (
                <li
                  key={`${item.kind}-${item.id}`}
                  onClick={() => setSelectedItemForPurchase(item)}
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
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300'
                          }`}
                        >
                          {item.kind === 'ingredient'
                            ? '🌾 Insumo'
                            : item.kind === 'resale'
                            ? '🥤 Reventa'
                            : '📦 Empaque'}
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
                        setSelectedItemForPurchase(item);
                      }}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] active:scale-95 text-white text-xs font-bold shadow-xs transition-all cursor-pointer shrink-0"
                    >
                      <span>Anotar Compra</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {/* Pie con resumen */}
        {allNeededItems.length > 0 && (
          <div className="p-4 bg-[#FAF5ED]/70 dark:bg-[#1E1512] border-t border-[#EADBCE] dark:border-[#35251F] text-xs text-stone-600 dark:text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              💡 Al anotar la compra, el inventario se actualizará automáticamente según corresponda (Despensa, Catálogo o Empaques).
            </span>
            <span className="font-bold text-stone-800 dark:text-stone-200 shrink-0">
              Total: {totalCount} ítems por reponer
            </span>
          </div>
        )}
      </div>

      {/* 5. Modal de Registro de Compra */}
      <PurchaseItemModal
        isOpen={Boolean(selectedItemForPurchase)}
        item={selectedItemForPurchase}
        onClose={() => setSelectedItemForPurchase(null)}
        onConfirmPurchase={handleConfirmPurchase}
      />
    </div>
  );
};
