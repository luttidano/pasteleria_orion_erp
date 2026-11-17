import { authService } from '../services/authService';
import {
  reportApiNetworkError,
  reportApiServerError,
  reportApiSuccess,
} from './connectionStatus';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api';
const REQUEST_TIMEOUT_MS = 6000;
const SAFE_IDEMPOTENT_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const KEYED_MUTATION_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function createIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  headers: Record<string, string>,
): Promise<Response> {
  const controller = new AbortController();
  const externalSignal = options.signal;

  if (externalSignal?.aborted) {
    controller.abort(externalSignal.reason);
  }

  const onExternalAbort = () => controller.abort(externalSignal?.reason);
  externalSignal?.addEventListener('abort', onExternalAbort, { once: true });

  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      cache: 'no-store',
      ...options,
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

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
    ...((options.headers as Record<string, string>) || {}),
  };

  const method = (options.method || 'GET').toUpperCase();
  const hasIdempotencyHeader = Object.keys(headers).some(
    (key) => key.toLowerCase() === 'idempotency-key',
  );
  if (!hasIdempotencyHeader && KEYED_MUTATION_METHODS.has(method)) {
    headers['Idempotency-Key'] = createIdempotencyKey();
  }

  const maxRetries = SAFE_IDEMPOTENT_METHODS.has(method) ? 2 : 0;

  let response: Response;
  let attempt = 0;

  while (true) {
    try {
      response = await fetchWithTimeout(url, options, headers);
      break;
    } catch (networkErr) {
      if (options.signal?.aborted) {
        throw networkErr;
      }

      attempt++;
      if (attempt <= maxRetries) {
        // Reintentar solo métodos seguros/idempotentes si el backend aún está iniciando
        await new Promise((r) => setTimeout(r, 600));
        continue;
      }
      reportApiNetworkError(
        networkErr instanceof Error ? networkErr.message : 'Fallo de red al contactar API.',
      );
      throw networkErr;
    }
  }

  // Si la sesión expiró o fue revocada (HTTP 401), delegar refresh centralizado una vez
  if (response.status === 401) {
    const refreshedToken = await authService.refreshAccessToken();

    if (refreshedToken) {
      headers['Authorization'] = `Bearer ${refreshedToken}`;
      try {
        response = await fetchWithTimeout(url, options, headers);
      } catch (networkErr) {
        if (!options.signal?.aborted) {
          reportApiNetworkError(
            networkErr instanceof Error ? networkErr.message : 'Fallo de red al contactar API.',
          );
        }
        throw networkErr;
      }
    }

    if (response.status === 401) {
      await authService.logout();
    }
  }

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status} ${response.statusText}`;
    try {
      const errorBody = await response.json();
      if (Array.isArray(errorBody?.message)) {
        errorMessage = errorBody.message.join(', ');
      } else if (typeof errorBody?.message === 'string' && errorBody.message.trim()) {
        errorMessage = errorBody.message;
      }
    } catch {
      // Ignorar si la respuesta de error no es JSON
    }
    if (response.status >= 500) {
      reportApiServerError(response.status, errorMessage);
    }
    throw new Error(errorMessage);
  }

  reportApiSuccess(method);

  // Si la respuesta es 204 No Content
  if (response.status === 204) {
    return null as T;
  }

  return response.json();
}
