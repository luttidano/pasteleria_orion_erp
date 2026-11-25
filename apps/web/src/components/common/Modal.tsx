import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  closeDisabled?: boolean;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  iconWrapperClassName?: string;
  hideHeader?: boolean;
  customHeader?: React.ReactNode;
  headerClassName?: string;
  footer?: React.ReactNode;
  footerClassName?: string;
  maxWidthClassName?: string;
  containerClassName?: string;
  bodyClassName?: string;
  zIndexClassName?: string;
  children: React.ReactNode;
}

/**
 * Contenedor modal base accesible con Portal, cierre por tecla Escape
 * y estructura estándar (header, body scrollable y footer).
 */
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  closeDisabled = false,
  title,
  subtitle,
  icon,
  iconWrapperClassName = 'bg-[#8C1F25]/10 text-[#8C1F25] dark:bg-[#8C1F25]/25 dark:text-[#E8A598]',
  hideHeader = false,
  customHeader,
  headerClassName = 'p-5 border-b border-stone-200 dark:border-[#35251F] flex items-center justify-between gap-3 bg-stone-50/50 dark:bg-[#16100E]',
  footer,
  footerClassName = 'p-4 sm:px-5 border-t border-stone-200 dark:border-[#35251F] bg-stone-50/50 dark:bg-[#16100E] flex items-center justify-end gap-2',
  maxWidthClassName = 'max-w-lg',
  containerClassName = 'bg-white dark:bg-[#1C1412] rounded-3xl shadow-2xl border border-stone-200 dark:border-[#35251F]',
  bodyClassName = 'p-5 overflow-y-auto space-y-4 flex-1',
  zIndexClassName = 'z-50',
  children,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeDisabled, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200`}
      onClick={() => {
        if (!closeDisabled) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full ${maxWidthClassName} ${containerClassName} overflow-hidden flex flex-col max-h-[90vh]`}
        onClick={(e) => e.stopPropagation()}
      >
        {customHeader
          ? customHeader
          : !hideHeader && (
          <div className={headerClassName}>
            <div className="flex items-center gap-3 min-w-0">
              {icon && (
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold shrink-0 ${iconWrapperClassName}`}
                >
                  {icon}
                </div>
              )}
              <div className="min-w-0">
                <h3 className="text-base font-bold text-stone-900 dark:text-white font-serif truncate">
                  {title}
                </h3>
                {subtitle && (
                  <p className="text-xs text-stone-500 dark:text-stone-400 truncate">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                if (!closeDisabled) {
                  onClose();
                }
              }}
              disabled={closeDisabled}
              aria-label="Cerrar ventana"
              className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#261A16] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={bodyClassName}>{children}</div>

        {/* Footer */}
        {footer && <div className={footerClassName}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
};
