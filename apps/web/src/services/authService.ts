import type { User, UserRole } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  reportApiNetworkError,
  reportApiServerError,
  reportApiSuccess,
} from '../lib/connectionStatus';
import { clearPwaApiCaches } from '../lib/pwaCache';

const STORAGE_KEY_USER = 'orion_current_user';
const LEGACY_STORAGE_KEY_USERS = 'orion_users_db';
const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api';
const AUTH_ME_TIMEOUT_MS = 6000;
const ACTIVE_ROLES = new Set<UserRole>(['admin', 'baker', 'cashier']);

let inMemoryAuthToken: string | null = null;
let verifiedCurrentUser: User | null = null;
let isLoginFlowActive = false;

export interface LoginResult {
  success: boolean;
  user?: User;
  error?: string;
  needsEmailConfirmation?: boolean;
  message?: string;
}

interface AuthoritativeProfileResponse {
  ok: boolean;
  status: number;
  user?: User;
  error?: string;
}

function isValidActiveRole(role: unknown): role is UserRole {
  return typeof role === 'string' && ACTIVE_ROLES.has(role as UserRole);
}

function decodeJwtExpMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded)) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

function isTokenExpired(token: string | null | undefined, leewayMs = 0): boolean {
  if (!token || token === 'undefined' || token === 'null') {
    return true;
  }
  const expMs = decodeJwtExpMs(token);
  if (expMs === null) {
    return false;
  }
  return expMs - leewayMs <= Date.now();
}

function purgeLegacyLocalUsers(): void {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY_USERS);
    const legacySupabaseKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        legacySupabaseKeys.push(key);
      }
    }
    for (const key of legacySupabaseKeys) {
      localStorage.removeItem(key);
    }
  } catch {
    // Ignorar error de acceso a localStorage
  }
}

function persistVerifiedUser(user: User | null): void {
  verifiedCurrentUser = user;
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(user));
    } else {
      localStorage.removeItem(STORAGE_KEY_USER);
    }
  } catch {
    // Ignorar error de almacenamiento local
  }
}

function clearLocalSessionState(): void {
  inMemoryAuthToken = null;
  persistVerifiedUser(null);
  purgeLegacyLocalUsers();
  void clearPwaApiCaches();
  try {
    localStorage.removeItem('pasteleria_orion_auth_token');
  } catch {
    // Ignorar error de acceso a localStorage
  }
}

/**
 * Consulta GET /api/auth/me directamente con el bearer token recién emitido,
 * evitando ciclos con `apiFetch -> getValidToken()`.
 */
async function fetchAuthoritativeProfile(
  token: string,
  fallbackCreatedAt?: string,
): Promise<AuthoritativeProfileResponse> {
  const url = `${API_BASE_URL}/auth/me`;
  const maxRetries = 2;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `Error ${response.status} al validar perfil`;
        try {
          const body = await response.json();
          if (typeof body?.message === 'string' && body.message.trim()) {
            errorMessage = body.message;
          }
        } catch {
          // Ignorar parseo de cuerpo no JSON
        }
        if (response.status >= 500) {
          reportApiServerError(response.status, errorMessage);
        }
        return {
          ok: false,
          status: response.status,
          error: errorMessage,
        };
      }

      const payload = (await response.json()) as {
        id?: unknown;
        name?: unknown;
        email?: unknown;
        role?: unknown;
      };

      if (
        typeof payload?.id !== 'string' ||
        typeof payload?.name !== 'string' ||
        !isValidActiveRole(payload.role)
      ) {
        return {
          ok: false,
          status: 403,
          error: 'Tu cuenta no posee un perfil operativo autorizado en el ERP.',
        };
      }

      reportApiSuccess('GET', true);
      const verifiedUser: User = {
        id: payload.id,
        name: payload.name,
        email: typeof payload.email === 'string' ? payload.email : '',
        role: payload.role,
        createdAt: fallbackCreatedAt,
      };

      return {
        ok: true,
        status: 200,
        user: verifiedUser,
      };
    } catch (networkErr) {
      clearTimeout(timeoutId);
      attempt++;
      if (attempt <= maxRetries) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      reportApiNetworkError(
        networkErr instanceof Error ? networkErr.message : 'Fallo de red al contactar API.',
      );
      return {
        ok: false,
        status: 0,
        error: 'No se pudo conectar con el servidor ERP para validar tu perfil.',
      };
    }
  }
}

