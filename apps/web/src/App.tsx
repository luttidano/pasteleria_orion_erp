import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { User, Ingredient, ToastMessage } from './types';
import { authService } from './services/authService';
import { ingredientService } from './services/ingredientService';
import { AuthPage } from './components/auth/AuthPage';
import { AdminLayout } from './components/layout/AppLayout';
import { ToastContainer } from './components/common/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthGuard, RoleGuard, GuestGuard } from './guards';
import { UnauthorizedView } from './components/common/UnauthorizedView';
import { LoadingScreen } from './components/common/LoadingScreen';
import { PwaStatusOverlay } from './components/pwa/PwaStatusOverlay';
import {
  checkServerHealth,
  getConnectionStatus,
  reportApiNetworkError,
  subscribeConnectionStatus,
  type ConnectionStatusSnapshot,
} from './lib/connectionStatus';
import './App.css';

const canAccessIngredients = (role?: User['role']): boolean =>
  role === 'admin' || role === 'baker';

function AppContent() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isIngredientsLoading, setIsIngredientsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatusSnapshot>(() =>
    getConnectionStatus()
  );
  const prevHealthRef = useRef(connectionStatus.health);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const isFetchingRef = useRef(false);

  // Notificaciones Toast flotantes
  const addToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const newToast: ToastMessage = { ...toast, id };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Carga de catálogo de materias primas solo para roles con permiso de inventario
  const loadIngredients = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user || !canAccessIngredients(user.role)) {
      setIngredients([]);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsIngredientsLoading(true);

    try {
      const items = await ingredientService.getIngredients();
      setIngredients(items);
    } catch (err) {
      console.error('Error al cargar insumos:', err);
      const detail = err instanceof Error ? err.message : String(err);
      addToast({
        type: 'error',
        title: 'Error de inventario',
        message: detail || 'No se pudieron cargar los insumos.',
      });
    } finally {
      isFetchingRef.current = false;
      setIsIngredientsLoading(false);
    }
  }, [addToast]);

  // 1. Suscripción única y garantía de hidratación de sesión de Supabase al arrancar
  useEffect(() => {
    let isMounted = true;

    const { unsubscribe } = authService.subscribeToAuthChanges((updatedUser) => {
      if (!isMounted) return;
      setCurrentUser((prev) => {
        if (prev?.id === updatedUser?.id && prev?.role === updatedUser?.role) {
          return prev;
        }
        return updatedUser;
      });
      if (!updatedUser) {
        setIngredients([]);
      }
    });

    authService
      .ensureAuthReady()
      .then((user) => {
        if (!isMounted) return;
        setCurrentUser(user ?? null);
        if (!user) {
          setIngredients([]);
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // 3. Monitoreo real de conexión (Red + API NestJS + PostgreSQL) y re-sincronización
  useEffect(() => {
    const hasIngredientScope = canAccessIngredients(currentUser?.role);

    const unsubscribe = subscribeConnectionStatus((next) => {
      setConnectionStatus(next);
      const prev = prevHealthRef.current;

      if (next.health === 'online' && (prev === 'offline' || prev === 'degraded')) {
        addToast({
          type: 'success',
          title: 'Conexión Restablecida',
          message: 'El servidor ERP y la base de datos vuelven a estar operativos.',
        });
        if (currentUser?.id && hasIngredientScope && !isFetchingRef.current) {
          void loadIngredients();
        }
      } else if (next.health === 'degraded' && prev !== 'degraded') {
        addToast({
          type: 'error',
          title: 'Error de Servidor / Base de Datos',
          message: next.detail,
        });
      } else if (next.health === 'offline' && prev === 'online') {
        addToast({
          type: 'warning',
          title: 'Sin Conexión con el Servidor',
          message: next.detail,
        });
      }

      prevHealthRef.current = next.health;
    });

    void checkServerHealth();

    const handleFocusOrOnline = () => {
      void checkServerHealth();
      if (currentUser?.id && hasIngredientScope && !isFetchingRef.current) {
        void loadIngredients();
      }
    };

    const handleOffline = () => {
      reportApiNetworkError('Has perdido la conexión de red local.');
    };

    window.addEventListener('focus', handleFocusOrOnline);
    window.addEventListener('online', handleFocusOrOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('focus', handleFocusOrOnline);
      window.removeEventListener('online', handleFocusOrOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser?.id, currentUser?.role, loadIngredients, addToast]);

  // 3b. Polling adaptativo de salud solo cuando la pestaña está visible
  useEffect(() => {
    const intervalMs =
      connectionStatus.health === 'offline' || connectionStatus.health === 'degraded'
        ? 10000
        : 30000;

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkServerHealth();
      }
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [connectionStatus.health]);

  // 4. Sincronización reactiva del catálogo ante cualquier cambio de sesión o rol
  useEffect(() => {
    if (currentUser?.id && canAccessIngredients(currentUser.role)) {
      void loadIngredients();
    } else {
      setIngredients([]);
    }
  }, [currentUser?.id, currentUser?.role, loadIngredients]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    const roleMessages: Record<string, string> = {
      admin: 'Has ingresado al Panel ERP como Administrador.',
      baker: 'Has ingresado al Módulo de Inventario como Maestro Pastelero.',
      cashier: 'Has ingresado al Módulo de Punto de Venta como Cajero.',
    };
    addToast({
      type: 'success',
      title: `¡Bienvenido/a, ${user.name}!`,
      message: roleMessages[user.role] || 'Has ingresado como usuario del sistema.',
    });

    if (user.role === 'cashier') {
      navigate('/pos-caja');
    } else {
      navigate('/despensa');
    }
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    addToast({
      type: 'info',
      title: 'Sesión cerrada',
      message: 'Hasta pronto.',
    });
    navigate('/login');
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
      <PwaStatusOverlay />

      <Routes>
        {/* 1. Ruta Pública: Login (Protegido por GuestGuard) */}
        <Route
          path="/login"
          element={
            <GuestGuard user={currentUser} isLoading={isLoading}>
              <AuthPage onLoginSuccess={handleLoginSuccess} />
            </GuestGuard>
          }
        />

        {/* 2. Vista de Acceso No Autorizado (403 Forbidden estilizado) */}
        <Route
          path="/unauthorized"
          element={
            <AuthGuard user={currentUser} isLoading={isLoading}>
              <UnauthorizedView
                user={currentUser}
                requiredRole="Administrador"
                onLogout={handleLogout}
              />
            </AuthGuard>
          }
        />

        {/* 4. Rutas Limpias de Módulos ERP (Admin, Pastelero y Cajero) */}
        <Route
          path="/:section"
          element={
            <RoleGuard
              user={currentUser}
              allowedRoles={['admin', 'baker', 'cashier']}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <AdminLayout
                user={currentUser!}
                ingredients={ingredients}
                onLogout={handleLogout}
                onRefresh={loadIngredients}
                addToast={addToast}
                isLoading={isIngredientsLoading}
                isOnline={connectionStatus.health === 'online'}
                connectionStatus={connectionStatus}
                onCheckConnection={() => void checkServerHealth({ showCheckingState: true })}
              />
            </RoleGuard>
          }
        />

        {/* 5. Ruta Raíz Inteligente: Redirige según el estado de sesión y rol */}
        <Route
          path="/"
          element={
            isLoading ? (
              <LoadingScreen />
            ) : !currentUser ? (
              <Navigate to="/login" replace />
            ) : currentUser.role === 'cashier' ? (
              <Navigate to="/pos-caja" replace />
            ) : (
              <Navigate to="/despensa" replace />
            )
          }
        />

        {/* 6. Catch-all: Redirige cualquier ruta inexistente a la raíz */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
