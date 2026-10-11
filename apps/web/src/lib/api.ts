import { supabase } from './supabase';
import { authService } from '../services/authService';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api';

/**
 * Helper para realizar peticiones HTTP a la API de NestJS autenticadas con el token de Supabase
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // 1. Obtener el token JWT activo garantizando hidratación de sesión
  let token: string | undefined = (await authService.getValidToken()) || undefined;

  if (!token) {
    // Si la sesión se está hidratando en frío, dar una oportunidad breve de resolución
    await new Promise((r) => setTimeout(r, 400));
    token = (await authService.getValidToken()) || undefined;
  }

  if (!token) {
    console.warn('[apiFetch] Sin token de autenticación para:', endpoint);
    throw new Error('Sesión expirada o no sincronizada. Haz clic en "Cerrar sesión" y vuelve a ingresar.');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    ...(options.headers as Record<string, string> || {}),
  };

  let response: Response;
  const maxRetries = 2;
  let attempt = 0;

  while (true) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      try {
        response = await fetch(url, {
          cache: 'no-store',
          ...options,
          signal: options.signal || controller.signal,
          headers,
        });
      } finally {
        clearTimeout(timeoutId);
      }
      break;
    } catch (networkErr) {
      attempt++;
      if (attempt <= maxRetries) {
        // Si el backend aún está iniciando tras un reinicio, reintentar en 600ms
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      throw networkErr;
    }
  }

  if (!response.ok) {
    // Si la sesión expiró o fue revocada (HTTP 401), intentar auto-refrescar
    if (response.status === 401 && supabase) {
      try {
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshData.session?.access_token) {
          const newToken = refreshData.session.access_token;
          authService.setAccessToken(newToken);
          localStorage.setItem('pasteleria_orion_auth_token', JSON.stringify(refreshData.session));
          headers['Authorization'] = `Bearer ${newToken}`;
          const retryRes = await fetch(url, { ...options, headers });
          if (retryRes.ok) {
            if (retryRes.status === 204) return null as T;
            return retryRes.json();
          }
        }
      } catch {
        // Ignorar fallo en el refresh silencioso
      }
    }

    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      errorMessage = errorBody.message || errorMessage;
    } catch {
      // Ignorar si la respuesta de error no es JSON
    }
    throw new Error(errorMessage);
  }

  // Si la respuesta es 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
