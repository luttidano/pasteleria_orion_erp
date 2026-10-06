import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User, UserRole } from '../types';
import { UnauthorizedView } from '../components/common/UnauthorizedView';

interface RoleGuardProps {
  user: User | null;
  allowedRoles: UserRole[];
  isLoading?: boolean;
  onLogout?: () => void;
  children: React.ReactNode;
}

/**
 * Guard de navegación por rol.
 * 1. Si no está autenticado -> Redirige a /login guardando la ruta de destino.
 * 2. Si está autenticado pero su rol no está en allowedRoles -> Muestra la vista de acceso restringido estilizada.
 * 3. Si su rol es válido -> Renderiza la ruta solicitada.
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  user,
  allowedRoles,
  isLoading = false,
  onLogout,
  children,
}) => {
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin"></div>
          <div className="font-serif text-2xl font-bold text-[#8C1F25] dark:text-[#E25C64]">
            Pastelería Orión
          </div>
          <p className="text-xs text-[#7B685C] dark:text-[#B39F93] font-medium tracking-wide">
            Validando permisos y privilegios de rol...
          </p>
        </div>
      </div>
    );
  }

  // Si no hay usuario activo, redirigir a login
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Si el usuario no posee el rol autorizado para esta ruta
  if (!allowedRoles.includes(user.role)) {
    return (
      <UnauthorizedView
        user={user}
        requiredRole={allowedRoles.join(' o ')}
        onLogout={onLogout}
      />
    );
  }

  return <>{children}</>;
};
