import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Menu,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import type { User, Ingredient, ToastMessage, CatalogProduct, Packaging, GeneralSupply } from '../../types';
import { productService } from '../../services/productService';
import { packagingService } from '../../services/packagingService';
import { generalSupplyService } from '../../services/generalSupplyService';
import { Sidebar } from './Sidebar';
import type { AdminSection } from './Sidebar';
import { IngredientsView } from '../inventory/ingredients/IngredientsView';

import { ProductsView } from '../inventory/products/ProductsView';
import { RecipesView } from '../inventory/recipes/RecipesView';
import { ShoppingListView } from '../inventory/shopping/ShoppingListView';
import { SuppliersView } from '../inventory/suppliers/SuppliersView';
import { PackagingView } from '../inventory/packaging/PackagingView';
import { GeneralSuppliesView } from '../inventory/general-supplies/GeneralSuppliesView';
import { PosView } from '../pos/PosView';
import { AccountingView } from '../accounting/AccountingView';
import { useTheme } from '../../context/ThemeContext';
import { SettingsView } from '../settings/SettingsView';
import type { ConnectionStatusSnapshot } from '../../lib/connectionStatus';

interface AdminLayoutProps {
  user: User;
  ingredients: Ingredient[];
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  isLoading?: boolean;
  isOnline?: boolean;
  connectionStatus?: ConnectionStatusSnapshot;
  onCheckConnection?: () => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  user,
  ingredients,
  onLogout,
  onRefresh,
  addToast,
  isLoading = false,
  isOnline = true,
  connectionStatus,
  onCheckConnection,
}) => {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  // Matriz de permisos de navegación por rol
  const allowedSectionsByRole: Record<string, AdminSection[]> = {
    admin: [
      'despensa',
      'recetas',
      'productos',
      'empaques',
      'insumos-generales',
      'compras',
      'proveedores',
      'pos-caja',
      'pos-historial',
      'pos-cierre',
      'contabilidad-diario',
      'contabilidad-mayor',
      'contabilidad-balances',
      'contabilidad-reportes',
      'contabilidad-periodos',
      'ajustes',
    ],
    baker: ['despensa', 'recetas', 'productos', 'empaques', 'insumos-generales'],
    cashier: ['pos-caja', 'pos-historial', 'pos-cierre'],
  };

  const allowedSections = allowedSectionsByRole[user.role] || ['despensa'];

  const defaultSectionForRole: Record<string, AdminSection> = {
    admin: 'despensa',
    baker: 'despensa',
    cashier: 'pos-caja',
  };

  // Sincronizar sección activa con la URL (/:section) asegurando permisos
  const activeSection: AdminSection =
    section && allowedSections.includes(section as AdminSection)
      ? (section as AdminSection)
      : defaultSectionForRole[user.role] || 'despensa';

  // Si el usuario intentó acceder por URL a una sección restringida para su rol, redirigir
  useEffect(() => {
    if (section && !allowedSections.includes(section as AdminSection)) {
      navigate(`/${defaultSectionForRole[user.role] || 'despensa'}`, { replace: true });
    }
  }, [section, user.role, allowedSections, navigate]);

  const handleSelectSection = (newSection: AdminSection) => {
    navigate(`/${newSection}`);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useTheme();

  const [resaleItems, setResaleItems] = useState<CatalogProduct[]>([]);
  const [packagingItems, setPackagingItems] = useState<Packaging[]>([]);
  const [generalSupplyItems, setGeneralSupplyItems] = useState<GeneralSupply[]>([]);

  const refreshRestockInventory = useCallback(async () => {
    const [resale, packs, supplies] = await Promise.all([
      productService.getAll('resale').catch(() => []),
      packagingService.getAll().catch(() => []),
      generalSupplyService.getAll().catch(() => []),
    ]);
    setResaleItems(resale);
    setPackagingItems(packs);
    setGeneralSupplyItems(supplies);
  }, []);

  // Sincronizar catálogo de reventa, empaques e insumos generales para mantener exacto el badge de compras
  useEffect(() => {
    void refreshRestockInventory();
  }, [activeSection, ingredients, refreshRestockInventory]);

  const handleRefreshAll = useCallback(async () => {
    await onRefresh();
    await refreshRestockInventory();
  }, [onRefresh, refreshRestockInventory]);

  // Contadores para insignias de la barra lateral (Insumos + Reventa + Empaques + Insumos Generales)
  const { restockCount, outOfStockCount } = useMemo(() => {
    let low = ingredients.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    let out = ingredients.filter((p) => p.stock <= 0).length;

    for (const p of resaleItems) {
      if (p.stock <= 0) out++;
      else if (p.stock <= p.minStock) low++;
    }

    for (const pack of packagingItems) {
      if (pack.stock <= 0) out++;
      else if (pack.stock <= pack.minStock) low++;
    }

    for (const sup of generalSupplyItems) {
      if (sup.stock <= 0) out++;
      else if (sup.stock <= sup.minStock) low++;
    }

    return { restockCount: low, outOfStockCount: out };
  }, [ingredients, resaleItems, packagingItems, generalSupplyItems]);

  const getHeaderTitle = (sec: AdminSection): string => {
    switch (sec) {
      case 'despensa':
        return 'Despensa de Insumos';
      case 'recetas':
        return 'Recetario & Fichas Técnicas'; 
      case 'productos':
        return 'Catálogo de Productos Comerciales';
      case 'empaques':
        return 'Empaques & Despacho';
      case 'insumos-generales':
        return 'Insumos Generales & Operativos';
      case 'compras':
        return 'Lista de Compras & Reabastecimiento';
      case 'proveedores':
        return 'Directorio de Proveedores';
      case 'pos-caja':
        return 'Caja & Ventas Mostrador (POS)';
      case 'pos-historial':
        return 'Historial de Tickets & Ventas';
      case 'pos-cierre':
        return 'Arqueo y Cierre de Turno';
      case 'contabilidad-diario':
        return 'Libro Diario & Flujo de Caja';
      case 'contabilidad-mayor':
        return 'Libro Mayor & Movimientos por Cuenta';
      case 'contabilidad-balances':
        return 'Costos y Balances de Producción';
      case 'contabilidad-reportes':
        return 'Informes y Reportes Financieros';
      case 'contabilidad-periodos':
        return 'Cierre de Períodos & Ejercicio Anual';
      case 'ajustes':
        return 'Configuración del Sistema ERP';
      default:
        return 'Panel ERP Orión';
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex text-[#2A1B16] dark:text-[#F5ECE5]">
      {/* 1. Barra Lateral Desplegable con los 3 Módulos y Configuración */}
      <Sidebar
        user={user}
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        isOpen={isSidebarOpen}
        onToggleOpen={() => setIsSidebarOpen(!isSidebarOpen)}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        onLogout={onLogout}
        restockCount={restockCount}
        outOfStockCount={outOfStockCount}
      />

      {/* 2. Área de Contenido Principal */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#16100E]/95 backdrop-blur-md border-b border-[#EADBCE] dark:border-[#35251F] shadow-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
            {/* Lado izquierdo: Botón móvil */}
            <div className="flex items-center min-w-[36px]">
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="md:hidden w-10 h-10 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201613] hover:bg-stone-100 dark:hover:bg-[#2C1F1B] flex items-center justify-center text-stone-700 dark:text-stone-200 transition-colors cursor-pointer shadow-xs"
                title="Abrir menú"
              >
                <Menu className="w-5 h-5" />
              </button>
            </div>

            {/* CENTRO: Título del Módulo actual */}
            <div className="flex-1 flex items-center justify-center text-center min-w-0 px-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="font-serif text-base sm:text-xl md:text-2xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] tracking-tight leading-snug">
                  {getHeaderTitle(activeSection)}
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] text-xs font-semibold shrink-0">
                  <Sparkles className="w-3 h-3" />
                  Pastelería Orión
                </span>
              </div>
            </div>

            {/* Lado derecho: Estado de Conexión + Botón Dark Mode */}
            <div className="flex items-center justify-end gap-2.5 min-w-[36px] shrink-0">
              {/* Indicador Real de Estado de Conexión (Red + API + BD) */}
              {(() => {
                const health = connectionStatus?.health ?? (isOnline ? 'online' : 'offline');
                const statusConfig = {
                  online: {
                    label: 'En línea',
                    container:
                      'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300',
                    dot: 'bg-emerald-500 animate-pulse',
                  },
                  degraded: {
                    label: 'Error BD / API',
                    container:
                      'border-rose-300 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300',
                    dot: 'bg-rose-500 animate-ping',
                  },
                  offline: {
                    label: 'Sin conexión',
                    container:
                      'border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200',
                    dot: 'bg-amber-500',
                  },
                  checking: {
                    label: 'Verificando...',
                    container:
                      'border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 text-stone-600 dark:text-stone-300',
                    dot: 'bg-stone-400 animate-pulse',
                  },
                }[health];

                return (
                  <button
                    type="button"
                    onClick={onCheckConnection}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold select-none transition-all shadow-2xs cursor-pointer hover:opacity-85 active:scale-95 ${statusConfig.container}`}
                    title={`${connectionStatus?.detail || statusConfig.label} (Clic para comprobar ahora)`}
                  >
                    <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
                    <span className="hidden sm:inline">{statusConfig.label}</span>
                  </button>
                );
              })()}

              <button
                type="button"
                onClick={toggleDarkMode}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-stone-300 dark:border-[#42312A] bg-stone-100 dark:bg-[#241712] hover:bg-stone-200 dark:hover:bg-[#2F1F19] text-stone-800 dark:text-[#FBF4EB] text-xs font-bold transition-all shadow-xs cursor-pointer active:scale-95"
                title={isDarkMode ? 'Cambiar a Modo Claro' : 'Cambiar a Modo Oscuro'}
              >
                {isDarkMode ? (
                  <>
                    <Sun className="w-4 h-4 text-amber-400" />
                    <span className="hidden sm:inline">Modo Claro</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 text-stone-700" />
                    <span className="hidden sm:inline">Modo Oscuro</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Contenido según el Módulo y Sub-sección activa */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* MÓDULO 1: INVENTARIO */}
          {activeSection === 'despensa' && (
            <IngredientsView
              user={user}
              ingredients={ingredients}
              onRefresh={onRefresh}
              addToast={addToast}
              externalFilter="todos"
              onNavigateToShoppingList={
                user.role === 'admin' ? () => handleSelectSection('compras') : undefined
              }
              isLoading={isLoading}
            />
          )}

          {activeSection === 'recetas' && (
            <RecipesView
              user={user}
              ingredients={ingredients}
              addToast={addToast}
              onRefresh={onRefresh}
            />
          )}

          {activeSection === 'productos' && (
            <ProductsView user={user} addToast={addToast} />
          )}

          {activeSection === 'compras' && (
            <ShoppingListView
              ingredients={ingredients}
              onRefresh={handleRefreshAll}
              addToast={addToast}
            />
          )}

          {activeSection === 'empaques' && (
            <PackagingView addToast={addToast} />
          )}

          {activeSection === 'insumos-generales' && (
            <GeneralSuppliesView
              user={user}
              addToast={addToast}
              onInventoryChange={() => void refreshRestockInventory()}
            />
          )}

          {activeSection === 'proveedores' && (
            <SuppliersView addToast={addToast} />
          )}

          {/* MÓDULO 2: PUNTO DE VENTA (POS) */}
          {(activeSection === 'pos-caja' ||
            activeSection === 'pos-historial' ||
            activeSection === 'pos-cierre') && (
            <PosView section={activeSection} addToast={addToast} />
          )}

          {/* MÓDULO 3: CONTABILIDAD (SOLO ADMIN) */}
          {(activeSection === 'contabilidad-diario' ||
            activeSection === 'contabilidad-balances' ||
            activeSection === 'contabilidad-mayor' ||
            activeSection === 'contabilidad-reportes' ||
            activeSection === 'contabilidad-periodos') && (
            <AccountingView section={activeSection} addToast={addToast} />
          )}

          {/* CONFIGURACIÓN DEL SISTEMA */}
          {activeSection === 'ajustes' && (
            <SettingsView currentUser={user} addToast={addToast}/>
          )}
        </main>

        {/* Footer */}
        <footer className="bg-white dark:bg-[#16100E] border-t border-stone-200/80 dark:border-[#35251F] py-4 text-center text-xs text-stone-500 dark:text-stone-400">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Pastelería Orión &bull; ERP Modular (Inventario &bull; POS &bull; Contabilidad)</span>
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              Alta Repostería Artesanal
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
