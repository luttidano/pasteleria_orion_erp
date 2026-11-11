import { apiFetch } from '../lib/api';
import type { GeneralSupply } from '../types';

export interface SaveGeneralSupplyPayload {
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit?: string;
  costPrice?: number;
  supplierId?: string | null;
  icon?: string;
  description?: string | null;
}

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
    return apiFetch<GeneralSupply>(`/general-supplies/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Ajuste de stock rápido (+ / -)
   */
  async adjustStock(
    id: string,
    delta: number,
    reason?: string,
  ): Promise<GeneralSupply> {
    return apiFetch<GeneralSupply>(`/general-supplies/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({
        delta,
        ...(reason ? { reason } : {}),
      }),
    });
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

