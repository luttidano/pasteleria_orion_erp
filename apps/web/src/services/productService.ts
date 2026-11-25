import { apiFetch } from '../lib/api';
import type { AdjustStockPayload, CatalogProduct, ProductKind } from '../types';

export type ProductAdjustmentResult = CatalogProduct & {
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
};

export const productService = {
  /**
   * Obtiene todos los productos comerciales (elaborados o de reventa) vía API NestJS.
   */
  async getAll(type?: ProductKind): Promise<CatalogProduct[]> {
    const query = type ? `?type=${type}` : '';
    return await apiFetch<CatalogProduct[]>(`/products${query}`);
  },

  /**
   * Obtiene un producto por su identificador vía API NestJS.
   */
  async getById(id: string): Promise<CatalogProduct> {
    return await apiFetch<CatalogProduct>(`/products/${id}`);
  },

  /**
   * Registra un nuevo producto comercial en catálogo vía API NestJS.
   */
  async create(data: Partial<CatalogProduct>): Promise<CatalogProduct> {
    return await apiFetch<CatalogProduct>('/products', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Actualiza los datos de un producto comercial vía API NestJS.
   */
  async update(id: string, data: Partial<CatalogProduct>): Promise<CatalogProduct> {
    const { stock: _stock, ...updatePayload } = data;
    return await apiFetch<CatalogProduct>(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updatePayload),
    });
  },

  /**
   * Elimina un producto comercial vía API NestJS.
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    return await apiFetch<{ success: boolean; id: string }>(`/products/${id}`, {
      method: 'DELETE',
    });
  },

  async adjustStock(
    id: string,
    input: number | AdjustStockPayload,
    idempotencyKey?: string,
  ): Promise<ProductAdjustmentResult> {
    const body = typeof input === 'number' ? { delta: input } : input;
    return await apiFetch<ProductAdjustmentResult>(`/products/${id}/adjust-stock`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(body),
    });
  },
};
