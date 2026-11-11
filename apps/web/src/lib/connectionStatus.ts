export type ConnectionHealth = 'online' | 'degraded' | 'offline' | 'checking';

export interface ConnectionStatusSnapshot {
  health: ConnectionHealth;
  detail: string;
  latencyMs?: number;
  lastCheckedAt: string | null;
}

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '') + '/api';

type Listener = (snapshot: ConnectionStatusSnapshot) => void;
const listeners = new Set<Listener>();

let currentSnapshot: ConnectionStatusSnapshot = {
  health: typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'checking',
  detail:
    typeof navigator !== 'undefined' && !navigator.onLine
      ? 'Sin conexión de red local.'
      : 'Verificando conexión con el servidor ERP y base de datos...',
  lastCheckedAt: null,
};

let inFlightCheck: Promise<ConnectionStatusSnapshot> | null = null;

function notify(next: ConnectionStatusSnapshot): void {
  currentSnapshot = next;
  listeners.forEach((listener) => listener(currentSnapshot));
}

export function getConnectionStatus(): ConnectionStatusSnapshot {
  return currentSnapshot;
}

export function subscribeConnectionStatus(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentSnapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function reportApiSuccess(): void {
  if (currentSnapshot.health !== 'online') {
    notify({
      health: 'online',
      detail: 'En línea: Comunicación activa con el servidor ERP y base de datos.',
      lastCheckedAt: new Date().toISOString(),
    });
  }
}

export function reportApiServerError(statusCode: number, message?: string): void {
  if (statusCode >= 500) {
    notify({
      health: 'degraded',
      detail: message || `Error interno del servidor/BD (HTTP ${statusCode}).`,
      lastCheckedAt: new Date().toISOString(),
    });
  }
}

export function reportApiNetworkError(message?: string): void {
  const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  notify({
    health: 'offline',
    detail: isBrowserOffline
      ? 'Tu equipo no tiene conexión de red (Wi-Fi/Ethernet desconectado).'
      : message || 'No se puede contactar al servidor backend ERP.',
    lastCheckedAt: new Date().toISOString(),
  });
}

export async function checkServerHealth(options?: {
  showCheckingState?: boolean;
}): Promise<ConnectionStatusSnapshot> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineSnap: ConnectionStatusSnapshot = {
      health: 'offline',
      detail: 'Tu equipo no tiene conexión de red local.',
      lastCheckedAt: new Date().toISOString(),
    };
    notify(offlineSnap);
    return offlineSnap;
  }

  if (inFlightCheck) return inFlightCheck;

  if (options?.showCheckingState) {
    notify({
      ...currentSnapshot,
      health: 'checking',
      detail: 'Comprobando conexión con el servidor ERP y base de datos...',
    });
  }

  inFlightCheck = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    const start = performance.now();

    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });

      const measuredLatency = Math.round(performance.now() - start);

      if (response.ok) {
        let serverLatency = measuredLatency;
        try {
          const data = await response.json();
          if (typeof data?.latencyMs === 'number') {
            serverLatency = data.latencyMs;
          }
        } catch {
          // Ignorar parseo
        }

        const okSnap: ConnectionStatusSnapshot = {
          health: 'online',
          detail: `En línea: Servidor ERP y base de datos activos (${serverLatency}ms).`,
          latencyMs: serverLatency,
          lastCheckedAt: new Date().toISOString(),
        };
        notify(okSnap);
        return okSnap;
      }

      let errorDetail = `El servidor respondió HTTP ${response.status}.`;
      try {
        const body = await response.json();
        if (body?.message) errorDetail = `Base de datos desconectada: ${body.message}`;
      } catch {
        // Ignorar parseo
      }

      const degradedSnap: ConnectionStatusSnapshot = {
        health: 'degraded',
        detail: errorDetail,
        lastCheckedAt: new Date().toISOString(),
      };
      notify(degradedSnap);
      return degradedSnap;
    } catch {
      const offlineSnap: ConnectionStatusSnapshot = {
        health: 'offline',
        detail: 'Sin respuesta del servidor ERP (backend apagado o sin internet).',
        lastCheckedAt: new Date().toISOString(),
      };
      notify(offlineSnap);
      return offlineSnap;
    } finally {
      clearTimeout(timeoutId);
      inFlightCheck = null;
    }
  })();

  return inFlightCheck;
}

