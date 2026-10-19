import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import type { User } from '../../types';
import { OrionLogo } from './OrionLogo';

interface UnauthorizedViewProps {
  user: User | null;
  requiredRole?: string;
  onLogout?: () => void;
}

export const UnauthorizedView: React.FC<UnauthorizedViewProps> = ({
  user,
  requiredRole = 'admin',
  onLogout,
}) => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    if (user?.role === 'cashier') {
      navigate('/pos-caja');
    } else if (user) {
      navigate('/despensa');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex flex-col items-center justify-center p-4 sm:p-6 text-[#2A1B16] dark:text-[#FBF4EB]">
      <div className="w-full max-w-lg bg-[#F1DFC4] dark:bg-[#18110E] rounded-[28px] p-8 sm:p-10 shadow-card border border-[#E4CCA9]/60 dark:border-[#38261F] text-center animate-modal-pop">
        {/* Medallón Logo Orión */}
        <div className="flex justify-center mb-5">
          <OrionLogo size="lg" />
        </div>

        {/* Badge de Seguridad Cálido */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 border border-[#8C1F25]/20 dark:border-[#8C1F25]/40 text-[#8C1F25] dark:text-[#E8A598] text-xs font-semibold uppercase tracking-wider mb-4">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>Control de Acceso &bull; Rol Requerido</span>
        </div>

        {/* Título Principal */}
        <h1 className="font-serif text-2xl sm:text-3xl font-bold text-[#8C1F25] dark:text-[#E25C64] tracking-tight mb-3">
          Acceso Restringido
        </h1>

        {/* Explicación Detallada */}
        <p className="text-xs sm:text-sm text-[#5D4A3D] dark:text-[#D5C2B4] leading-relaxed mb-6 font-medium">
          La ruta a la que intentas ingresar está reservada exclusivamente para cuentas con rol de{' '}
          <strong className="text-[#8C1F25] dark:text-[#FF8A91] font-bold">
            {requiredRole === 'admin' ? 'Administrador' : requiredRole}
          </strong>.
          {user && (
            <span className="block mt-2 text-[13px] text-[#7B685C] dark:text-[#B39F93]">
              Sesión activa: <span className="font-semibold text-[#2A1B16] dark:text-[#FBF4EB]">{user.email}</span> (Rol:{' '}
              <span className="font-mono font-semibold">{user.role}</span>).
            </span>
          )}
        </p>

        {/* Botones de Acción */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={handleGoHome}
            className="w-full sm:w-auto px-5 py-3 rounded-xl bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs sm:text-sm font-semibold shadow-btn transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer active:scale-98"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Ir a la página principal</span>
          </button>

          {onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="w-full sm:w-auto px-4 py-3 rounded-xl border border-[#DFCAA9] dark:border-[#38261F] bg-white/70 dark:bg-[#221713] hover:bg-white dark:hover:bg-[#2A1D18] text-[#5D4A3D] dark:text-[#D5C2B4] text-xs sm:text-sm font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>Cerrar sesión</span>
            </button>
          )}
        </div>
      </div>

      {/* Pie Institucional */}
      <div className="mt-5 text-center text-xs text-[#A8988D] dark:text-[#6C584C]">
        Pastelería Orión ERP &bull; Seguridad y Control de Navegación por Rol
      </div>
    </div>
  );
};
