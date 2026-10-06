import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '../types';

interface AuthGuardProps {
  user: User | null;
  isLoading?: boolean;
  children: React.ReactNode;
}

/**
 * Guard de navegación que restringe el acceso únicamente a usuarios autenticados.
 * Si no hay sesión activa, redirige a /login recordando la ruta de origen en location.state.
 */
export const AuthGuard: React.FC<AuthGuardProps> = ({
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
            Verificando credenciales de acceso...
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
