import { useState, useEffect, useCallback, useRef } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import type { User, Product, ToastMessage } from './types';
import { authService } from './services/authService';
import { inventoryService } from './services/inventoryService';
import { AuthPage } from './components/auth/AuthPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { UserPortalView } from './components/user/UserPortalView';
import { ToastContainer } from './components/common/Toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthGuard, RoleGuard, GuestGuard } from './guards';
import { UnauthorizedView } from './components/common/UnauthorizedView';
import './App.css';

/**
 * Pantalla de carga inicial con la identidad de marca de Pastelería Orión
 */
const LoadingScreen = () => (
  <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex flex-col items-center justify-center p-4">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin"></div>
      <div className="font-serif text-2xl font-bold text-[#8C1F25] dark:text-[#E25C64]">
        Pastelería Orión
      </div>
      <p className="text-xs text-[#7B685C] dark:text-[#B39F93] font-medium tracking-wide">
        Cargando sistema ERP...
      </p>
    </div>
  </div>
);

function AppContent() {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductsLoading, setIsProductsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
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

  // Carga de catálogo de materias primas solo para usuarios autenticados
  const loadProducts = useCallback(async () => {
    const user = authService.getCurrentUser();
    if (!user) {
      setProducts([]);
      return;
    }

    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    setIsProductsLoading(true);

    try {
      const items = await inventoryService.getProducts();
      setProducts(items);
    } catch (err) {
      console.error('Error al cargar inventario:', err);
      const detail = err instanceof Error ? err.message : String(err);
      addToast({
        type: 'error',
        title: 'Error de inventario',
        message: detail || 'No se pudieron cargar los productos.',
      });
    } finally {
      isFetchingRef.current = false;
      setIsProductsLoading(false);
    }
  }, [addToast]);

  // 1. Suscripción única y garantía de hidratación de sesión de Supabase al arrancar
  useEffect(() => {
    let isMounted = true;

    // Suscribirse a cambios continuos (login, logout, token refresh, initial session)
    const { unsubscribe } = authService.subscribeToAuthChanges((updatedUser) => {
      if (!isMounted) return;
      setCurrentUser((prev) => {
        if (prev?.id === updatedUser?.id && prev?.role === updatedUser?.role) {
          return prev;
        }
        return updatedUser;
      });

      if (updatedUser) {
        loadProducts().finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setProducts([]);
        if (isMounted) setIsLoading(false);
      }
    });

    // Garantizar resolución asíncrona de sesión y token antes de la primera carga
    authService.ensureAuthReady().then((user) => {
      if (!isMounted) return;
      if (user) {
        setCurrentUser(user);
        loadProducts().finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
        setProducts([]);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [loadProducts]);

  // 3. Re-sincronizar automáticamente ante eventos de red (online/offline) y recuperación de foco
  useEffect(() => {
    const handleRecheck = () => {
      if (currentUser?.id && !isFetchingRef.current) {
        loadProducts();
      }
    };

    const handleOnline = () => {
      setIsOnline(true);
      addToast({
        type: 'success',
        title: 'Conexión Restablecida',
        message: 'El sistema vuelve a estar en línea. Sincronizando catálogo con el servidor...',
      });
      handleRecheck();
    };

    const handleOffline = () => {
      setIsOnline(false);
      addToast({
        type: 'warning',
        title: 'Modo Sin Conexión',
        message: 'Has perdido la conexión de red. La despensa operará con la copia local resiliente.',
      });
    };

    window.addEventListener('focus', handleRecheck);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('focus', handleRecheck);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [currentUser?.id, loadProducts, addToast]);

  // 4. Sincronización reactiva del catálogo ante cualquier cambio de sesión o usuario
  useEffect(() => {
    if (currentUser?.id) {
      loadProducts();
    }
  }, [currentUser?.id, loadProducts]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    loadProducts();
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

    if (user.role === 'admin' || user.role === 'baker') {
      navigate('/admin/despensa');
    } else if (user.role === 'cashier') {
      navigate('/admin/pos-caja');
    } else {
      navigate('/portal');
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

  const handleSwitchToAdmin = async () => {
    await authService.logout();
    setCurrentUser(null);
    navigate('/login');
  };

  return (
    <>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      <Routes>
        {/* 1. Ruta Pública / Invitados: Login & Registro (Protegido por GuestGuard) */}
        <Route
          path="/login"
          element={
            <GuestGuard user={currentUser} isLoading={isLoading}>
              <AuthPage onLoginSuccess={handleLoginSuccess} />
            </GuestGuard>
          }
        />

        {/* 2. Redirección base de administración según rol */}
        <Route
          path="/admin"
          element={
            currentUser?.role === 'cashier' ? (
              <Navigate to="/admin/pos-caja" replace />
            ) : (
              <Navigate to="/admin/despensa" replace />
            )
          }
        />

        {/* 3. Rutas de Administración y Módulos ERP (Admin, Pastelero y Cajero) */}
        <Route
          path="/admin/:section"
          element={
            <RoleGuard
              user={currentUser}
              allowedRoles={['admin', 'baker', 'cashier']}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <AdminLayout
                user={currentUser!}
                products={products}
                onLogout={handleLogout}
                onRefresh={loadProducts}
                addToast={addToast}
                isLoading={isProductsLoading}
                isOnline={isOnline}
              />
            </RoleGuard>
          }
        />

        {/* 4. Ruta de Portal de Usuario Estándar (Protegida por RoleGuard para 'user' y 'admin') */}
        <Route
          path="/portal"
          element={
            <RoleGuard
              user={currentUser}
              allowedRoles={['user', 'admin']}
              isLoading={isLoading}
              onLogout={handleLogout}
            >
              <UserPortalView
                user={currentUser!}
                products={products}
                onLogout={handleLogout}
                onSwitchToAdmin={handleSwitchToAdmin}
              />
            </RoleGuard>
          }
        />

        {/* 5. Vista de Acceso No Autorizado (403 Forbidden estilizado) */}
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

        {/* 6. Ruta Raíz Inteligente: Redirige según el estado de sesión y rol */}
        <Route
          path="/"
          element={
            isLoading ? (
              <LoadingScreen />
            ) : !currentUser ? (
              <Navigate to="/login" replace />
            ) : currentUser.role === 'admin' ? (
              <Navigate to="/admin/despensa" replace />
            ) : (
              <Navigate to="/portal" replace />
            )
          }
        />

        {/* 7. Catch-all: Redirige cualquier ruta inexistente a la raíz */}
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
