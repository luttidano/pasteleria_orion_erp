import React, { useState, useRef } from 'react';
import {
  CreditCard,
  Building2,
  Calendar,
  AlertCircle,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';
import { createIdempotencyKey } from '../../../lib/api';
import { Modal } from '../../common/Modal';
import type { SupplierInvoice, SupplierPaymentMethod } from '../../../types';
import { formatMoney } from '../../../utils/formatters';

interface RecordPaymentModalProps {
  isOpen: boolean;
  invoice: SupplierInvoice | null;
  onClose: () => void;
  onConfirm: (
    invoiceId: string,
    payload: {
      amount: number;
      paymentMethod: SupplierPaymentMethod;
      paymentDate?: string;
      reference?: string;
      notes?: string;
    },
    idempotencyKey?: string,
  ) => Promise<void>;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  isOpen,
  invoice,
  onClose,
  onConfirm,
}) => {
  if (!isOpen || !invoice) return null;

  return (
    <RecordPaymentModalContent
      invoice={invoice}
      onClose={onClose}
      onConfirm={onConfirm}
    />
  );
};

interface ContentProps {
  invoice: SupplierInvoice;
  onClose: () => void;
  onConfirm: RecordPaymentModalProps['onConfirm'];
}

const RecordPaymentModalContent: React.FC<ContentProps> = ({
  invoice,
  onClose,
  onConfirm,
}) => {
  const [amount, setAmount] = useState<number>(invoice.remainingAmount);
  const [paymentMethod, setPaymentMethod] =
    useState<SupplierPaymentMethod>('transferencia');
  const [paymentDate, setPaymentDate] = useState<string>(
    new Date().toISOString().slice(0, 10),
  );
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (amount <= 0) {
      setError('El monto a pagar debe ser mayor a 0.');
      return;
    }

    if (amount > invoice.remainingAmount) {
      setError(
        `El monto ($${amount.toLocaleString('es-CL')}) no puede superar el saldo pendiente ($${invoice.remainingAmount.toLocaleString('es-CL')}).`,
      );
      return;
    }

    try {
      setIsSubmitting(true);
      const idempotencyKey = idempotencyKeyRef.current ?? createIdempotencyKey();
      idempotencyKeyRef.current = idempotencyKey;

      await onConfirm(
        invoice.id,
        {
          amount,
          paymentMethod,
          paymentDate,
          reference: reference.trim() || undefined,
          notes: notes.trim() || undefined,
        },
        idempotencyKey,
      );
      idempotencyKeyRef.current = null;
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error registrando el pago.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFullPayment = amount === invoice.remainingAmount;

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeDisabled={isSubmitting}
      title="Registrar Pago a Proveedor"
      subtitle={`${invoice.supplier?.name ?? ''} • Fac #${invoice.invoiceNumber}`}
      icon={<CreditCard className="w-5 h-5" />}
      iconWrapperClassName="bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-stone-500">
            <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Generará asiento contable (Debe 2.1.01.01 / Haber{' '}
              {paymentMethod === 'efectivo' ? '1.1.01.01' : '1.1.01.02'})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
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
              form="record-payment-form"
              disabled={isSubmitting || amount <= 0}
              className="px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md disabled:opacity-50 cursor-pointer flex items-center gap-2"
            >
              {isSubmitting ? 'Procesando...' : `Confirmar Pago (${formatMoney(amount)})`}
            </button>
          </div>
        </div>
      }
    >
      {/* Resumen Deuda */}
      <div className="grid grid-cols-3 gap-2.5 p-3.5 rounded-2xl bg-[#FAF5ED] dark:bg-[#201612] border border-[#EADBCE] dark:border-[#382620]">
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase block">
                Total Factura
              </span>
              <span className="text-sm font-mono font-bold text-stone-800 dark:text-stone-200">
                {formatMoney(invoice.totalAmount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-stone-400 uppercase block">
                Abonado
              </span>
              <span className="text-sm font-mono font-bold text-emerald-600 dark:text-emerald-400">
                {formatMoney(invoice.paidAmount)}
              </span>
            </div>
            <div>
              <span className="text-[10px] font-bold text-rose-500 uppercase block">
                Saldo Pendiente
              </span>
              <span className="text-base font-mono font-black text-rose-700 dark:text-rose-400">
                {formatMoney(invoice.remainingAmount)}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/40 text-xs text-rose-700 dark:text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form id="record-payment-form" onSubmit={handleSubmit} className="space-y-4">
            {/* Monto a pagar */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300">
                  Monto del Pago / Abono ($) *
                </label>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAmount(Math.round(invoice.remainingAmount / 2))}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 cursor-pointer"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => setAmount(invoice.remainingAmount)}
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 cursor-pointer"
                  >
                    Saldar Total
                  </button>
                </div>
              </div>
              <input
                type="number"
                min="1"
                max={invoice.remainingAmount}
                step="1"
                required
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full text-lg font-mono font-bold p-3 rounded-2xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E] text-stone-900 dark:text-white"
              />
              <p className="text-[11px] text-stone-400 mt-1">
                {isFullPayment ? (
                  <span className="text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> La factura quedará 100% saldada.
                  </span>
                ) : (
                  <span>
                    Quedará un saldo de{' '}
                    <b>{formatMoney(Math.max(0, invoice.remainingAmount - amount))}</b>
                  </span>
                )}
              </p>
            </div>

            {/* Método de Pago */}
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1.5">
                Cuenta de Origen del Dinero *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('transferencia')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer flex items-center gap-2.5 transition-all ${
                    paymentMethod === 'transferencia'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'border-stone-200 dark:border-[#35251F] text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0 text-emerald-600" />
                  <div>
                    <span className="text-xs block">Banco / Transferencia</span>
                    <span className="text-[10px] text-stone-400 font-mono">Cuenta 1.1.01.02</span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('efectivo')}
                  className={`p-3 rounded-2xl border text-left cursor-pointer flex items-center gap-2.5 transition-all ${
                    paymentMethod === 'efectivo'
                      ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-300 font-bold'
                      : 'border-stone-200 dark:border-[#35251F] text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <CreditCard className="w-4 h-4 shrink-0 text-emerald-600" />
                  <div>
                    <span className="text-xs block">Caja General Efectivo</span>
                    <span className="text-[10px] text-stone-400 font-mono">Cuenta 1.1.01.01</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Fecha y Referencia */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  Fecha del Pago
                </label>
                <div className="relative">
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                  />
                  <Calendar className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-3 pointer-events-none" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                  N° Comprobante / Transf.
                </label>
                <input
                  type="text"
                  placeholder="Ej.: Transf. 98402"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
                />
              </div>
            </div>

            {/* Notas opcionales */}
            <div>
              <label className="text-xs font-bold text-stone-700 dark:text-stone-300 block mb-1">
                Notas u Observaciones (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Ej.: Pago acordado de la primera cuota..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-stone-200 dark:border-[#35251F] bg-white dark:bg-[#16100E]"
              />
            </div>
      </form>
    </Modal>
  );
};
