import { apiFetch } from '../lib/api';
import type { CreatePosSaleData, PosSaleRecord } from '../types';

export const posSaleService = {
  async getSales(): Promise<PosSaleRecord[]> {
    return apiFetch<PosSaleRecord[]>('/pos/sales');
  },

  async createSale(
    data: CreatePosSaleData,
    idempotencyKey?: string,
  ): Promise<PosSaleRecord> {
    return apiFetch<PosSaleRecord>('/pos/sales', {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data),
    });
  },
};

