import { useState, useEffect } from 'react';
import {
  Wheat,
  ShoppingCart,
  BookOpen,
  Truck,
  Settings,
  Menu,
  LogOut,
  Sparkles,
  ShieldCheck,
  X,
  ChevronDown,
  Boxes,
  Store,
  Receipt,
  Clock,
  TrendingUp,
  PieChart,
  FileSpreadsheet,
} from 'lucide-react';
import type { User, UserRole } from '../../types';

export type AdminSection =
  // Módulo Inventario
  | 'despensa'
  | 'recetas'
  | 'productos-elaborados'
  | 'productos-reventa'
  | 'compras'
  | 'proveedores'
  // Módulo Punto de Venta
  | 'pos-caja'
  | 'pos-historial'
  | 'pos-cierre'
  // Módulo Contabilidad
  | 'contabilidad-diario'
  | 'contabilidad-balances'
  | 'contabilidad-reportes'
  // Configuración general
  | 'ajustes';

interface SubMenuItem {
  id: AdminSection;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
  badgeColor?: string;
  allowedRoles: UserRole[];
}

interface ModuleGroup {
  id: 'inventario' | 'pos' | 'contabilidad';
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  allowedRoles: UserRole[];
  subItems: SubMenuItem[];
}

interface SidebarProps {
  user: User;
  activeSection: AdminSection;
  onSelectSection: (section: AdminSection) => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onLogout: () => void;
  restockCount: number;
  outOfStockCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeSection,
  onSelectSection,
  isOpen,
  onToggleOpen,
  isMobileOpen,
  onCloseMobile,
  onLogout,
  restockCount,
  outOfStockCount,
}) => {
  // Definición de los 3 Módulos Principales con sus respectivos accesos
  const modules: ModuleGroup[] = [
    {
      id: 'inventario',
      label: 'Inventario',
      description: 'Materias primas y despensa',
      icon: Boxes,
      allowedRoles: ['admin', 'baker'],
      subItems: [
        {
          id: 'despensa',
          label: 'Despensa de Ingredientes',
          description: 'Existencias y stock',
          icon: Wheat,
          allowedRoles: ['admin', 'baker'],
        },
        {
          id: 'recetas',
          label: 'Gestión de Recetas',
          description: 'Fórmulas y uso de insumos',
          icon: BookOpen,
          badgeColor: 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
          allowedRoles: ['admin', 'baker'],
        },
        {
          id: 'productos-elaborados',
          label: 'Productos de Elaboración',
          description: 'Pasteles, Tortas y producción',
          icon: Sparkles,
          badgeColor: 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
          allowedRoles: ['admin', 'baker'],
        },
        {
          id: 'productos-reventa',
          label: 'Productos de Reventa',
          description: 'Bebidas, abarrotes y terceros',
          icon: Store,
          badgeColor: 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
          allowedRoles: ['admin'],
        },                
        {
          id: 'compras',
          label: 'Lista de Compras',
          description: 'Insumos a reponer',
          icon: ShoppingCart,
          badge: restockCount + outOfStockCount > 0 ? `${restockCount + outOfStockCount}` : null,
          badgeColor: outOfStockCount > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white',
          allowedRoles: ['admin'],
        },

        {
          id: 'proveedores',
          label: 'Gestión de Proveedores',
          description: 'Directorio de abastecimiento',
          icon: Truck,
          allowedRoles: ['admin'],
        },
      ],
    },
    {
      id: 'pos',
      label: 'Punto de Venta',
      description: 'Caja, tickets y ventas',
      icon: Store,
      allowedRoles: ['admin', 'cashier'],
      subItems: [
        {
          id: 'pos-caja',
          label: 'Caja & Ventas',
          description: 'Cobro rápido de mostrador',
          icon: Store,
          allowedRoles: ['admin', 'cashier'],
        },
        {
          id: 'pos-historial',
          label: 'Historial de Tickets',
          description: 'Ventas y boletas del día',
          icon: Receipt,
          allowedRoles: ['admin', 'cashier'],
        },
        {
          id: 'pos-cierre',
          label: 'Cierre de Turno',
          description: 'Arqueo de caja y totales',
          icon: Clock,
          allowedRoles: ['admin', 'cashier'],
        },
      ],
    },
    {
      id: 'contabilidad',
      label: 'Contabilidad',
      description: 'Libro diario y finanzas',
      icon: TrendingUp,
      allowedRoles: ['admin'],
      subItems: [
        {
          id: 'contabilidad-diario',
          label: 'Libro Diario / Flujo',
          description: 'Ingresos y salidas del día',
          icon: TrendingUp,
          allowedRoles: ['admin'],
        },
        {
          id: 'contabilidad-balances',
          label: 'Costos & Balances',
          description: 'Márgenes de tortas y masas',
          icon: PieChart,
          allowedRoles: ['admin'],
        },
        {
          id: 'contabilidad-reportes',
          label: 'Reportes Financieros',
          description: 'Balances y estados contables',
          icon: FileSpreadsheet,
          allowedRoles: ['admin'],
        },
      ],
    },
  ];

  // Opción de Configuración ubicada a la altura de los desplegables
  const settingsItem: SubMenuItem = {
    id: 'ajustes',
    label: 'Configuración',
    description: 'Preferencias y alertas ERP',
    icon: Settings,
    allowedRoles: ['admin'],
  };

  // Filtrar módulos permitidos según el rol del usuario
  const allowedModules = modules
    .filter((mod) => mod.allowedRoles.includes(user.role))
    .map((mod) => ({
      ...mod,
      subItems: mod.subItems.filter((sub) => sub.allowedRoles.includes(user.role)),
    }));

  const canViewSettings = settingsItem.allowedRoles.includes(user.role);

  // Estado de apertura de los Dropdowns (acordeón interactivo)
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(() => ({
    inventario: ['despensa', 'compras', 'recetas', 'proveedores'].includes(activeSection),
    pos: ['pos-caja', 'pos-historial', 'pos-cierre'].includes(activeSection),
    contabilidad: ['contabilidad-diario', 'contabilidad-balances', 'contabilidad-reportes'].includes(activeSection),
  }));

  // Auto-expandir el dropdown si la sección activa cambia externamente
  useEffect(() => {
    if (['despensa', 'compras', 'recetas', 'proveedores'].includes(activeSection)) {
      setOpenDropdowns((prev) => ({ ...prev, inventario: true }));
    } else if (['pos-caja', 'pos-historial', 'pos-cierre'].includes(activeSection)) {
      setOpenDropdowns((prev) => ({ ...prev, pos: true }));
    } else if (['contabilidad-diario', 'contabilidad-balances', 'contabilidad-reportes'].includes(activeSection)) {
      setOpenDropdowns((prev) => ({ ...prev, contabilidad: true }));
    }
  }, [activeSection]);

  const toggleDropdown = (moduleId: string) => {
    if (!isOpen) {
      onToggleOpen();
      setOpenDropdowns((prev) => ({ ...prev, [moduleId]: true }));
      return;
    }
    setOpenDropdowns((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId],
    }));
  };

  const handleSubItemClick = (id: AdminSection) => {
    onSelectSection(id);
    onCloseMobile();
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'Administrador';
      case 'baker':
        return 'Pastelero / Cocina';
      case 'cashier':
        return 'Cajero / Atención';
      default:
        return 'Usuario';
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-stone-900/50 backdrop-blur-xs md:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed md:sticky top-0 left-0 z-50 h-screen bg-white dark:bg-[#16100E] border-r border-[#EADBCE] dark:border-[#35251F] shadow-sm flex flex-col justify-between transition-[width,transform] duration-300 ease-in-out ${
          isMobileOpen
            ? 'translate-x-0 w-72'
            : '-translate-x-full md:translate-x-0'
        } ${isOpen ? 'md:w-72' : 'md:w-20'}`}
      >
        {/* Top: Header con botón de menú y título */}
        <div>
          <div
            className={`h-20 px-3.5 flex items-center border-b border-[#EADBCE] dark:border-[#35251F] ${
              !isOpen ? 'justify-center' : 'justify-between'
            }`}
          >
            {!isOpen ? (
              <button
                type="button"
                onClick={onToggleOpen}
                className="w-10 h-10 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201613] hover:bg-stone-100 dark:hover:bg-[#2C1F1B] text-stone-700 dark:text-stone-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs"
                title="Desplegar barra lateral"
              >
                <Menu className="w-5 h-5" />
              </button>
            ) : (
              <div className="relative flex items-center justify-between w-full h-full">
                <button
                  type="button"
                  onClick={onToggleOpen}
                  className="w-9 h-9 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201613] hover:bg-stone-100 dark:hover:bg-[#2C1F1B] text-stone-700 dark:text-stone-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs z-10"
                  title="Contraer menú lateral"
                >
                  <Menu className="w-4 h-4" />
                </button>

                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="font-serif tracking-[0.28em] text-[10px] font-bold text-[#8C1F25] dark:text-[#D4A373] uppercase leading-none">
                    Pastelería
                  </span>
                  <span className="font-serif text-xl sm:text-[22px] font-bold text-[#8C1F25] dark:text-[#E25C64] tracking-tight leading-tight -mt-0.5">
                    Orión
                  </span>
                </div>

                <div className="w-9 flex items-center justify-end z-10">
                  <button
                    type="button"
                    onClick={onCloseMobile}
                    className="md:hidden w-8 h-8 rounded-xl flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
                    title="Cerrar menú"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Navigation Items (Dropdowns de Módulos + Configuración) */}
          <div className="p-3 space-y-2 overflow-y-auto max-h-[calc(100vh-175px)]">
            <div
              className={`px-3 py-1.5 text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider ${
                !isOpen && 'md:hidden'
              }`}
            >
              Módulos del Sistema
            </div>

            {/* Listado de Dropdowns de Módulos */}
            {allowedModules.map((module) => {
              const isExpanded = Boolean(openDropdowns[module.id]);
              const ModuleIcon = module.icon;
              const hasActiveChild = module.subItems.some((sub) => sub.id === activeSection);

              return (
                <div key={module.id} className="space-y-1">
                  {/* Encabezado del Dropdown */}
                  <button
                    type="button"
                    onClick={() => toggleDropdown(module.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer group text-left ${
                      hasActiveChild && !isOpen
                        ? 'bg-[#8C1F25] text-white shadow-btn'
                        : hasActiveChild
                        ? 'bg-[#FAF5ED] dark:bg-[#231814] text-[#8C1F25] dark:text-[#E8A598] font-semibold'
                        : 'text-stone-700 dark:text-stone-200 hover:bg-[#FAF5ED] dark:hover:bg-[#201511]'
                    } ${!isOpen ? 'md:justify-center md:px-0' : ''}`}
                    title={!isOpen ? module.label : undefined}
                  >
                    <div className="relative shrink-0 flex items-center justify-center">
                      <ModuleIcon
                        className={`w-5 h-5 transition-transform group-hover:scale-105 ${
                          hasActiveChild && !isOpen
                            ? 'text-white'
                            : 'text-[#8C1F25] dark:text-[#D4A373]'
                        }`}
                      />
                      {!isOpen &&
                        module.id === 'inventario' &&
                        restockCount + outOfStockCount > 0 && (
                          <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#16100E]"></span>
                        )}
                    </div>

                    {(isOpen || isMobileOpen) && (
                      <div className="flex-1 flex items-center justify-between min-w-0">
                        <div className="truncate">
                          <span className="text-sm font-bold block truncate">
                            {module.label}
                          </span>
                          <span className="text-[11px] text-stone-400 dark:text-stone-400 block truncate -mt-0.5 font-normal">
                            {module.description}
                          </span>
                        </div>
                        <ChevronDown
                          className={`w-4 h-4 text-stone-400 transition-transform duration-200 shrink-0 ml-1.5 ${
                            isExpanded ? 'rotate-180 text-[#8C1F25] dark:text-[#E8A598]' : ''
                          }`}
                        />
                      </div>
                    )}
                  </button>

                  {/* Sub-elementos desplegables (Indentados con guía visual) */}
                  {(isOpen || isMobileOpen) && isExpanded && (
                    <div className="pl-4 ml-4 border-l-2 border-[#EADBCE] dark:border-[#35251F] space-y-1 mt-1 animate-fade-in">
                      {module.subItems.map((sub) => {
                        const isSubActive = activeSection === sub.id;
                        const SubIcon = sub.icon;

                        return (
                          <button
                            key={sub.id}
                            type="button"
                            onClick={() => handleSubItemClick(sub.id)}
                            className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                              isSubActive
                                ? 'bg-[#8C1F25] text-white shadow-btn'
                                : 'text-stone-600 dark:text-stone-300 hover:bg-[#FAF5ED] dark:hover:bg-[#251915] hover:text-[#8C1F25] dark:hover:text-[#F7E5C8]'
                            }`}
                          >
                            <SubIcon
                              className={`w-4 h-4 shrink-0 ${
                                isSubActive ? 'text-white' : 'text-[#8C1F25] dark:text-[#D4A373]'
                              }`}
                            />
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                              <span className="text-xs font-semibold truncate">
                                {sub.label}
                              </span>
                              {sub.badge && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                                    sub.badgeColor || 'bg-stone-200 text-stone-700'
                                  }`}
                                >
                                  {sub.badge}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Botón de Configuración: a la misma altura de los desplegables */}
            {canViewSettings && (
              <div className="pt-2 border-t border-[#EADBCE]/60 dark:border-[#35251F]/60">
                <button
                  type="button"
                  onClick={() => handleSubItemClick(settingsItem.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all cursor-pointer group text-left ${
                    activeSection === settingsItem.id
                      ? 'bg-[#8C1F25] text-white shadow-btn'
                      : 'text-stone-700 dark:text-stone-200 hover:bg-[#FAF5ED] dark:hover:bg-[#201511]'
                  } ${!isOpen ? 'md:justify-center md:px-0' : ''}`}
                  title={!isOpen ? settingsItem.label : undefined}
                >
                  <Settings
                    className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                      activeSection === settingsItem.id
                        ? 'text-white'
                        : 'text-[#8C1F25] dark:text-[#D4A373]'
                    }`}
                  />
                  {(isOpen || isMobileOpen) && (
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold block truncate">
                        {settingsItem.label}
                      </span>
                      <span className="text-[11px] text-stone-400 dark:text-stone-400 block truncate -mt-0.5 font-normal">
                        {settingsItem.description}
                      </span>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom User Area */}
        <div className="p-3 border-t border-[#EADBCE] dark:border-[#35251F] bg-[#FAF5ED]/50 dark:bg-[#120D0B] space-y-2">
          {isOpen || isMobileOpen ? (
            <div className="p-3 rounded-2xl bg-white dark:bg-[#1E1512] border border-[#EADBCE] dark:border-[#35251F] shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center font-bold text-xs shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-[#8C1F25] dark:text-[#D4A373] font-semibold">
                    {getRoleLabel(user.role)}
                  </div>
                </div>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#D4A373] shrink-0" />
            </div>
          ) : (
            <div className="flex justify-center" title={`${user.name} (${getRoleLabel(user.role)})`}>
              <div className="w-9 h-9 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Botón de Cerrar Sesión */}
          <button
            type="button"
            onClick={onLogout}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 hover:text-rose-700 dark:hover:text-rose-300 hover:border-rose-200 text-stone-600 dark:text-stone-300 text-xs font-semibold transition-colors cursor-pointer ${
              !isOpen ? 'md:justify-center md:px-0' : ''
            }`}
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(isOpen || isMobileOpen) && <span>Cerrar sesión</span>}
          </button>
        </div>
      </aside>
    </>
  );
};
