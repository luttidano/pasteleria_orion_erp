import { apiFetch } from '../lib/api';
import type {
  PurchasesBookResponse,
  SalesBookResponse,
  TaxPeriodQuery,
  VatSummaryResponse,
} from '../types';

export const taxService = {
  /**
   * Obtiene el resumen mensual de IVA, cálculo F29 y cuadratura contable.
   */
  async getVatSummary(query: TaxPeriodQuery): Promise<VatSummaryResponse> {
    const params = new URLSearchParams({
      year: String(query.year),
      month: String(query.month),
    });
    if (typeof query.previousRemanent === 'number') {
      params.append('previousRemanent', String(query.previousRemanent));
    }
    if (typeof query.ppmRate === 'number') {
      params.append('ppmRate', String(query.ppmRate));
    }
    return apiFetch<VatSummaryResponse>(
      `/accounting/tax/vat-summary?${params.toString()}`,
    );
  },

  /**
   * Obtiene el Libro de Ventas mensual con desglose de tickets, neto e IVA Débito.
   */
  async getSalesBook(query: {
    year: number;
    month: number;
  }): Promise<SalesBookResponse> {
    const params = new URLSearchParams({
      year: String(query.year),
      month: String(query.month),
    });
    return apiFetch<SalesBookResponse>(
      `/accounting/tax/sales-book?${params.toString()}`,
    );
  },

  /**
   * Obtiene el Libro de Compras mensual con desglose de facturas, proveedores, neto e IVA Crédito.
   */
  async getPurchasesBook(query: {
    year: number;
    month: number;
  }): Promise<PurchasesBookResponse> {
    const params = new URLSearchParams({
      year: String(query.year),
      month: String(query.month),
    });
    return apiFetch<PurchasesBookResponse>(
      `/accounting/tax/purchases-book?${params.toString()}`,
    );
  },
};
