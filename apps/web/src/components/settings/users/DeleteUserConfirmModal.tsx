import React, { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { UserProfile } from '../../../types';

interface DeleteUserConfirmModalProps {
  isOpen: boolean;
  userToDelete: UserProfile | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

export const DeleteUserConfirmModal: React.FC<DeleteUserConfirmModalProps> = ({
  isOpen,
  userToDelete,
  onClose,
  onConfirm,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !userToDelete) return null;

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-md bg-white dark:bg-[#18110E] rounded-[26px] p-6 shadow-modal border border-stone-200 dark:border-[#38261F] text-[#2A1B16] dark:text-[#FBF4EB] animate-modal-pop text-center"
        role="dialog"
        aria-modal="true"
      >
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <h3 className="font-serif text-lg font-bold text-stone-900 dark:text-stone-100 mb-2">
          ¿Eliminar acceso de {userToDelete.name}?
        </h3>

        <p className="text-xs text-stone-600 dark:text-stone-400 leading-relaxed mb-6">
          Esta acción desvinculará a <strong className="text-stone-900 dark:text-stone-200">{userToDelete.email}</strong> del sistema ERP. El colaborador ya no podrá iniciar sesión en la pastelería.
        </p>

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-btn transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Eliminando...</span>
              </>
            ) : (
              <span>Sí, Eliminar Acceso</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
