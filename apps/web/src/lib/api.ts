import { supabase } from './supabase';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api';

/**
 * Helper para realizar peticiones HTTP a la API de NestJS autenticadas con el token de Supabase
 */
export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  // Obtener el token JWT activo de la sesión de Supabase
  let token: string | undefined;
  if (supabase) {
    try {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      // Ignorar fallo puntual de lectura
    }
  }

  // Fallback si la sesión en memoria aún no ha terminado de hidratar
  if (!token) {
    try {
      const stored = localStorage.getItem('pasteleria_orion_auth_token');
      if (stored) {
        const parsed = JSON.parse(stored);
        token = parsed?.access_token;
      }
    } catch {
      // Ignorar fallo de parseo
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
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
