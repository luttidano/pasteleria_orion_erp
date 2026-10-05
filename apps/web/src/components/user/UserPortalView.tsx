import type { User, Product } from '../../types';
import { LogOut, ShieldAlert, LogIn, ArrowRight } from 'lucide-react';


interface UserPortalViewProps {
  user: User;
  products: Product[];
  onLogout: () => void;
  onSwitchToAdmin: () => void;
}

export const UserPortalView: React.FC<UserPortalViewProps> = ({
  user,
  products,
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
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-stone-900 block">{user.name}</span>
              <span className="text-[11px] text-stone-500 font-mono">Usuario Estándar</span>
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
              className="shrink-0 flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs sm:text-sm font-semibold shadow-btn transition-all duration-150 cursor-pointer"
            >
              <LogIn className="w-4 h-4" />
              <span>Cambiar a cuenta de Administrador</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Customer / Colleague Showcase Preview */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-serif text-[#2A1B16]">
                Vitrina de Productos de Pastelería Orión
              </h2>
              <p className="text-xs sm:text-sm text-stone-600">
                Visualización en tiempo real de nuestra carta de repostería artesanal.
              </p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              {products.filter((p) => p.stock > 0).length} productos disponibles hoy
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {products.map((product) => {
              const isAvailable = product.stock > 0;

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-2xl p-4 border border-stone-200 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="text-[11px] font-semibold text-[#8C1F25] bg-[#8C1F25]/10 px-2 py-0.5 rounded-md">
                        {product.category}
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

                    <h4 className="font-bold text-stone-900 text-sm">{product.name}</h4>
                    {product.description && (
                      <p className="text-xs text-stone-500 mt-1 line-clamp-2">
                        {product.description}
                      </p>
                    )}
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                    <span className="text-base font-bold font-mono text-[#2A1B16]">
                      {product.price ? formatCurrency(product.price) : 'Sin precio'}
                    </span>

                    <span className="text-xs text-stone-500">
                      Unidad: {product.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-stone-200 py-4 text-center text-xs text-stone-500">
        Pastelería Orión &bull; Vista de Usuario Estándar
      </footer>
    </div>
  );
};
