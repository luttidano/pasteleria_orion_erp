import type { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY_USER = 'orion_current_user';
const STORAGE_KEY_REGISTERED_USERS = 'orion_users_db';

let inMemoryAuthToken: string | null = null;

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
  needsEmailConfirmation?: boolean;
  message?: string;
}

/**
 * Traduce y estandariza los mensajes de error de Supabase Auth al español
 */
function translateSupabaseAuthError(message: string): string {
  const msg = message.toLowerCase();
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Correo o contraseña incorrectos. Por favor verifica tus credenciales.';
  }
  if (msg.includes('email not confirmed')) {
    return 'Tu correo electrónico aún no ha sido confirmado. Por favor revisa tu bandeja de entrada o spam.';
  }
  if (msg.includes('user already registered') || msg.includes('already exists')) {
    return 'Este correo electrónico ya está registrado. Por favor inicia sesión.';
  }
  if (msg.includes('password should be at least')) {
    return 'La contraseña debe tener al menos 6 caracteres por seguridad.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Demasiados intentos seguidos. Por favor espera un momento e intenta de nuevo.';
  }
  if (msg.includes('unable to validate email') || msg.includes('invalid email')) {
    return 'El formato del correo electrónico ingresado no es válido.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return 'Error de conexión con el servidor. Revisa tu conexión a internet.';
  }
  return message;
}

