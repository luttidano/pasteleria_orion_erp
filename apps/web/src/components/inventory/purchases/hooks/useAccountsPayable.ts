import { useCallback, useEffect, useState } from 'react';
import type {
  CreateSupplierInvoicePayload,
  RecordSupplierPaymentPayload,
  SupplierInvoice,
  User,
} from '../../../../types';
import {
  useCreateInvoiceMutation,
  useInvalidatePurchases,
  usePurchasesInvoicesQuery,
  usePurchasesSummaryQuery,
  useRecordPaymentMutation,
  useVoidInvoiceMutation,
} from '../../../../hooks/queries/usePurchasesQueries';
import { formatMoney } from '../../../../utils/formatters';

interface UseAccountsPayableParams {
  user: User;
  onToast: (toast: {
    type: 'success' | 'error' | 'warning' | 'info';
    title: string;
    message?: string;
  }) => void;
}

/**
 * Hook de estado, caché React Query y mutaciones idempotentes para Cuentas por Pagar.
 */
export function useAccountsPayable({ user, onToast }: UseAccountsPayableParams) {
  const [search, setSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [paymentModalInvoice, setPaymentModalInvoice] =
    useState<SupplierInvoice | null>(null);

  const isAdmin = user.role === 'admin';

  const {
    data: invoices = [],
    isLoading: isInvoicesLoading,
    isFetching: isInvoicesFetching,
    error: invoicesError,
  } = usePurchasesInvoicesQuery({ status: statusFilter, search });
  const {
    data: summary,
    isLoading: isSummaryLoading,
    error: summaryError,
  } = usePurchasesSummaryQuery();

  const invalidatePurchases = useInvalidatePurchases();
  const createInvoiceMutation = useCreateInvoiceMutation();
  const recordPaymentMutation = useRecordPaymentMutation();
  const voidInvoiceMutation = useVoidInvoiceMutation();

  useEffect(() => {
    const err = invoicesError ?? summaryError;
    if (err) {
      onToast({
        type: 'error',
        title: 'Error cargando cuentas por pagar',
        message:
          err instanceof Error
            ? err.message
            : 'No se pudieron obtener las facturas de proveedores.',
      });
    }
  }, [invoicesError, summaryError, onToast]);

  const handleCreateInvoice = useCallback(
    async (payload: CreateSupplierInvoicePayload, idempotencyKey?: string) => {
      await createInvoiceMutation.mutateAsync({ payload, idempotencyKey });
      onToast({
        type: 'success',
        title: 'Factura registrada',
        message: `Se guardó la factura #${payload.invoiceNumber} por pagar.`,
      });
    },
    [createInvoiceMutation, onToast],
  );

  const handleRecordPayment = useCallback(
    async (
      invoiceId: string,
      payload: RecordSupplierPaymentPayload,
      idempotencyKey?: string,
    ) => {
      await recordPaymentMutation.mutateAsync({
        invoiceId,
        payload,
        idempotencyKey,
      });
      onToast({
        type: 'success',
        title: 'Pago registrado exitosamente',
        message: `Abono de ${formatMoney(payload.amount)} contabilizado correctamente.`,
      });
    },
    [recordPaymentMutation, onToast],
  );

  const handleVoidInvoice = useCallback(
    async (invoice: SupplierInvoice) => {
      if (
        !window.confirm(
          `¿Estás seguro de anular la factura #${invoice.invoiceNumber}?`,
        )
      ) {
        return;
      }

      try {
        await voidInvoiceMutation.mutateAsync({ invoiceId: invoice.id });
        onToast({
          type: 'info',
          title: 'Factura anulada',
          message: `La factura #${invoice.invoiceNumber} ha sido anulada.`,
        });
      } catch (err: unknown) {
        onToast({
          type: 'error',
          title: 'No se pudo anular la factura',
          message:
            err instanceof Error
              ? err.message
              : 'Error al procesar la anulación.',
        });
      }
    },
    [voidInvoiceMutation, onToast],
  );

  return {
    invoices,
    summary: summary ?? null,
    isLoading: isInvoicesLoading || isSummaryLoading,
    isRefreshing: isInvoicesFetching,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    expandedInvoiceId,
    setExpandedInvoiceId,
    isCreateModalOpen,
    setIsCreateModalOpen,
    paymentModalInvoice,
    setPaymentModalInvoice,
    isAdmin,
    refreshData: invalidatePurchases,
    handleCreateInvoice,
    handleRecordPayment,
    handleVoidInvoice,
  };
}
