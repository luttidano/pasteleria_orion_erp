import React from 'react';
import { Package, RefreshCw, Search, ShoppingBag, X } from 'lucide-react';
import type { CatalogProduct, Packaging } from '../../types';
import { formatAmount, formatMoney } from '../../utils/formatters';
import {
  buildCartKey,
  resolveSecondaryPackagingPrice,
  type CartItem,
} from './posPrint';

interface PosCatalogPanelProps {
  products: CatalogProduct[];
  filteredProducts: CatalogProduct[];
  secondaryPackaging: Packaging[];
  availableCategories: string[];
  searchTerm: string;
  onSearchChange: (value: string) => void;
  categoryFilter: string;
  onCategoryFilterChange: (category: string) => void;
  onlyInStock: boolean;
  onToggleOnlyInStock: () => void;
  isLoadingProducts: boolean;
  onRefresh: () => void;
  onResetFilters: () => void;
  cart: CartItem[];
  onAddProduct: (product: CatalogProduct) => void;
  onAddPackaging: (packaging: Packaging) => void;
}

export const PosCatalogPanel: React.FC<PosCatalogPanelProps> = ({
  products,
  filteredProducts,
  secondaryPackaging,
  availableCategories,
  searchTerm,
  onSearchChange,
  categoryFilter,
  onCategoryFilterChange,
  onlyInStock,
  onToggleOnlyInStock,
  isLoadingProducts,
  onRefresh,
  onResetFilters,
  cart,
  onAddProduct,
  onAddPackaging,
}) => {
  return (
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
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Buscar producto por nombre..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-[#8C1F25]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filtro Sólo con Stock */}
          <button
            type="button"
            onClick={onToggleOnlyInStock}
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
            onClick={onRefresh}
            disabled={isLoadingProducts}
            className="px-2.5 py-2 rounded-xl border border-stone-200 dark:border-[#35251F] bg-stone-50 dark:bg-[#201612] text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center shrink-0"
            title="Refrescar catálogo y empaques"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoadingProducts ? 'animate-spin text-[#8C1F25]' : ''}`}
            />
          </button>
        </div>

        {/* Categorías (Pills) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
          <button
            type="button"
            onClick={() => onCategoryFilterChange('all')}
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
                onClick={() => onCategoryFilterChange(cat)}
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
              const packCartKey = buildCartKey(pack.id, true);
              const inCartItem = cart.find((c) => c.cartKey === packCartKey);
              const packPrice = resolveSecondaryPackagingPrice(pack.name, pack.salePrice);

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => onAddPackaging(pack)}
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
                      {packPrice > 0 ? `+$${formatAmount(packPrice)}` : 'Cortesía ($0)'}
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
              onClick={onResetFilters}
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
            const productCartKey = buildCartKey(item.id, false);
            const inCartItem = cart.find((c) => c.cartKey === productCartKey);
            const isMaxInCart = inCartItem ? inCartItem.quantity >= item.stock : false;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onAddProduct(item)}
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
                    {formatMoney(item.salePrice)}
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
  );
};

