import { useEffect, useState } from 'react';
import { RefreshCw, WifiOff, X, CheckCircle2 } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Administra el ciclo de vida del Service Worker sin interrumpir formularios o ventas en curso:
 * muestra un aviso no intrusivo cuando la app está lista offline o cuando hay una nueva versión.
 */
export const PwaStatusOverlay: React.FC = () => {
  const [isUpdating, setIsUpdating] = useState(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        return;
      }
      window.setInterval(() => {
        if (navigator.onLine && document.visibilityState === 'visible') {
          void registration.update();
        }
      }, UPDATE_CHECK_INTERVAL_MS);
    },
  });

  useEffect(() => {
    if (!offlineReady) {
      return;
    }
    const timer = window.setTimeout(() => {
      setOfflineReady(false);
    }, 6000);
    return () => window.clearTimeout(timer);
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh && !offlineReady) {
    return null;
  }

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await updateServiceWorker(true);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed bottom-5 left-5 z-40 max-w-sm w-[calc(100vw-2.5rem)] sm:w-auto flex flex-col gap-2 pointer-events-none">
      {needRefresh && (
        <div
          role="status"
          className="pointer-events-auto flex items-start gap-3 p-4 rounded-2xl border border-[#DFCAA9] dark:border-[#42312A] bg-white dark:bg-[#1C1411] text-[#2A1B16] dark:text-[#FBF4EB] shadow-xl animate-fade-in"
        >
          <div className="w-9 h-9 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/30 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center shrink-0">
            <RefreshCw className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-snug">
              Nueva versión del ERP disponible
            </p>
            <p className="text-xs text-[#7B685C] dark:text-[#B39F93] mt-0.5 leading-relaxed">
              Actualiza cuando termines tu operación actual para aplicar las mejoras.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => void handleUpdate()}
                className="px-3 py-1.5 rounded-lg bg-[#8C1F25] hover:bg-[#74191E] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-60"
              >
                {isUpdating ? 'Actualizando...' : 'Actualizar ahora'}
              </button>
              <button
                type="button"
                disabled={isUpdating}
                onClick={() => setNeedRefresh(false)}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-[#7B685C] dark:text-[#B39F93] hover:bg-stone-100 dark:hover:bg-[#2A1E1A] transition-colors cursor-pointer"
              >
                Luego
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 transition-colors cursor-pointer"
            aria-label="Cerrar aviso de actualización"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {offlineReady && !needRefresh && (
        <div
          role="status"
          className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-white dark:bg-[#16100E] text-[#2A1B16] dark:text-[#FBF4EB] shadow-lg animate-fade-in"
        >
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 shrink-0">
            <CheckCircle2 className="w-4 h-4" />
            <WifiOff className="w-3.5 h-3.5 opacity-75" />
          </div>
          <div className="flex-1 text-xs">
            <span className="font-semibold">App lista para consulta sin conexión</span>
            <span className="block text-[11px] text-[#7B685C] dark:text-[#B39F93]">
              Catálogos visitados quedarán disponibles en modo solo lectura.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setOfflineReady(false)}
            className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 p-1 transition-colors cursor-pointer"
            aria-label="Cerrar notificación PWA"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};