/**
 * Traduce y estandariza los mensajes de error de Supabase Auth al español.
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
    return 'La contraseña debe tener al menos 8 caracteres por seguridad.';
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
  _authReadyPromise: null as Promise<User | null> | null,
  _refreshPromise: null as Promise<string | null> | null,

  /**
   * Refresca la sesión activa mediante Supabase Auth usando un candado single-flight
   * para evitar rotaciones concurrentes de refresh_token.
   */
  async refreshAccessToken(): Promise<string | null> {
    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    inMemoryAuthToken = null;

    if (!this.isUsingSupabase() || !supabase) {
      return null;
    }

    this._refreshPromise = (async () => {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        const refreshedToken = data.session?.access_token;

        if (error || !refreshedToken || isTokenExpired(refreshedToken, 15_000)) {
          inMemoryAuthToken = null;
          return null;
        }

        inMemoryAuthToken = refreshedToken;
        return refreshedToken;
      } catch {
        inMemoryAuthToken = null;
        return null;
      }
    })().finally(() => {
      this._refreshPromise = null;
    });

    return this._refreshPromise;
  },

  /**
   * Garantiza que la sesión de Supabase esté hidratada, no expirada y validada
   * contra el backend autoritativo (`GET /api/auth/me`).
   */
  async ensureAuthReady(): Promise<User | null> {
    if (this._authReadyPromise) return this._authReadyPromise;

    this._authReadyPromise = (async () => {
      purgeLegacyLocalUsers();

      if (!this.isUsingSupabase() || !supabase) {
        clearLocalSessionState();
        return null;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error || !data.session) {
          clearLocalSessionState();
          return null;
        }

        const session = data.session;
        const expiresAtMs = session.expires_at
          ? session.expires_at * 1000
          : decodeJwtExpMs(session.access_token) ?? 0;

        let activeToken = session.access_token;

        if (
          !activeToken ||
          (expiresAtMs && expiresAtMs - Date.now() < 60_000) ||
          isTokenExpired(activeToken, 60_000)
        ) {
          const refreshedToken = await this.refreshAccessToken();
          if (!refreshedToken) {
            await supabase.auth.signOut().catch(() => {});
            clearLocalSessionState();
            return null;
          }
          activeToken = refreshedToken;
        }

        inMemoryAuthToken = activeToken;

        const profileRes = await fetchAuthoritativeProfile(
          activeToken,
          session.user?.created_at,
        );

        if (!profileRes.ok || !profileRes.user) {
          if (profileRes.status === 401 || profileRes.status === 403) {
            await supabase.auth.signOut().catch(() => {});
            clearLocalSessionState();
          } else if (profileRes.status === 0) {
            // Error de red / Sin conexión a internet en PWA:
            // Si el token aún no ha expirado y ya teníamos un usuario verificado en localStorage,
            // preservamos la sesión para permitir que la PWA opere offline con caché local.
            const offlineUser = this.getCurrentUser();
            if (offlineUser && activeToken && !isTokenExpired(activeToken)) {
              inMemoryAuthToken = activeToken;
              return offlineUser;
            }
            inMemoryAuthToken = null;
            persistVerifiedUser(null);
          } else {
            // Fall closed si no se pudo verificar con el servidor ERP
            inMemoryAuthToken = null;
            persistVerifiedUser(null);
          }
          return null;
        }

        persistVerifiedUser(profileRes.user);
        return profileRes.user;
      } catch (e) {
        console.warn('[authService] Error verificando sesión en arranque:', e);
        const offlineUser = this.getCurrentUser();
        if (offlineUser && inMemoryAuthToken && !isTokenExpired(inMemoryAuthToken)) {
          return offlineUser;
        }
        inMemoryAuthToken = null;
        persistVerifiedUser(null);
        return null;
      }
    })().finally(() => {
      this._authReadyPromise = null;
    });

    return this._authReadyPromise;
  },

  /**
   * Obtiene un token JWT vigente verificando expiración y refrescando sesión si es necesario.
   */
  async getValidToken(): Promise<string | null> {
    if (inMemoryAuthToken && !isTokenExpired(inMemoryAuthToken, 30_000)) {
      return inMemoryAuthToken;
    }
    inMemoryAuthToken = null;

    if (this._authReadyPromise) {
      await this._authReadyPromise;
      if (inMemoryAuthToken && !isTokenExpired(inMemoryAuthToken, 15_000)) {
        return inMemoryAuthToken;
      }
    }

    if (!this.isUsingSupabase() || !supabase) {
      return null;
    }

    if (this._refreshPromise) {
      return this._refreshPromise;
    }

    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        return null;
      }

      const sessionToken = data.session.access_token;
      const expiresAtMs = data.session.expires_at
        ? data.session.expires_at * 1000
        : null;

      if (
        sessionToken &&
        !isTokenExpired(sessionToken, 60_000) &&
        (expiresAtMs === null || expiresAtMs - Date.now() >= 60_000)
      ) {
        inMemoryAuthToken = sessionToken;
        return inMemoryAuthToken;
      }
    } catch {
      // Continuar con refresh centralizado ante fallo al leer sesión
    }

    return this.refreshAccessToken();
  },

  /**
   * Indica si Supabase Auth está activo y configurado en el entorno.
   */
  isUsingSupabase(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  },

  /**
   * Obtiene el usuario autenticado verificado por backend si existe sesión activa válida.
   */
  getCurrentUser(): User | null {
    if (verifiedCurrentUser && isValidActiveRole(verifiedCurrentUser.role)) {
      return verifiedCurrentUser;
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY_USER);
      if (!data) return null;
      const parsed = JSON.parse(data) as Partial<User>;
      if (
        typeof parsed?.id === 'string' &&
        typeof parsed?.name === 'string' &&
        isValidActiveRole(parsed.role)
      ) {
        verifiedCurrentUser = {
          id: parsed.id,
          name: parsed.name,
          email: typeof parsed.email === 'string' ? parsed.email : '',
          role: parsed.role,
          avatarUrl: parsed.avatarUrl,
          createdAt: parsed.createdAt,
        };
        return verifiedCurrentUser;
      }
    } catch {
      // Ignorar
    }

    return null;
  },

  /**
   * Iniciar sesión (Supabase Auth + verificación autoritativa obligatoria en GET /api/auth/me).
   */
  async login(identifier: string, password: string): Promise<LoginResult> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanPass = password.trim();

    purgeLegacyLocalUsers();

    if (!cleanId || !cleanPass) {
      return {
        success: false,
        error: 'Por favor ingresa tu correo electrónico y contraseña.',
      };
    }

    if (!this.isUsingSupabase() || !supabase) {
      return {
        success: false,
        error:
          'El servicio de autenticación central no está configurado. Verifica las variables de entorno.',
      };
    }

    // Purgar cachés del Service Worker para evitar fuga de datos entre usuarios
    await clearPwaApiCaches().catch(() => {});

    isLoginFlowActive = true;
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

      if (!data.user || !data.session?.access_token) {
        return { success: false, error: 'No se encontró una sesión válida para el usuario.' };
      }

      inMemoryAuthToken = data.session.access_token;
      this._authReadyPromise = null;

      const profileRes = await fetchAuthoritativeProfile(
        data.session.access_token,
        data.user.created_at || new Date().toISOString(),
      );

      if (!profileRes.ok || !profileRes.user) {
        await this.logout();
        if (profileRes.status === 401 || profileRes.status === 403) {
          return {
            success: false,
            error:
              profileRes.error ||
              'Tu cuenta no tiene un perfil activo o rol autorizado en el ERP.',
          };
        }
        return {
          success: false,
          error:
            profileRes.error ||
            'No se pudo validar tu perfil en el servidor ERP. Verifica que la API esté activa.',
        };
      }

      persistVerifiedUser(profileRes.user);
      return { success: true, user: profileRes.user };
    } catch (err: unknown) {
      console.error('Error durante el inicio de sesión:', err);
      await this.logout();
      return {
        success: false,
        error: 'Error de comunicación durante la autenticación. Intenta nuevamente.',
      };
    } finally {
      isLoginFlowActive = false;
    }
  },

  /**
   * Recuperar contraseña (envío de email vía Supabase Auth).
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
   * Cierra la sesión activa en Supabase y limpia el estado local.
   */
  async logout(): Promise<void> {
    try {
      if (this.isUsingSupabase() && supabase) {
        await supabase.auth.signOut();
      }
    } catch (err) {
      console.error('Error al cerrar sesión en Supabase:', err);
    } finally {
      clearLocalSessionState();
      await clearPwaApiCaches().catch(() => {});
    }
  },

  /**
   * Escucha cambios en el estado de autenticación de Supabase y mantiene sincronizado
   * el perfil verificado con el backend.
   */
  subscribeToAuthChanges(callback: (user: User | null) => void): { unsubscribe: () => void } {
    if (this.isUsingSupabase() && supabase) {
      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (event === 'SIGNED_OUT' || !session?.user) {
          clearLocalSessionState();
          this._authReadyPromise = null;
          callback(null);
          return;
        }

        if (session.access_token && !isTokenExpired(session.access_token)) {
          inMemoryAuthToken = session.access_token;
        }

        if (event === 'INITIAL_SESSION') {
          // La hidratación inicial es coordinada por ensureAuthReady() con GET /api/auth/me
          return;
        }

        if (event === 'SIGNED_IN' && isLoginFlowActive) {
          // Evita consulta duplicada durante el flujo login() activo
          return;
        }

        if (
          event === 'TOKEN_REFRESHED' ||
          event === 'USER_UPDATED' ||
          event === 'SIGNED_IN'
        ) {
          if (!session.access_token) {
            clearLocalSessionState();
            callback(null);
            return;
          }

          const profileRes = await fetchAuthoritativeProfile(
            session.access_token,
            session.user.created_at,
          );

          if (profileRes.ok && profileRes.user) {
            persistVerifiedUser(profileRes.user);
            callback(profileRes.user);
          } else if (profileRes.status === 401 || profileRes.status === 403) {
            await this.logout();
            callback(null);
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
};
