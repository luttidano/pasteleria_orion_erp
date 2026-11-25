import { apiFetch } from '../lib/api';
import type { AdjustStockPayload, Packaging } from '../types';

export type PackagingAdjustmentResult = Packaging & {
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
};

export const packagingService = {
  /**
   * Obtiene todos los empaques y envases (filtro opcional por tipo)
   */
  async getAll(type?: string): Promise<Packaging[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    return apiFetch<Packaging[]>(`/packaging${query}`);
  },

  /**
   * Obtiene un empaque específico por ID
   */
  async getById(id: string): Promise<Packaging> {
    return apiFetch<Packaging>(`/packaging/${id}`);
  },

  /**
   * Registra un nuevo empaque o envase
   */
  async create(data: Partial<Packaging>): Promise<Packaging> {
    return apiFetch<Packaging>('/packaging', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Actualiza los datos de un empaque
   */
  async update(id: string, data: Partial<Packaging>): Promise<Packaging> {
    const { stock: _stock, ...updatePayload } = data;
    return apiFetch<Packaging>(`/packaging/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
    });
  },

  /**
   * Ajuste de stock rápido (+ / -)
   */
  async adjustStock(
    id: string,
    input: number | AdjustStockPayload,
    idempotencyKey?: string,
  ): Promise<PackagingAdjustmentResult> {
    const body = typeof input === 'number' ? { delta: input } : input;
    return apiFetch<PackagingAdjustmentResult>(`/packaging/${id}/adjust-stock`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(body),
    });
  },

  /**
   * Elimina un empaque del catálogo
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(`/packaging/${id}`, {
      method: 'DELETE',
    });
  },
};
