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
  X
} from 'lucide-react';
import type { User } from '../../types';

export type AdminSection = 'despensa' | 'compras' | 'recetas' | 'proveedores' | 'ajustes';

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

  const allowedSectionsForRole: Record<string, AdminSection[]> = {
    admin: ['despensa', 'compras', 'recetas', 'proveedores', 'ajustes'],
    baker: ['despensa', 'recetas'],
    cashier: ['despensa'],
  };

  const currentAllowed = allowedSectionsForRole[user.role] || ['despensa'];

  const menuItems = [
    {
      id: 'despensa' as AdminSection,
      label: 'Despensa de Insumos',
      description: 'Materias primas y stock',
      icon: Wheat,
      badge: null,
    },
    {
      id: 'compras' as AdminSection,
      label: 'Lista de Compras',
      description: 'Insumos faltantes para reponer',
      icon: ShoppingCart,
      badge: restockCount + outOfStockCount > 0 ? `${restockCount + outOfStockCount}` : null,
      badgeColor: outOfStockCount > 0 ? 'bg-rose-500 text-white' : 'bg-amber-500 text-white',
    },
    {
      id: 'recetas' as AdminSection,
      label: 'Recetas & Fichas',
      description: 'Fórmulas y uso de insumos',
      icon: BookOpen,
      badge: 'Pronto',
      badgeColor: 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
    },
    {
      id: 'proveedores' as AdminSection,
      label: 'Proveedores',
      description: 'Molinos, lácteos y materias',
      icon: Truck,
      badge: 'Pronto',
      badgeColor: 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300',
    },
    {
      id: 'ajustes' as AdminSection,
      label: 'Configuración',
      description: 'Preferencias y alertas',
      icon: Settings,
      badge: null,
    },
  ].filter((item) => currentAllowed.includes(item.id));


  const handleItemClick = (id: AdminSection) => {
    onSelectSection(id);
    onCloseMobile();
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
        {/* Top: Botón para abrir / contraer barra lateral y título centrado como en el login */}
        <div>
          <div className={`h-20 px-3.5 flex items-center border-b border-[#EADBCE] dark:border-[#35251F] ${
            !isOpen ? 'justify-center' : 'justify-between'
          }`}>
            {/* Si está cerrado: sólo el botón de menú para abrir */}
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
              /* Si está abierto: el botón de contraer a la izquierda, título estilo login centrado, y botón móvil a la derecha */
              <div className="relative flex items-center justify-between w-full h-full">
                {/* Botón de contraer menú lateral */}
                <button
                  type="button"
                  onClick={onToggleOpen}
                  className="w-9 h-9 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-[#201613] hover:bg-stone-100 dark:hover:bg-[#2C1F1B] text-stone-700 dark:text-stone-200 flex items-center justify-center transition-colors cursor-pointer shadow-xs z-10"
                  title="Contraer menú lateral"
                >
                  <Menu className="w-4 h-4" />
                </button>

                {/* Título idéntico al login, centrado en el medio del contenedor (no pegado al botón) */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                  <span className="font-serif tracking-[0.28em] text-[10px] font-bold text-[#8C1F25] dark:text-[#D4A373] uppercase leading-none">
                    Pastelería
                  </span>
                  <span className="font-serif text-xl sm:text-[22px] font-bold text-[#8C1F25] dark:text-[#E25C64] tracking-tight leading-tight -mt-0.5">
                    Orión
                  </span>
                </div>

                {/* Espaciador / Botón de cierre en móvil */}
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

          {/* Navigation Items */}
          <div className="p-3 space-y-1.5 overflow-y-auto">
            <div className={`px-3 py-2 text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider ${!isOpen && 'md:hidden'}`}>
              Módulos del Sistema
            </div>

            {menuItems.map((item) => {
              const isActive = activeSection === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={`w-full flex items-center gap-3.5 px-3.5 py-3 rounded-2xl transition-all cursor-pointer group text-left ${
                    isActive
                      ? 'bg-[#8C1F25] text-white shadow-btn'
                      : 'text-stone-700 dark:text-stone-200 hover:bg-[#FAF5ED] dark:hover:bg-[#251915] hover:text-[#8C1F25] dark:hover:text-[#F7E5C8]'
                  } ${!isOpen ? 'md:justify-center md:px-0' : ''}`}
                  title={!isOpen ? item.label : undefined}
                >
                  <div className="relative shrink-0">
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-[#8C1F25] dark:text-[#D4A373]'}`} />
                    {!isOpen && item.badge && item.id === 'compras' && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-500 ring-2 ring-white dark:ring-[#16100E]"></span>
                    )}
                  </div>

                  {(isOpen || isMobileOpen) && (
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className={`text-sm font-semibold truncate ${isActive ? 'text-white' : 'text-stone-900 dark:text-stone-100'}`}>
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.badgeColor || 'bg-stone-200 text-stone-700'}`}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <p className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-white/80' : 'text-stone-400 dark:text-stone-400'}`}>
                        {item.description}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom User Area */}
        <div className="p-3 border-t border-[#EADBCE] dark:border-[#35251F] bg-[#FAF5ED]/50 dark:bg-[#120D0B] space-y-2">

          {/* User profile details */}
          {(isOpen || isMobileOpen) ? (
            <div className="p-3 rounded-2xl bg-white dark:bg-[#1E1512] border border-[#EADBCE] dark:border-[#35251F] shadow-xs flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center font-bold text-xs shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-stone-900 dark:text-stone-100 truncate">{user.name}</div>
                  <div className="text-[10px] text-[#8C1F25] dark:text-[#D4A373] font-semibold">Administrador</div>
                </div>
              </div>
              <Sparkles className="w-3.5 h-3.5 text-[#8C1F25] dark:text-[#D4A373] shrink-0" />
            </div>
          ) : (
            <div className="flex justify-center" title={`${user.name} (Administrador)`}>
              <div className="w-9 h-9 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
          )}

          {/* Logout button */}
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
