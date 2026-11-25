import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2, X } from 'lucide-react';
import { Modal } from './Modal';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title: string;
  description: React.ReactNode;
  warningNote?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  isDeleting?: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void> | void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title,
  description,
  warningNote,
  confirmLabel = 'Sí, eliminar',
  cancelLabel = 'Cancelar',
  isDeleting = false,
  onClose,
  onConfirm,
}) => {
  const [internalDeleting, setInternalDeleting] = useState(false);
  const busy = Boolean(isDeleting || internalDeleting);

  const handleConfirm = async () => {
    if (busy) return;
    setInternalDeleting(true);
    try {
      await onConfirm();
    } finally {
      setInternalDeleting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      closeDisabled={busy}
      hideHeader
      maxWidthClassName="max-w-md"
      containerClassName="bg-[#FAF5ED] dark:bg-[#16100E] rounded-3xl shadow-2xl border border-[#DFCAA9] dark:border-[#35251F] animate-modal-pop"
      bodyClassName="p-6 overflow-y-auto flex-1"
    >
      <div className="relative flex justify-center mb-4">
        <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
          <Trash2 className="w-7 h-7" />
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="absolute top-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer disabled:opacity-40"
          aria-label="Cerrar"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <h3 className="text-xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif text-center">
        {title}
      </h3>
      <p className="text-sm text-[#5D4A3D] dark:text-[#C5B3A6] mt-2 text-center leading-relaxed">
        {description}
      </p>

      {warningNote && (
        <div className="mt-4 p-3.5 rounded-xl bg-[#F7EFE4] dark:bg-[#211612] border border-[#E4CEB1] dark:border-[#3D2C24] flex items-start gap-2.5 text-xs text-[#522D10] dark:text-[#E8BD8A]">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
          <div>{warningNote}</div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-[#4A3B32] dark:text-[#D5C2B4] font-semibold text-sm hover:bg-[#F3E7D7] dark:hover:bg-[#251A15] transition-colors cursor-pointer disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={busy}
          className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Trash2 className="w-4 h-4" />
          )}
          <span>{busy ? 'Eliminando...' : confirmLabel}</span>
        </button>
      </div>
    </Modal>
  );
};
