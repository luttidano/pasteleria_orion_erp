import { useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../lib/queryClient';
import {
  purchaseService,
  type QuerySupplierInvoicesParams,
} from '../../services/purchaseService';
import type {
  CreateSupplierInvoicePayload,
  RecordSupplierPaymentPayload,
} from '../../types';

export function usePurchasesSummaryQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.purchasesSummary(),
    queryFn: () => purchaseService.getSummary(),
    enabled,
  });
}

export function usePurchasesInvoicesQuery(
  params: QuerySupplierInvoicesParams,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.purchasesInvoices(params),
    queryFn: () => purchaseService.getInvoices(params),
    enabled,
  });
}

export function useInvalidatePurchases() {
  const client = useQueryClient();

  return useCallback(async () => {
    await client.invalidateQueries({ queryKey: queryKeys.purchases });
  }, [client]);
}

export function useCreateInvoiceMutation() {
  const invalidatePurchases = useInvalidatePurchases();

  return useMutation({
    mutationFn: ({
      payload,
      idempotencyKey,
    }: {
      payload: CreateSupplierInvoicePayload;
      idempotencyKey?: string;
    }) => purchaseService.createInvoice(payload, idempotencyKey),
    onSuccess: async () => {
      await invalidatePurchases();
    },
  });
}

export function useRecordPaymentMutation() {
  const invalidatePurchases = useInvalidatePurchases();

  return useMutation({
    mutationFn: ({
      invoiceId,
      payload,
      idempotencyKey,
    }: {
      invoiceId: string;
      payload: RecordSupplierPaymentPayload;
      idempotencyKey?: string;
    }) => purchaseService.recordPayment(invoiceId, payload, idempotencyKey),
    onSuccess: async () => {
      await invalidatePurchases();
    },
  });
}

export function useVoidInvoiceMutation() {
  const invalidatePurchases = useInvalidatePurchases();

  return useMutation({
    mutationFn: ({
      invoiceId,
      idempotencyKey,
    }: {
      invoiceId: string;
      idempotencyKey?: string;
    }) => purchaseService.voidInvoice(invoiceId, idempotencyKey),
    onSuccess: async () => {
      await invalidatePurchases();
    },
  });
}