export const authService = {
  /**
   * Obtiene de forma síncrona el token de autenticación activo
   */
  getAccessToken(): string | null {
    if (inMemoryAuthToken) return inMemoryAuthToken;

    // 1. Probar clave de persistencia dedicada
    try {
      const stored = localStorage.getItem('pasteleria_orion_auth_token');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.access_token) {
          inMemoryAuthToken = parsed.access_token;
          return inMemoryAuthToken;
        }
      }
    } catch {
      // Ignorar
    }

    // 2. Probar claves automáticas de Supabase en localStorage (sb-*-auth-token)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const item = localStorage.getItem(key);
          if (item) {
            const parsed = JSON.parse(item);
            if (parsed?.access_token) {
              inMemoryAuthToken = parsed.access_token;
              return inMemoryAuthToken;
            }
          }
        }
      }
    } catch {
      // Ignorar
    }

    return null;
  },

  /**
   * Obtiene el token garantizando hidratación de sesión de Supabase si aún no está en memoria
   */
  async getValidToken(): Promise<string | null> {
    if (inMemoryAuthToken) return inMemoryAuthToken;

    if (this.isUsingSupabase() && supabase) {
      try {
        const { data } = await supabase.auth.getSession();
        if (data.session?.access_token) {
          inMemoryAuthToken = data.session.access_token;
          return inMemoryAuthToken;
        }
      } catch {
        // Ignorar
      }
    }

    return this.getAccessToken();
  },

  /**
   * Actualiza el token en memoria
   */
  setAccessToken(token: string | null): void {
    inMemoryAuthToken = token;
  },

  /**
   * Indica si Supabase está activo y conectado en el entorno
   */
  isUsingSupabase(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  },

  /**
   * Obtiene la sesión actual persistida de forma síncrona para render instantáneo
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
   * Iniciar sesión (Supabase Auth)
   */
  async login(identifier: string, password: string): Promise<LoginResult> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      return { success: false, error: 'Por favor ingresa tu correo electrónico y contraseña.' };
    }

    // 1. Si Supabase está configurado, autenticar con Supabase Auth
    if (this.isUsingSupabase() && supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanId,
          password: cleanPass,
        });

        if (error) {
          return {
            success: false,
            error: translateSupabaseAuthError(error.message),
          };
        }

        if (!data.user) {
          return { success: false, error: 'No se encontró la sesión del usuario.' };
        }

        // Asegurar persistencia inmediata del token para peticiones síncronas/inmediatas
        if (data.session) {
          inMemoryAuthToken = data.session.access_token;
          try {
            localStorage.setItem('pasteleria_orion_auth_token', JSON.stringify(data.session));
          } catch {
            // Ignorar
          }
        }

        // Obtener rol y nombre del usuario desde tabla `profiles` o `user_metadata`
        let userRole: UserRole = 'user';
        let userName =
          data.user.user_metadata?.name ||
          data.user.email?.split('@')[0] ||
          'Usuario';

        // Intentar consultar tabla `profiles` si existe en Supabase
        try {
          const { data: profile } = await supabase
            .from('profile')
            .select('name, role')
            .eq('id', data.user.id)
            .maybeSingle();

          if (profile) {
            if (profile.role) userRole = profile.role as UserRole;
            if (profile.name) userName = profile.name;
          } else if (data.user.user_metadata?.role) {
            userRole = data.user.user_metadata.role as UserRole;
          }
        } catch {
          // Si la tabla profiles no existe aún, usar metadata
          if (data.user.user_metadata?.role) {
            userRole = data.user.user_metadata.role as UserRole;
          }
        }

        // Si el correo es el del administrador oficial, garantizar rol admin
        if (
          data.user.email === 'admin@pasteleriaorion.com' ||
          data.user.email?.toLowerCase().startsWith('admin@')
        ) {
          userRole = 'admin';
        }

        const sessionUser: User = {
          id: data.user.id,
          name: userName,
          email: data.user.email || cleanId,
          role: userRole,
          createdAt: data.user.created_at || new Date().toISOString(),
        };

        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(sessionUser));
        return { success: true, user: sessionUser };
      } catch (err: unknown) {
        console.error('Error durante el inicio de sesión en Supabase:', err);
        return {
          success: false,
          error: 'Error de comunicación con Supabase. Revisa tu conexión a internet.',
        };
      }
    }

    // 3. Fallback a base de datos local en localStorage (cuando no hay Supabase en .env)
    const users: Array<User & { passwordHash: string }> = this.getRegisteredUsers();
    const foundUser = users.find(
      (u) => u.email.toLowerCase() === cleanId || u.name.toLowerCase() === cleanId
    );

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

    // Si el servicio no está configurado en este equipo (falta archivo .env)
    return {
      success: false,
      error:
        'El sistema se encuentra en modo local sin conexión al servidor central. Configura el archivo de entorno (.env) o reinicia el servidor.',
    };
  },

  /**
   * Registro de nuevo usuario (Producción con Supabase + Fallback local)
   */
  async register(
    name: string,
    email: string,
    password: string,
    role: UserRole = 'user'
  ): Promise<LoginResult> {
    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanName || !cleanEmail || !cleanPass) {
      return { success: false, error: 'Todos los campos son obligatorios.' };
    }

    // Validación básica de formato de correo
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Por favor ingresa un correo electrónico válido.' };
    }

    // Supabase Auth exige mínimo 6 caracteres
    if (cleanPass.length < 6) {
      return { success: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }


    // 1. Registro con Supabase en Producción
    if (this.isUsingSupabase() && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: {
              name: cleanName,
              role: role,
            },
          },
        });

        if (error) {
          return {
            success: false,
            error: translateSupabaseAuthError(error.message),
          };
        }

        if (!data.user) {
          return {
            success: false,
            error: 'No se pudo crear la cuenta de usuario.',
          };
        }

        const newUser: User = {
          id: data.user.id,
          name: cleanName,
          email: cleanEmail,
          role: role,
          createdAt: data.user.created_at || new Date().toISOString(),
        };

        // Intentar registrar perfil en tabla `profiles` si existe
        try {
          await supabase.from('profile').upsert({
            id: data.user.id,
            name: cleanName,
            email: cleanEmail,
            role: role,
          });
        } catch {
          // Continuar normalmente si la tabla profiles no existe o está gestionada por trigger
        }

        // Si Supabase requiere confirmación de email (session es null)
        if (!data.session) {
          return {
            success: true,
            user: newUser,
            needsEmailConfirmation: true,
            message:
              '¡Cuenta creada exitosamente! Revisa tu correo electrónico para confirmar tu cuenta antes de iniciar sesión.',
          };
        }

        // Si la sesión quedó iniciada directamente (auto-confirm habilitado)
        localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
        return {
          success: true,
          user: newUser,
          message: '¡Registro exitoso! Bienvenido a Pastelería Orión.',
        };
      } catch (err: unknown) {
        console.error('Error durante el registro en Supabase:', err);
        return {
          success: false,
          error: 'Error de comunicación con el servicio de registro de Supabase.',
        };
      }
    }

    // 2. Fallback a almacenamiento local si Supabase no está configurado
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

    users.push({ ...newUser, passwordHash: cleanPass });
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));

    // Auto-login tras registro local
    localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(newUser));
    return { success: true, user: newUser };
  },

  /**
   * Recuperar contraseña (envío de email vía Supabase Auth)
   */
  async resetPassword(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: 'Por favor ingresa tu correo electrónico.' };
    }

    if (this.isUsingSupabase() && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: window.location.origin,
        });

        if (error) {
          return {
            success: false,
            message: translateSupabaseAuthError(error.message),
          };
        }

        return {
          success: true,
          message: 'Se ha enviado un enlace de recuperación a tu correo electrónico.',
        };
      } catch {
        return {
          success: false,
          message: 'No se pudo enviar el correo de recuperación.',
        };
      }
    }

    return {
      success: false,
      message: 'No se pudo enviar el correo de recuperación. Verifica la configuración de Supabase.',
    };
  },

  /**
   * Cierra la sesión activa en Supabase y limpia el estado local
   */
  async logout(): Promise<void> {
    try {
      if (this.isUsingSupabase() && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Error al cerrar sesión en Supabase:', err);
    } finally {
      inMemoryAuthToken = null;
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.removeItem('pasteleria_orion_auth_token');
    }
  },

  /**
   * Escucha cambios en el estado de autenticación de Supabase (token refresh, logout externo)
   */
  subscribeToAuthChanges(callback: (user: User | null) => void): { unsubscribe: () => void } {
    if (this.isUsingSupabase() && supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          inMemoryAuthToken = null;
          localStorage.removeItem(STORAGE_KEY_USER);
          callback(null);
        } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.access_token) {
            inMemoryAuthToken = session.access_token;
          }
          // Actualizar datos de usuario
          const currentUser = this.getCurrentUser();
          if (currentUser) {
            callback(currentUser);
          }
        }
      });

      return {
        unsubscribe: () => subscription.unsubscribe(),
      };
    }

    return {
      unsubscribe: () => {},
    };
  },

  /**
   * Obtiene la base de datos simulada de usuarios registrados en localStorage
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
