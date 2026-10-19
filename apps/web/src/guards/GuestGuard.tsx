import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '../types';

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
    return (
      <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin"></div>
          <div className="font-serif text-2xl font-bold text-[#8C1F25] dark:text-[#E25C64]">
            Pastelería Orión
          </div>
          <p className="text-xs text-[#7B685C] dark:text-[#B39F93] font-medium tracking-wide">
            Cargando sesión...
          </p>
        </div>
      </div>
    );
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
