import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import type { ToastMessage } from '../../types';

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl shadow-lg border animate-fade-in transition-all ${
              isSuccess
                ? 'bg-white border-emerald-200 text-emerald-950 shadow-emerald-900/10'
                : isError
                ? 'bg-white border-rose-200 text-rose-950 shadow-rose-900/10'
                : isWarning
                ? 'bg-white border-amber-200 text-amber-950 shadow-amber-900/10'
                : 'bg-white border-stone-200 text-stone-900 shadow-stone-900/10'
            }`}
          >
            <div className="mt-0.5 shrink-0">
              {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
              {isError && <AlertCircle className="w-5 h-5 text-rose-600" />}
              {isWarning && <AlertCircle className="w-5 h-5 text-amber-600" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-5 h-5 text-stone-600" />}
            </div>
            <div className="flex-1 text-sm">
              <div className="font-semibold">{toast.title}</div>
              {toast.message && <div className="text-xs text-stone-600 mt-0.5">{toast.message}</div>}
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="text-stone-400 hover:text-stone-700 transition-colors p-1"
              aria-label="Cerrar notificación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
