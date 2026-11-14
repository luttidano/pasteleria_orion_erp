export const ORION_API_CATALOG_CACHE = 'orion-api-catalog-reads';

/**
 * Elimina cachés de lectura de API almacenados por el Service Worker al cerrar sesión
 * o invalidar credenciales, evitando fugas de datos entre sesiones en equipos compartidos.
 */
export async function clearPwaApiCaches(): Promise<void> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return;
  }

  try {
    await window.caches.delete(ORION_API_CATALOG_CACHE);
  } catch {
    // Ignorar fallos de Cache Storage (ej. contextos restringidos)
  }
}

