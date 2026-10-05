import { useState, useEffect, useCallback } from 'react';
import type { User, Product, ToastMessage } from './types';
import { authService } from './services/authService';
import { inventoryService } from './services/inventoryService';
import { AuthPage } from './components/auth/AuthPage';
import { AdminLayout } from './components/admin/AdminLayout';
import { UserPortalView } from './components/user/UserPortalView';
import { ToastContainer } from './components/common/Toast';
import { ThemeProvider } from './context/ThemeContext';
import './App.css';


function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => authService.getCurrentUser());
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Toast notification helper
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

  // Fetch initial data
  const loadProducts = useCallback(async () => {
    try {
      const items = await inventoryService.getProducts();
      setProducts(items);
    } catch (err) {
      console.error('Error al cargar inventario:', err);
      addToast({
        type: 'error',
        title: 'Error de inventario',
        message: 'No se pudieron cargar los productos.',
      });
    }
  }, [addToast]);

  useEffect(() => {
    loadProducts().finally(() => setIsLoading(false));

    // Suscripción reactiva a cambios de sesión (login, logout, refresh en Supabase)
    const { unsubscribe } = authService.subscribeToAuthChanges((updatedUser) => {
      setCurrentUser(updatedUser);
    });

    return () => {
      unsubscribe();
    };
  }, [loadProducts]);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    addToast({
      type: 'success',
      title: `¡Bienvenido/a, ${user.name}!`,
      message:
        user.role === 'admin'
          ? 'Has ingresado al Panel de Control ERP como Administrador.'
          : 'Has ingresado como usuario estándar.',
    });
  };

  const handleLogout = async () => {
    await authService.logout();
    setCurrentUser(null);
    addToast({
      type: 'info',
      title: 'Sesión cerrada',
      message: 'Hasta pronto.',
    });
  };

  const handleSwitchToAdmin = async () => {
    await authService.logout();
    setCurrentUser(null);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF5ED] flex flex-col items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin"></div>
          <div className="font-serif text-2xl font-bold text-[#8C1F25]">
            Pastelería Orión
          </div>
          <p className="text-xs text-stone-500 font-medium tracking-wide">
            Cargando sistema ERP...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* 1. Vista de Autenticación (Login & Registro idéntico al diseño) */}
      {!currentUser && (
        <AuthPage onLoginSuccess={handleLoginSuccess} />
      )}

      {/* 2. Vista Exclusiva de Administrador (ERP con Inventario: Agregar, Editar, Eliminar) */}
      {currentUser && currentUser.role === 'admin' && (
        <AdminLayout
          user={currentUser}
          products={products}
          onLogout={handleLogout}
          onRefresh={loadProducts}
          addToast={addToast}
        />
      )}

      {/* 3. Vista Separada de Usuario Estándar (Restringida del panel de administración) */}
      {currentUser && currentUser.role !== 'admin' && (
        <UserPortalView
          user={currentUser}
          products={products}
          onLogout={handleLogout}
          onSwitchToAdmin={handleSwitchToAdmin}
        />
      )}
    </ThemeProvider>
  );
}


export default App;
