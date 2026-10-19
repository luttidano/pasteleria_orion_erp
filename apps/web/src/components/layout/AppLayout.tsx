import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Menu,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react';
import type { User, Ingredient, ToastMessage } from '../../types';
import { Sidebar } from './Sidebar';
import type { AdminSection } from './Sidebar';
import { IngredientsView } from '../inventory/ingredients/IngredientsView';

import { ProductsView } from '../inventory/products/ProductsView';
import { RecipesView } from '../inventory/recipes/RecipesView';
import { ShoppingListView } from '../inventory/shopping/ShoppingListView';
import { SuppliersView } from '../inventory/suppliers/SuppliersView';
import { PosView } from '../pos/PosView';
import { AccountingView } from '../accounting/AccountingView';
import { useTheme } from '../../context/ThemeContext';

interface AdminLayoutProps {
  user: User;
  ingredients: Ingredient[];
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
  isLoading?: boolean;
  isOnline?: boolean;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  user,
  ingredients,
  onLogout,
  onRefresh,
  addToast,
  isLoading = false,
  isOnline = true,
}) => {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();

  // Matriz de permisos de navegación por rol
  const allowedSectionsByRole: Record<string, AdminSection[]> = {
    admin: [
      'despensa',
      'recetas',
      'productos',
      'compras',
      'proveedores',
      'pos-caja',
      'pos-historial',
      'pos-cierre',
      'contabilidad-diario',
      'contabilidad-balances',
      'contabilidad-reportes',
      'ajustes',
    ],
    baker: ['despensa', 'recetas', 'productos'],
    cashier: ['pos-caja', 'pos-historial', 'pos-cierre'],
  };

  const allowedSections = allowedSectionsByRole[user.role] || ['despensa'];

  const defaultSectionForRole: Record<string, AdminSection> = {
    admin: 'despensa',
    baker: 'despensa',
    cashier: 'pos-caja',
  };

  // Sincronizar sección activa con la URL (/admin/:section) asegurando permisos
  const activeSection: AdminSection =
    section && allowedSections.includes(section as AdminSection)
      ? (section as AdminSection)
      : defaultSectionForRole[user.role] || 'despensa';

  // Si el usuario intentó acceder por URL a una sección restringida para su rol, redirigir
  useEffect(() => {
    if (section && !allowedSections.includes(section as AdminSection)) {
      navigate(`/admin/${defaultSectionForRole[user.role] || 'despensa'}`, { replace: true });
    }
  }, [section, user.role, allowedSections, navigate]);

  const handleSelectSection = (newSection: AdminSection) => {
    navigate(`/admin/${newSection}`);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Contadores para insignias de la barra lateral
  const { restockCount, outOfStockCount } = useMemo(() => {
    const low = ingredients.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const out = ingredients.filter((p) => p.stock <= 0).length;
    return { restockCount: low, outOfStockCount: out };
  }, [ingredients]);

  const getHeaderTitle = (sec: AdminSection): string => {
    switch (sec) {
      case 'despensa':
        return 'Despensa de Insumos';
      case 'recetas':
        return 'Recetario & Fichas Técnicas'; 
      case 'productos':
        return 'Catálogo de Productos Comerciales'         
      case 'compras':
        return 'Lista de Compras de Materias Primas';
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
      case 'contabilidad-balances':
        return 'Costos y Balances de Producción';
      case 'contabilidad-reportes':
        return 'Informes y Reportes Financieros';
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
              {/* Indicador de conexión Online / Offline */}
              <div
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-semibold select-none transition-all shadow-2xs ${
                  isOnline
                    ? 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/80 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                    : 'border-amber-300 dark:border-amber-700/60 bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-200'
                }`}
                title={
                  isOnline
                    ? 'En línea: Comunicación activa con el servidor ERP y Supabase'
                    : 'Sin conexión: Mostrando datos locales resilientes'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span className="hidden sm:inline">
                  {isOnline ? 'En línea' : 'Sin conexión'}
                </span>
              </div>

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
              onNavigateToShoppingList={() => handleSelectSection('compras')}
              isLoading={isLoading}
            />
          )}

          {activeSection === 'recetas' && (
            <RecipesView
            user={user}
            ingredients={ingredients}
            addToast={addToast}
            />
          )}

          {activeSection === 'productos' && (
            <ProductsView user={user} addToast={addToast} />
          )}

          {activeSection === 'compras' && (
            <ShoppingListView
              ingredients={ingredients}
              onRefresh={onRefresh}
              addToast={addToast}
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
            activeSection === 'contabilidad-reportes') && (
            <AccountingView section={activeSection} addToast={addToast} />
          )}

          {/* CONFIGURACIÓN DEL SISTEMA */}
          {activeSection === 'ajustes' && (
            <div className="bg-white dark:bg-[#16100E] rounded-[26px] p-6 sm:p-8 border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col items-center text-center border-b border-stone-100 dark:border-[#2C1D18] pb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif text-center">
                  Configuración General del ERP
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 text-center">
                  Ajustes de módulos, alertas y preferencias de Pastelería Orión.
                </p>
              </div>

              <div className="space-y-4 max-w-xl mx-auto">
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Sincronización Modular</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    Los módulos de Inventario, Punto de Venta y Contabilidad operan desacoplados a través de la API NestJS y PostgreSQL.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Control de Acceso por Roles (RBAC)</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    • <strong>Administrador:</strong> Acceso total a los 3 módulos y ajustes.<br />
                    • <strong>Pastelero (Baker):</strong> Acceso restringido al Inventario (existencias y consumo).<br />
                    • <strong>Cajero (Cashier):</strong> Acceso restringido al Punto de Venta.
                  </p>
                </div>
              </div>
            </div>
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
