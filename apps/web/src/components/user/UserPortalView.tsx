import type { User, Ingredient } from '../../types';
import { LogOut, ShieldAlert, LogIn, ArrowRight } from 'lucide-react';

interface UserPortalViewProps {
  user: User;
  ingredients: Ingredient[];
  onLogout: () => void;
  onSwitchToAdmin: () => void;
}

export const UserPortalView: React.FC<UserPortalViewProps> = ({
  user,
  ingredients,
  onLogout,
  onSwitchToAdmin,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-[#FAF5ED] flex flex-col text-[#2A1B16]">
      {/* Top Bar */}
      <header className="bg-white border-b border-[#EADBCE] shadow-xs sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex flex-col select-none">
            <span className="font-serif tracking-[0.24em] text-[10px] sm:text-[11px] font-bold text-[#8C1F25] uppercase">
              Pastelería
            </span>
            <span className="font-serif text-2xl sm:text-3xl font-bold text-[#8C1F25] -mt-1">
              Orión
            </span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-stone-100 text-stone-700 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>{user.name}</span>
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-stone-300 hover:bg-rose-50 hover:text-rose-700 text-stone-700 text-xs font-semibold transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Role Separation Notice */}
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 sm:p-6 shadow-xs animate-fade-in">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 mt-0.5">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-bold text-amber-950 font-sans">
                  Vista Restringida: Rol de Usuario Estándar
                </h3>
                <p className="text-xs sm:text-sm text-amber-800 mt-1 max-w-2xl leading-relaxed">
                  Has iniciado sesión como <strong className="font-semibold text-amber-950">{user.email}</strong>.
                  El <strong>Panel de Control ERP (Inventario, Edición y Altas)</strong> está reservado exclusivamente para cuentas con rol de Administrador.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onSwitchToAdmin}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors cursor-pointer shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>Cambiar a Cuenta Administradora</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Read-Only Product Showcase for standard users */}
        <div className="bg-white rounded-3xl border border-[#EADBCE] p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div>
              <h2 className="text-lg font-serif font-bold text-stone-900">
                Catálogo de Insumos y Repostería
              </h2>
              <p className="text-xs text-stone-500">
                Vista de sólo lectura disponible para tu perfil
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {ingredients.filter((p) => p.stock > 0).length} productos disponibles hoy
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {ingredients.map((item) => {
              const isAvailable = item.stock > 0;

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-[#8C1F25] bg-[#8C1F25]/10 px-2 py-0.5 rounded-md">
                        {item.category}
                      </span>
                      {isAvailable ? (
                        <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                          Disponible
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md">
                          Agotado
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-stone-900 text-sm">{item.name}</h4>
                    {item.description && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {item.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-[#2A1B16]">
                      {item.price ? formatCurrency(item.price) : 'Consultar'}
                    </span>
                    <span className="text-xs text-stone-400 font-medium">
                      Stock: {item.stock} {item.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
};
