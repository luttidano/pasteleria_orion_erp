import { createPortal } from 'react-dom';
import { Trash2, AlertTriangle, X } from 'lucide-react';
import type { Ingredient } from '../../../types';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  ingredient: Ingredient | null;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting: boolean;
}

export const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({
  isOpen,
  ingredient,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  if (!isOpen || !ingredient) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-[#FAF5ED] dark:bg-[#16100E] rounded-3xl max-w-md w-full shadow-2xl border border-[#DFCAA9] dark:border-[#35251F] overflow-hidden animate-modal-pop">
        <div className="p-6">
          <div className="relative flex justify-center mb-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center shadow-xs">
              <Trash2 className="w-7 h-7" />
            </div>
            <button
              onClick={onClose}
              disabled={isDeleting}
              className="absolute top-0 right-0 w-8 h-8 rounded-full flex items-center justify-center text-[#7C695C] hover:text-[#1C120D] dark:text-[#9F8C7F] dark:hover:text-[#FBF4EB] hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <h3 className="text-xl font-bold text-[#1C120D] dark:text-[#FBF4EB] font-serif text-center">
            ¿Eliminar ingrediente de la despensa?
          </h3>
          <p className="text-sm text-[#5D4A3D] dark:text-[#C5B3A6] mt-2 text-center">
            Estás a punto de quitar{' '}
            <strong className="text-[#1C120D] dark:text-[#FBF4EB] font-bold">"{ingredient.name}"</strong>.
            Esta materia prima ya no figurará en la lista de insumos.
          </p>

          <div className="mt-4 p-3.5 rounded-xl bg-[#F7EFE4] dark:bg-[#211612] border border-[#E4CEB1] dark:border-[#3D2C24] flex items-start gap-2.5 text-xs text-[#522D10] dark:text-[#E8BD8A]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
            <div>
              Cantidad registrada:{' '}
              <span className="font-bold">
                {ingredient.stock} {ingredient.unit}
              </span>
              . Si solo se agotó temporalmente, te recomendamos dejar su cantidad en 0 en lugar de eliminarlo.
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2.5 rounded-xl border border-[#DFCAA9] dark:border-[#3D2C24] text-[#4A3B32] dark:text-[#D5C2B4] font-semibold text-sm hover:bg-[#F3E7D7] dark:hover:bg-[#251A15] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-semibold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer disabled:opacity-75"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              <span>Sí, quitar de la despensa</span>
            </button>
          </div>

        </div>
      </div>
    </div>,
    document.body
  );
};
