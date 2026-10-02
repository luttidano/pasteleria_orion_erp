import type { User, UserRole } from '../types';

const STORAGE_KEY_USER = 'orion_current_user';
const STORAGE_KEY_REGISTERED_USERS = 'orion_users_db';

// Usuario administrador inicial según especificación
const ADMIN_USER: User = {
  id: 'admin-001',
  name: 'Administrador Orión',
  email: 'admin@pasteleriaorion.com',
  role: 'admin',
  createdAt: new Date().toISOString(),
};

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
}

export const authService = {
  /**
   * Obtiene la sesión actual persistida
   */
  getCurrentUser(): User | null {
    try {
      const data = localStorage.getItem(STORAGE_KEY_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  /**
   * Iniciar sesión
   * Por el momento valida:
   * - admin / 1234 (o admin@pasteleriaorion.com / 1234) -> Acceso Admin al ERP
   * - usuarios registrados previamente -> Acceso a vista de usuario
   * TODO: Conectar con Supabase Auth:
   * const { data, error } = await supabase.auth.signInWithPassword({ email, password });
   */
  async login(identifier: string, password: string): Promise<LoginResult> {
    // Simulación de latencia de red para UX natural
    await new Promise((resolve) => setTimeout(resolve, 350));

    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    // 1. Verificación de credenciales de Administrador
    if ((cleanId === 'admin' || cleanId === 'admin@pasteleriaorion.com' || cleanId === 'admin@correo.com') && cleanPass === '1234') {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(ADMIN_USER));
      return { success: true, user: ADMIN_USER };
    }

    // 2. Verificación de usuarios registrados
    const users: Array<User & { passwordHash: string }> = this.getRegisteredUsers();
    const foundUser = users.find((u) => u.email.toLowerCase() === cleanId || u.name.toLowerCase() === cleanId);

    if (foundUser) {
      if (foundUser.passwordHash === cleanPass) {
        const sessionUser: User = {
          id: foundUser.id,
          name: foundUser.name,
          email: foundUser.email,
          role: foundUser.role,
          createdAt: foundUser.createdAt,
        };
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
      } else {
        return { success: false, error: 'Contraseña incorrecta.' };
      }
    }

    return {
      success: false,
      error: 'Credenciales inválidas. Usa admin / 1234 para acceder al ERP.',
    };
  },

  /**
   * Registro de nuevo usuario
   * TODO: Conectar con Supabase Auth:
   * const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { name, role: 'user' } } });
   */
  async register(name: string, email: string, password: string, role: UserRole = 'user'): Promise<LoginResult> {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    if (!cleanName || !cleanEmail || !password) {
      return { success: false, error: 'Todos los campos son obligatorios.' };
    }

    if (cleanEmail === 'admin' || cleanEmail === 'admin@pasteleriaorion.com') {
      return { success: false, error: 'El identificador admin está reservado para el administrador.' };
    }

    const users = this.getRegisteredUsers();
    if (users.some((u) => u.email.toLowerCase() === cleanEmail)) {
      return { success: false, error: 'Este correo electrónico ya está registrado.' };
    }

    const newUser: User = {
      id: 'usr-' + Date.now(),
      name: cleanName,
      email: cleanEmail,
      role: role,
      createdAt: new Date().toISOString(),
    };

    users.push({ ...newUser, passwordHash: password.trim() });
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));

    // Auto-login tras registro
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    return { success: true, user: newUser };
  },

  /**
   * Cierra la sesión activa
   * TODO: await supabase.auth.signOut();
   */
  async logout(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY_USER);
  },

  /**
   * Obtiene la base de datos simulada de usuarios registrados
   */
  getRegisteredUsers(): Array<User & { passwordHash: string }> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
};
