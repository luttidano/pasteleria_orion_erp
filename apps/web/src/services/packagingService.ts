import { apiFetch } from '../lib/api';
import type { Packaging } from '../types';

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
    return apiFetch<Packaging>(`/packaging/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  /**
   * Ajuste de stock rápido (+ / -)
   */
  async adjustStock(id: string, delta: number): Promise<Packaging> {
    return apiFetch<Packaging>(`/packaging/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
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
