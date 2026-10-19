import { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ClipboardList,
} from 'lucide-react';
import type { Ingredient, ToastMessage } from '../../../types';
import { ingredientService } from '../../../services/ingredientService';
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
  const [selectedIngredientForPurchase, setSelectedIngredientForPurchase] = useState<Ingredient | null>(null);
  const [copiedRecently, setCopiedRecently] = useState(false);

  // Filtrar únicamente los ingredientes que necesitan reposición: stock <= minStock
  const allNeededItems = useMemo(() => {
    return ingredients.filter((p) => p.stock <= p.minStock);
  }, [ingredients]);

  // Contadores clave
  const totalCount = allNeededItems.length;
  const outOfStockCount = allNeededItems.filter((p) => p.stock <= 0).length;
  const lowStockCount = allNeededItems.filter((p) => p.stock > 0).length;

  // Lista según el filtro de urgencia (Todos, Agotados, Bajo Stock)
  const filteredItems = useMemo(() => {
    if (urgencyFilter === 'out') {
      return allNeededItems.filter((p) => p.stock <= 0);
    }
    if (urgencyFilter === 'low') {
      return allNeededItems.filter((p) => p.stock > 0);
    }
    return allNeededItems;
  }, [allNeededItems, urgencyFilter]);

  // Confirmar y registrar compra
  const handleConfirmPurchase = async (ingredient: Ingredient, quantityBought: number) => {
    try {
      await ingredientService.registerPurchase(ingredient.id, quantityBought);
      await onRefresh();

      const newStock = ingredient.stock + quantityBought;
      const unit = ingredient.unit || 'un';

      if (newStock > ingredient.minStock) {
        addToast({
          type: 'success',
          title: '✓ Compra registrada',
          message: `Se sumaron ${quantityBought} ${unit} de "${ingredient.name}". ¡Stock ahora suficiente (${newStock} ${unit})! Sale de la lista.`,
        });
      } else {
        const stillMissing = Math.max(0, ingredient.minStock - newStock);
        addToast({
          type: 'info',
          title: '✓ Compra parcial anotada',
          message: `Se sumaron ${quantityBought} ${unit} de "${ingredient.name}". Nuevo stock: ${newStock} ${unit} (faltan ${stillMissing} ${unit} para el mínimo).`,
        });
      }
    } catch {
      addToast({
        type: 'error',
        title: 'Error al registrar compra',
        message: 'No se pudo actualizar el stock en la despensa.',
      });
    }
  };

  // Copiar lista formateada para WhatsApp
  const handleCopyShoppingList = () => {
    if (allNeededItems.length === 0) {
      addToast({
        type: 'info',
        title: 'Lista vacía',
        message: 'No hay insumos pendientes de compra en este momento.',
      });
      return;
    }

    const today = new Date().toLocaleDateString('es-CL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    const outItems = allNeededItems.filter((p) => p.stock <= 0);
    const lowItems = allNeededItems.filter((p) => p.stock > 0);

    let text = `🛒 *LISTA DE COMPRAS - PASTELERÍA ORIÓN*\n`;
    text += `📅 Fecha: ${today}\n`;
    text += `📦 Total de insumos a comprar: *${allNeededItems.length}*\n\n`;

    if (outItems.length > 0) {
      text += `🚨 *AGOTADOS (URGENTES):*\n`;
      outItems.forEach((item) => {
        const deficit = Math.max(0, item.minStock - item.stock);
        text += `• ${item.name}: Comprar *${deficit} ${item.unit}*\n`;
        if (item.description) text += `   _Nota: ${item.description}_\n`;
      });
      text += `\n`;
    }

    if (lowItems.length > 0) {
      text += `⚠️ *STOCK BAJO (REPONER):*\n`;
      lowItems.forEach((item) => {
        const deficit = Math.max(0, item.minStock - item.stock);
        text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (quedan ${item.stock} ${item.unit})\n`;
      });
      text += `\n`;
    }

    text += `🍰 _Pastelería Orión ERP_`;

    navigator.clipboard.writeText(text).then(() => {
      setCopiedRecently(true);
      setTimeout(() => setCopiedRecently(false), 3000);
      addToast({
        type: 'success',
        title: '¡Lista copiada!',
        message: 'Lista con formato lista para pegar en WhatsApp o enviar a comprar.',
      });
    }).catch(() => {
      addToast({
        type: 'error',
        title: 'No se pudo copiar',
        message: 'Copia los datos manualmente.',
      });
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 animate-fade-in">
      
      {/* 1. Contenedor Estilo "Hoja de Libreta / Lista de Compras" */}
      <div className="bg-white dark:bg-[#16100E] rounded-[28px] border-2 border-[#EADBCE] dark:border-[#35251F] shadow-sm overflow-hidden">
        
        {/* Cabecera distintiva de Lista de Compras (diferente a la Despensa) */}
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
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#E8A598]">
                  {totalCount} {totalCount === 1 ? 'insumo' : 'insumos'}
                </span>
              </div>
              <p className="text-xs text-stone-600 dark:text-stone-400 mt-0.5">
                Toca cualquier ingrediente para ver su descripción y anotar lo comprado.
              </p>
            </div>
          </div>

          {/* Botón destacado: Copiar para WhatsApp */}
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

        {/* 2. Barra de Filtro Simple (Solo por urgencia, tal como pidió el usuario) */}
        <div className="px-5 sm:px-6 py-3 bg-[#FAF5ED]/50 dark:bg-[#1A120F] border-b border-[#EADBCE]/80 dark:border-[#35251F] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-stone-500 dark:text-stone-400 font-semibold mr-1">Filtrar por:</span>
            
            {/* Todos */}
            <button
              type="button"
              onClick={() => setUrgencyFilter('all')}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                urgencyFilter === 'all'
                  ? 'bg-[#8C1F25] text-white shadow-xs'
                  : 'bg-white dark:bg-[#251A15] border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100'
              }`}
            >
              Todos los faltantes ({totalCount})
            </button>

            {/* Solo Agotados */}
            <button
              type="button"
              onClick={() => setUrgencyFilter('out')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                urgencyFilter === 'out'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 hover:bg-rose-100'
              }`}
            >
              <XCircle className="w-3.5 h-3.5" />
              <span>Agotados / Urgentes ({outOfStockCount})</span>
            </button>

            {/* Solo Stock Bajo */}
            <button
              type="button"
              onClick={() => setUrgencyFilter('low')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
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

        {/* 3. Filas Literales de Lista de Compras (Formato Checklist Real) */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-3xl mx-auto mb-3 border border-emerald-200 dark:border-emerald-800">
              ✓
            </div>
            <h3 className="font-serif font-bold text-lg text-stone-900 dark:text-stone-100">
              {allNeededItems.length === 0
                ? '¡No hay compras pendientes!'
                : 'No hay insumos con este filtro'}
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-sm mx-auto">
              {allNeededItems.length === 0
                ? 'Todos los ingredientes de la pastelería cuentan con existencias suficientes.'
                : 'Selecciona "Todos los faltantes" para revisar el listado completo.'}
            </p>
            {allNeededItems.length > 0 && (
              <button
                type="button"
                onClick={() => setUrgencyFilter('all')}
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
                  key={item.id}
                  onClick={() => setSelectedIngredientForPurchase(item)}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 transition-colors cursor-pointer group select-none ${
                    isOutOfStock
                      ? 'hover:bg-rose-50/50 dark:hover:bg-rose-950/20'
                      : 'hover:bg-amber-50/50 dark:hover:bg-amber-950/20'
                  }`}
                >
                  {/* Lado izquierdo: Checkbox táctil + Nombre e Indicador de Estado */}
                  <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                    
                    {/* Botón circular tipo checklist */}
                    <div
                      className={`w-9 h-9 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                        isOutOfStock
                          ? 'border-rose-300 dark:border-rose-800 text-rose-500 group-hover:bg-rose-100 dark:group-hover:bg-rose-950/60'
                          : 'border-amber-300 dark:border-amber-800 text-amber-600 group-hover:bg-amber-100 dark:group-hover:bg-amber-950/60'
                      }`}
                      title="Haz clic para marcar como comprado"
                    >
                      <CheckCircle2 className="w-5 h-5 opacity-70 group-hover:opacity-100" />
                    </div>

                    {/* Emoji y datos del ingrediente */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Estado: AGOTADO o QUEDA POCO (Clarísimo a primer golpe de vista) */}
                        {isOutOfStock ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-200 border border-rose-300 dark:border-rose-800">
                            🚨 AGOTADO (0 {unit})
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/80 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800">
                            ⚠️ QUEDA POCO ({item.stock} de {item.minStock} {unit})
                          </span>
                        )}

                        <span className="text-[11px] text-stone-400 font-medium">
                          &bull; {item.category}
                        </span>
                      </div>

                      {/* Nombre del Ingrediente */}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xl select-none shrink-0">{item.icon || '🌾'}</span>
                        <h3 className="font-bold text-base sm:text-lg text-stone-900 dark:text-[#FBF4EB] group-hover:text-[#8C1F25] dark:group-hover:text-[#E8A598] transition-colors leading-tight">
                          {item.name}
                        </h3>
                      </div>

                      {/* Pequeña descripción si existe */}
                      {item.description && (
                        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 italic line-clamp-1">
                          "{item.description}"
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lado derecho: Cuánto se debe comprar + Botón "Comprado" */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100 dark:border-stone-800">
                    
                    {/* Caja destacada: Cuánto se debe comprar */}
                    <div className={`px-4 py-2 rounded-xl border text-center ${
                      isOutOfStock
                        ? 'bg-rose-100/70 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
                        : 'bg-amber-100/70 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
                    }`}>
                      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">
                        Faltan por comprar
                      </span>
                      <span className="text-lg sm:text-xl font-black font-sans block">
                        {deficit} <span className="text-xs font-bold uppercase">{unit}</span>
                      </span>
                    </div>

                    {/* Botón de acción interactivo */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedIngredientForPurchase(item);
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

        {/* Pie de lista con resumen limpio */}
        {allNeededItems.length > 0 && (
          <div className="p-4 bg-[#FAF5ED]/70 dark:bg-[#1E1512] border-t border-[#EADBCE] dark:border-[#35251F] text-xs text-stone-600 dark:text-stone-400 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>
              💡 Puedes ingresar cualquier cantidad que hayas comprado (incluso menos del mínimo). El sistema la sumará sin errores.
            </span>
            <span className="font-bold text-stone-800 dark:text-stone-200 shrink-0">
              Total: {totalCount} insumos por reponer
            </span>
          </div>
        )}
      </div>

      {/* 4. Modal de Compra Interactiva y Actualización Automática */}
      <PurchaseItemModal
        isOpen={Boolean(selectedIngredientForPurchase)}
        ingredient={selectedIngredientForPurchase}
        onClose={() => setSelectedIngredientForPurchase(null)}
        onConfirmPurchase={handleConfirmPurchase}
      />
    </div>
  );
};
