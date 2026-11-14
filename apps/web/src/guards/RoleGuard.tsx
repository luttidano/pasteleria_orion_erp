import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User, UserRole } from '../types';
import { UnauthorizedView } from '../components/common/UnauthorizedView';
import { LoadingScreen } from '../components/common/LoadingScreen';

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
    return <LoadingScreen message="Validando permisos y privilegios de rol..." />;
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
