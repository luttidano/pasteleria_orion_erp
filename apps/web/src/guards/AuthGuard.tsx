import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import type { User } from '../types';
import { LoadingScreen } from '../components/common/LoadingScreen';

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
    return <LoadingScreen message="Verificando credenciales de acceso..." />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};
