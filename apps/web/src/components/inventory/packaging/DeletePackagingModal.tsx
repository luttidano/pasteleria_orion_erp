import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { Packaging } from '../../../types';

interface DeletePackagingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  item: Packaging | null;
}

export const DeletePackagingModal: React.FC<DeletePackagingModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  item,
}) => {
  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#1E1512] rounded-2xl max-w-md w-full border border-stone-200 dark:border-stone-800 shadow-2xl p-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-stone-900 dark:text-stone-100">Eliminar Empaque</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-stone-600 dark:text-stone-300">
          ¿Estás seguro de eliminar el empaque <strong>"{item.name}"</strong>? Esta acción no se puede deshacer.
        </p>

        <div className="flex justify-end gap-2 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-sm font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 rounded-xl bg-rose-600 text-white text-sm font-bold shadow-md hover:bg-rose-700 transition-all cursor-pointer"
          >
            Eliminar
          </button>
        </div>
      </div>
    </div>
  );
};

