import { apiFetch } from '../lib/api';
import type {
  AdjustStockPayload,
  GeneralSupply,
  SaveGeneralSupplyPayload,
} from '../types';

export type { SaveGeneralSupplyPayload };

export type GeneralSupplyAdjustmentResult = GeneralSupply & {
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
};

export const generalSupplyService = {
  /**
   * Obtiene todos los insumos generales (filtro opcional por categoría)
   */
  async getAll(category?: string): Promise<GeneralSupply[]> {
    const query =
      category && category !== 'all'
        ? `?category=${encodeURIComponent(category)}`
        : '';
    return apiFetch<GeneralSupply[]>(`/general-supplies${query}`);
  },

  /**
   * Obtiene un insumo general específico por ID
   */
  async getById(id: string): Promise<GeneralSupply> {
    return apiFetch<GeneralSupply>(`/general-supplies/${id}`);
  },

  /**
   * Registra un nuevo insumo general
   */
  async create(data: SaveGeneralSupplyPayload): Promise<GeneralSupply> {
    return apiFetch<GeneralSupply>('/general-supplies', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Actualiza los datos de un insumo general
   */
  async update(
    id: string,
    data: Partial<SaveGeneralSupplyPayload>,
  ): Promise<GeneralSupply> {
    const { stock: _stock, ...updatePayload } = data;
    return apiFetch<GeneralSupply>(`/general-supplies/${id}`, {
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
    reason?: string,
    idempotencyKey?: string,
  ): Promise<GeneralSupplyAdjustmentResult> {
    const body =
      typeof input === 'number'
        ? { delta: input, ...(reason ? { reason } : {}) }
        : input;
    return apiFetch<GeneralSupplyAdjustmentResult>(
      `/general-supplies/${id}/adjust-stock`,
      {
        method: 'POST',
        headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        body: JSON.stringify(body),
      },
    );
  },

  /**
   * Elimina un insumo general del inventario
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    return apiFetch<{ success: boolean; message: string }>(
      `/general-supplies/${id}`,
      {
        method: 'DELETE',
      },
    );
  },
};

