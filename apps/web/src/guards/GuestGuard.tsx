import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '../types';
import { LoadingScreen } from '../components/common/LoadingScreen';

interface GuestGuardProps {
  user: User | null;
  isLoading?: boolean;
  children: React.ReactNode;
}

/**
 * Guard para rutas exclusivas de invitados o no autenticados (como /login).
 * Si el usuario ya cuenta con sesión activa:
 * - Cajero -> Redirige a /pos-caja.
 * - Admin / Pastelero -> Redirige a /despensa.
 */
export const GuestGuard: React.FC<GuestGuardProps> = ({
  user,
  isLoading = false,
  children,
}) => {
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen message="Cargando sesión..." />;
  }

  if (user) {
    // Si venía redirigido de una ruta anterior que intentó abrir
    const fromPath = (location.state as { from?: { pathname?: string } })?.from?.pathname;
    if (fromPath && fromPath !== '/login') {
      return <Navigate to={fromPath} replace />;
    }

    // Redirección por defecto según rol
    return user.role === 'cashier' ? (
      <Navigate to="/pos-caja" replace />
    ) : (
      <Navigate to="/despensa" replace />
    );
  }

  return <>{children}</>;
};
