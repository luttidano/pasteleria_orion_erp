import { useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Menu,
  Sparkles,
  Sun,
  Moon
} from 'lucide-react';
import type { User, Product, ToastMessage } from '../../types';
import { Sidebar } from './Sidebar';
import type { AdminSection } from './Sidebar';
import { InventoryView } from './InventoryView';
import { ShoppingListView } from './ShoppingListView';
import { useTheme } from '../../context/ThemeContext';

interface AdminLayoutProps {
  user: User;
  products: Product[];
  onLogout: () => void;
  onRefresh: () => Promise<void>;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  user,
  products,
  onLogout,
  onRefresh,
  addToast,
}) => {
  const navigate = useNavigate();
  const { section } = useParams<{ section?: string }>();
  const allowedSections: AdminSection[] = user.role === 'admin' 
  ? ['despensa', 'compras', 'recetas', 'proveedores', 'ajustes']
  : ['despensa', 'recetas'];

  // Sincronizar sección activa con la URL (/admin/:section)
  const activeSection: AdminSection = (section && allowedSections.includes(section as AdminSection))
    ? (section as AdminSection)
    : 'despensa';

  const handleSelectSection = (newSection: AdminSection) => {
    navigate(`/admin/${newSection}`);
  };

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { isDarkMode, toggleDarkMode } = useTheme();

  // Counters for sidebar badges
  const { restockCount, outOfStockCount } = useMemo(() => {
    const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStock).length;
    const out = products.filter((p) => p.stock <= 0).length;
    return { restockCount: low, outOfStockCount: out };
  }, [products]);

  return (
    <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex text-[#2A1B16] dark:text-[#F5ECE5]">
      {/* 1. Barra Lateral Desplegable / Retráctil */}
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
        {/* Top Header con título y controles ordenados sin superposición */}
        <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#16100E]/95 backdrop-blur-md border-b border-[#EADBCE] dark:border-[#35251F] shadow-xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-20 flex items-center justify-between gap-3">
            {/* Lado izquierdo: Botón móvil o espaciador equilibrado */}
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

            {/* CENTRO: Título del Módulo, amplio y libre de superposiciones */}
            <div className="flex-1 flex items-center justify-center text-center min-w-0 px-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className="font-serif text-base sm:text-xl md:text-2xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] tracking-tight leading-snug">
                  {activeSection === 'despensa' && 'Despensa de Insumos'}
                  {activeSection === 'compras' && 'Lista de Compras de Materias Primas'}
                  {activeSection === 'recetas' && 'Recetario & Fichas Técnicas'}
                  {activeSection === 'proveedores' && 'Directorio de Proveedores'}
                  {activeSection === 'ajustes' && 'Configuración de la Despensa'}
                </span>
                <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] text-xs font-semibold shrink-0">
                  <Sparkles className="w-3 h-3" />
                  Pastelería Orión
                </span>
              </div>
            </div>

            {/* Lado derecho: Botón Dark Mode único */}
            <div className="flex items-center justify-end min-w-[36px] shrink-0">
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


        {/* Contenido según la opción seleccionada en la barra lateral */}
        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* A. Módulo Principal: Despensa de Insumos */}
          {activeSection === 'despensa' && (
            <InventoryView
              user={user}
              products={products}
              onRefresh={onRefresh}
              addToast={addToast}
              externalFilter="todos"
              onNavigateToShoppingList={() => handleSelectSection('compras')}
            />
          )}

          {/* B. Módulo de Lista de Compras Especializado */}
          {activeSection === 'compras' && (
            <ShoppingListView
              products={products}
              onRefresh={onRefresh}
              addToast={addToast}
            />
          )}

          {/* C. Módulo de Recetas & Fichas Técnicas (Vista previa conectada a la despensa) */}
          {activeSection === 'recetas' && (
            <div className="bg-white dark:bg-[#16100E] rounded-[26px] p-6 sm:p-8 border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col items-center text-center border-b border-stone-100 dark:border-[#2C1D18] pb-4">
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60 mb-2">
                  Módulo Próximo
                </span>
                <h3 className="text-xl sm:text-2xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif text-center">
                  Fórmulas y Recetas de Pastelería Orión
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto text-center">
                  Vincula las preparaciones con las materias primas para descontar ingredientes automáticamente.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Receta 1 */}
                <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] flex flex-col justify-between">
                  <div>
                    <span className="text-2xl">🎂</span>
                    <h4 className="font-bold text-[#2A1B16] dark:text-[#FDF5EE] text-base mt-2">Torta Selva Negra</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                      Consume: Harina (350g), Cacao amargo (80g), Huevos (6 un), Crema chantilly (500ml), Chocolate (150g).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#EADBCE] dark:border-[#35251F] flex items-center justify-between text-xs">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Insumos en bodega</span>
                    <span className="text-stone-400 font-mono">Rinde: 20 porciones</span>
                  </div>
                </div>

                {/* Receta 2 */}
                <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] flex flex-col justify-between">
                  <div>
                    <span className="text-2xl">🥐</span>
                    <h4 className="font-bold text-[#2A1B16] dark:text-[#FDF5EE] text-base mt-2">Croissants Franceses</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                      Consume: Harina (1kg), Mantequilla sin sal (500g), Leche entera (250ml), Levadura, Azúcar.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#EADBCE] dark:border-[#35251F] flex items-center justify-between text-xs">
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">⚠️ Mantequilla baja</span>
                    <span className="text-stone-400 font-mono">Rinde: 18 croissants</span>
                  </div>
                </div>

                {/* Receta 3 */}
                <div className="p-4 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#35251F] flex flex-col justify-between">
                  <div>
                    <span className="text-2xl">🍰</span>
                    <h4 className="font-bold text-[#2A1B16] dark:text-[#FDF5EE] text-base mt-2">Cheesecake de Frutos Rojos</h4>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                      Consume: Queso crema, Frutos rojos congelados (400g), Mantequilla (120g), Azúcar (200g).
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#EADBCE] dark:border-[#35251F] flex items-center justify-between text-xs">
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">✓ Insumos en bodega</span>
                    <span className="text-stone-400 font-mono">Rinde: 15 porciones</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => handleSelectSection('despensa')}
                  className="px-5 py-2.5 bg-[#8C1F25] hover:bg-[#74191E] text-white rounded-xl text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Volver a Despensa de Insumos
                </button>
              </div>
            </div>
          )}

          {/* D. Módulo de Proveedores */}
          {activeSection === 'proveedores' && (
            <div className="bg-white dark:bg-[#16100E] rounded-[26px] p-6 sm:p-8 border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col items-center text-center border-b border-stone-100 dark:border-[#2C1D18] pb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif text-center">
                  Proveedores de Materias Primas
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 max-w-md mx-auto text-center">
                  Contactos para reposición directa de harina, lácteos, chocolates y frutos secos.
                </p>
                <button
                  type="button"
                  onClick={() => addToast({ type: 'info', title: 'Pronto disponible', message: 'Podrás registrar nuevos proveedores en el siguiente paso.' })}
                  className="mt-3 px-4 py-2 rounded-xl bg-stone-100 dark:bg-[#251A15] text-stone-700 dark:text-stone-200 text-xs font-semibold hover:bg-stone-200 dark:hover:bg-[#2F211B] cursor-pointer"
                >
                  + Nuevo Proveedor
                </button>
              </div>

              <div className="space-y-3">
                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center text-lg">🌾</div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Molino Central Harinas</h4>
                      <p className="text-xs text-stone-500">Insumos: Harina repostera sin polvos, Harina con polvos, Polvo leudante</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-stone-600">
                    <span className="font-semibold block">+56 9 8765 4321</span>
                    <span className="text-stone-400">Entregas los martes y jueves</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center text-lg">🧈</div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Distribuidora Lácteos del Sur</h4>
                      <p className="text-xs text-stone-500">Insumos: Mantequilla 82%, Crema para batir 35%, Leche entera natural</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-stone-600">
                    <span className="font-semibold block">+56 9 1234 5678</span>
                    <span className="text-stone-400">Entrega en frío los lunes</span>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-800 flex items-center justify-center text-lg">🍫</div>
                    <div>
                      <h4 className="font-bold text-stone-900 text-sm">Chocolates & Coberturas Andina</h4>
                      <p className="text-xs text-stone-500">Insumos: Gotas semi-amargas 60%, Cacao puro en polvo, Esencia vainilla</p>
                    </div>
                  </div>
                  <div className="text-right text-xs text-stone-600">
                    <span className="font-semibold block">+56 9 9988 7766</span>
                    <span className="text-stone-400">Despacho express 24h</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* E. Módulo de Configuración */}
          {activeSection === 'ajustes' && (
            <div className="bg-white dark:bg-[#16100E] rounded-[26px] p-6 sm:p-8 border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-6 animate-fade-in">
              <div className="flex flex-col items-center text-center border-b border-stone-100 dark:border-[#2C1D18] pb-4">
                <h3 className="text-xl sm:text-2xl font-bold text-[#2A1B16] dark:text-[#FDF5EE] font-serif text-center">
                  Configuración de la Despensa
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 text-center">
                  Ajustes generales del sistema ERP de Pastelería Orión.
                </p>
              </div>

              <div className="space-y-4 max-w-xl mx-auto">
                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Sincronización de Datos</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    Los registros de existencias, abastecimiento y movimientos se mantienen sincronizados y respaldados en la nube.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F]">
                  <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm">Alertas de Stock Mínimo</h4>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
                    Cada ingrediente cuenta con un límite mínimo personalizado para avisar antes de que se interrumpa la producción de la pastelería.
                  </p>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Footer Limpio */}
        <footer className="bg-white dark:bg-[#16100E] border-t border-stone-200/80 dark:border-[#35251F] py-4 text-center text-xs text-stone-500 dark:text-stone-400">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <span>Pastelería Orión &bull; Sistema de Gestión de Insumos y Despensa</span>
            <span className="text-[11px] text-stone-400 dark:text-stone-500">
              Alta Repostería Artesanal
            </span>
          </div>
        </footer>
      </div>
    </div>
  );
};
