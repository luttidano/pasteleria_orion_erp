import React, { useState, useRef } from 'react';
import { Receipt, Building2, Calendar, AlertCircle } from 'lucide-react';
import { createIdempotencyKey } from '../../../lib/api';
import { Modal } from '../../common/Modal';
import type { CreateSupplierInvoicePayload, Supplier } from '../../../types';

interface CreateInvoiceModalProps {
  isOpen: boolean;
  suppliers: Supplier[];
  onClose: () => void;
  onConfirm: (
    payload: CreateSupplierInvoicePayload,
    idempotencyKey?: string,
  ) => Promise<void>;
}

export const CreateInvoiceModal: React.FC<CreateInvoiceModalProps> = ({
  isOpen,
  suppliers,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  return (
    <CreateInvoiceModalContent
      suppliers={suppliers}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

interface ContentProps {
  suppliers: Supplier[];
  onClose: () => void;
  onConfirm: CreateInvoiceModalProps['onConfirm'];
}

const CreateInvoiceModalContent: React.FC<ContentProps> = ({
  suppliers,
  onClose,
  onConfirm,
}) => {
  const todayStr = new Date().toISOString().slice(0, 10);
  const addDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().slice(0, 10);
  };

  const [supplierId, setSupplierId] = useState<string>(
    suppliers[0]?.id || '',
  );
  const [invoiceNumber, setInvoiceNumber] = useState<string>('');
  const [issueDate, setIssueDate] = useState<string>(todayStr);
  const [dueDate, setDueDate] = useState<string>(addDays(30));
  const [totalAmount, setTotalAmount] = useState<number | ''>('');
  const [hasInvoice, setHasInvoice] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Por favor selecciona un proveedor.');
      return;
    }

    if (!invoiceNumber.trim()) {
      setError('Por favor ingresa el número de factura o boleta.');
      return;
    }

    if (!totalAmount || Number(totalAmount) <= 0) {
      setError('El monto total debe ser mayor a 0.');
      return;
    }

    if (dueDate < issueDate) {
      setError('La fecha de vencimiento no puede ser anterior a la de emisión.');
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = idempotencyKeyRef.current ?? createIdempotencyKey();
      idempotencyKeyRef.current = idempotencyKey;

      await onConfirm(
        {
          supplierId,
          invoiceNumber: invoiceNumber.trim().toUpperCase(),
          issueDate,
          dueDate,
          totalAmount: Number(totalAmount),
          hasInvoice,
          notes: notes.trim() || undefined,
        },
        idempotencyKey,
      );
      idempotencyKeyRef.current = null;
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar la factura de proveedor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeDisabled={isSubmitting}
      title="Nueva Factura por Pagar (CxP)"
      subtitle="Registra compras a crédito de materias primas o insumos"
      icon={<Receipt className="w-5 h-5" />}
      iconWrapperClassName="bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-300 hover:bg-stone-200/50 dark:hover:bg-stone-800 cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="create-invoice-form"
            disabled={isSubmitting || !totalAmount}
            className="px-5 py-2.5 rounded-xl text-xs font-bold bg-[#8C1F25] hover:bg-[#73191E] text-white shadow-md disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Factura por Pagar'}
          </button>
        </div>
      }
    >
      {error && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

          <form id="create-invoice-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Proveedor */}
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Proveedor *
              </label>
              <div className="relative">
                <select
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full text-xs p-3 rounded-2xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E] text-stone-900 dark:text-white appearance-none"
                >
                  <option value="" disabled>
                    Selecciona un proveedor...
                  </option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.icon || '🚚'} {s.name} {s.rut ? `(RUT: ${s.rut})` : `(${s.category})`}
                    </option>
                  ))}
                </select>
                <Building2 className="w-4 h-4 text-stone-400 absolute right-3 top-3.5 pointer-events-none" />
              </div>
            </div>

            {/* Número de Factura y Monto */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  N° Factura / Boleta *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej.: FAC-10293"
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  className="w-full text-xs p-3 rounded-2xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E] uppercase font-mono font-bold"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Monto Total ($) *
                </label>
                <input
                  type="number"
                  required
                  min="1"
                  step="1"
                  placeholder="Ej.: 350000"
                  value={totalAmount}
                  onChange={(e) =>
                    setTotalAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  className="w-full text-sm font-mono font-bold p-2.5 rounded-2xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                />
              </div>
            </div>

            {/* Fechas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Fecha de Emisión
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={issueDate}
                    onChange={(e) => setIssueDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                  />
                  <Calendar className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Vencimiento *
                  </label>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setDueDate(addDays(15))}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                    >
                      +15d
                    </button>
                    <button
                      type="button"
                      onClick={() => setDueDate(addDays(30))}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-300 cursor-pointer"
                    >
                      +30d
                    </button>
                  </div>
                </div>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                  />
                  <Calendar className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Switch Factura con IVA */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#382620]">
              <div>
                <span className="text-xs font-bold text-stone-800 dark:text-stone-200 block">
                  Documento Tributario
                </span>
                <span className="text-[11px] text-stone-400">
                  {hasInvoice ? 'Factura afecta (19% IVA Crédito Fiscal)' : 'Boleta o exento'}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasInvoice}
                  onChange={(e) => setHasInvoice(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-stone-200 peer-focus:outline-hidden rounded-full peer dark:bg-stone-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>

            {/* Notas */}
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Detalle o Glosa de Compra (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ej.: 10 sacos de harina especial + 5 cajas de manteca..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
              />
            </div>
      </form>
    </Modal>
  );
};
