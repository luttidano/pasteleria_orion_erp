import type { Product } from '../types';
import { apiFetch } from '../lib/api';

interface ApiIngredient {
  id: string;
  name: string;
  category: string;
  stock: number | string;
  minStock: number | string;
  unit: string;
  price?: number | string | null;
  icon?: string | null;
  imageUrl?: string | null;
  description?: string | null;
  status: 'suficiente' | 'bajo' | 'agotado';
  createdAt?: string;
  updatedAt?: string;
}

function mapApiToProduct(item: ApiIngredient): Product {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    stock: Number(item.stock),
    minStock: Number(item.minStock),
    unit: item.unit,
    price: item.price !== null && item.price !== undefined ? Number(item.price) : undefined,
    icon: item.icon || '📦',
    imageUrl: item.imageUrl || undefined,
    description: item.description || '',
    status: item.status,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const inventoryService = {
  /**
   * Obtiene todos los insumos desde el backend NestJS (GET /api/inventory)
   */
  async getProducts(): Promise<Product[]> {
    const data = await apiFetch<ApiIngredient[]>('/inventory');
    return data.map(mapApiToProduct);
  },

  /**
   * Registra un nuevo insumo (POST /api/inventory)
   */
  async addProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Product> {
    const data = await apiFetch<ApiIngredient>('/inventory', {
      method: 'POST',
      body: JSON.stringify({
        name: productData.name,
        category: productData.category,
        stock: productData.stock,
        minStock: productData.minStock,
        unit: productData.unit,
        price: productData.price ?? 0,
        icon: productData.icon,
        imageUrl: productData.imageUrl,
        description: productData.description,
      }),
    });
    return mapApiToProduct(data);
  },

  /**
   * Actualiza datos de un insumo existente (PATCH /api/inventory/:id)
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const data = await apiFetch<ApiIngredient>(`/inventory/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        ...(updates.name !== undefined && { name: updates.name }),
        ...(updates.category !== undefined && { category: updates.category }),
        ...(updates.stock !== undefined && { stock: updates.stock }),
        ...(updates.minStock !== undefined && { minStock: updates.minStock }),
        ...(updates.unit !== undefined && { unit: updates.unit }),
        ...(updates.price !== undefined && { price: updates.price }),
        ...(updates.icon !== undefined && { icon: updates.icon }),
        ...(updates.imageUrl !== undefined && { imageUrl: updates.imageUrl }),
        ...(updates.description !== undefined && { description: updates.description }),
      }),
    });
    return mapApiToProduct(data);
  },

  /**
   * Elimina un insumo (DELETE /api/inventory/:id)
   */
  async deleteProduct(id: string): Promise<boolean> {
    await apiFetch(`/inventory/${id}`, {
      method: 'DELETE',
    });
    return true;
  },

  /**
   * Ajuste rápido de stock / consumo (POST /api/inventory/:id/adjust-stock)
   */
  async adjustStock(id: string, delta: number): Promise<Product> {
    const data = await apiFetch<ApiIngredient>(`/inventory/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    });
    return mapApiToProduct(data);
  },

  /**
   * Registra una compra aumentando el stock disponible
   */
  async registerPurchase(id: string, amountBought: number): Promise<Product> {
    return this.adjustStock(id, amountBought);
  },
};
