import { apiFetch } from '../lib/api';
import type {
  AccountsPayableSummary,
  CreateSupplierInvoicePayload,
  RecordSupplierPaymentPayload,
  SupplierInvoice,
} from '../types';

export interface QuerySupplierInvoicesParams {
  supplierId?: string;
  status?: string;
  search?: string;
}

export const purchaseService = {
  /**
   * Obtiene el resumen de cuentas por pagar (métricas y vencimientos)
   */
  async getSummary(): Promise<AccountsPayableSummary> {
    return apiFetch<AccountsPayableSummary>('/purchases/summary');
  },

  /**
   * Obtiene la lista de facturas de proveedores
   */
  async getInvoices(
    params?: QuerySupplierInvoicesParams,
  ): Promise<SupplierInvoice[]> {
    const searchParams = new URLSearchParams();
    if (params?.supplierId) searchParams.set('supplierId', params.supplierId);
    if (params?.status && params.status !== 'all')
      searchParams.set('status', params.status);
    if (params?.search?.trim()) searchParams.set('search', params.search.trim());

    const queryString = searchParams.toString();
    const url = queryString
      ? `/purchases/invoices?${queryString}`
      : '/purchases/invoices';

    return apiFetch<SupplierInvoice[]>(url);
  },

  /**
   * Registra una nueva factura de proveedor
   */
  async createInvoice(
    payload: CreateSupplierInvoicePayload,
    idempotencyKey?: string,
  ): Promise<SupplierInvoice> {
    return apiFetch<SupplierInvoice>('/purchases/invoices', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
  },

  /**
   * Registra un pago o abono a una factura
   */
  async recordPayment(
    invoiceId: string,
    payload: RecordSupplierPaymentPayload,
    idempotencyKey?: string,
  ): Promise<{
    success: boolean;
    payment: any;
    invoice: { id: string; paidAmount: number; remainingAmount: number; status: string };
  }> {
    return apiFetch(`/purchases/invoices/${invoiceId}/payments`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(payload),
    });
  },

  /**
   * Anula una factura (solo si no tiene pagos registrados)
   */
  async voidInvoice(
    invoiceId: string,
    idempotencyKey?: string,
  ): Promise<{ success: boolean; invoiceId: string; status: string }> {
    return apiFetch(`/purchases/invoices/${invoiceId}`, {
      method: 'DELETE',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
    });
  },
};
