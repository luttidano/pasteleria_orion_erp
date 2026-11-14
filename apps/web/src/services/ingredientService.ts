import type { AdjustStockPayload, Ingredient } from '../types';
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
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type IngredientAdjustmentResult = Ingredient & {
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
};

function mapApiToIngredient(item: ApiIngredient): IngredientAdjustmentResult {
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
    ...(item.accountingStatus ? { accountingStatus: item.accountingStatus } : {}),
    ...(item.accountingWarning !== undefined
      ? { accountingWarning: item.accountingWarning }
      : {}),
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export const ingredientService = {
  /**
   * Obtiene todos los insumos exclusivamente desde el backend NestJS (GET /api/ingredients).
   */
  async getIngredients(): Promise<Ingredient[]> {
    const data = await apiFetch<ApiIngredient[]>('/ingredients');
    return data.map(mapApiToIngredient);
  },

  /**
   * Registra un nuevo insumo (POST /api/ingredients).
   */
  async addIngredient(
    ingredientData: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Ingredient> {
    const data = await apiFetch<ApiIngredient>('/ingredients', {
      method: 'POST',
      body: JSON.stringify({
        name: ingredientData.name,
        category: ingredientData.category,
        stock: ingredientData.stock,
        minStock: ingredientData.minStock,
        unit: ingredientData.unit,
        price: ingredientData.price ?? 0,
        icon: ingredientData.icon,
        imageUrl: ingredientData.imageUrl,
        description: ingredientData.description,
      }),
    });
    return mapApiToIngredient(data);
  },

  /**
   * Actualiza datos de un insumo existente (PATCH /api/ingredients/:id).
   */
  async updateIngredient(id: string, updates: Partial<Ingredient>): Promise<Ingredient> {
    const data = await apiFetch<ApiIngredient>(`/ingredients/${id}`, {
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
    return mapApiToIngredient(data);
  },

  /**
   * Elimina un insumo (DELETE /api/ingredients/:id).
   */
  async deleteIngredient(id: string): Promise<boolean> {
    await apiFetch(`/ingredients/${id}`, {
      method: 'DELETE',
    });
    return true;
  },

  /**
   * Ajuste rápido de stock / consumo / compra (POST /api/ingredients/:id/adjust-stock).
   */
  async adjustStock(
    id: string,
    input: number | AdjustStockPayload,
  ): Promise<IngredientAdjustmentResult> {
    const body = typeof input === 'number' ? { delta: input } : input;
    const data = await apiFetch<ApiIngredient>(`/ingredients/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return mapApiToIngredient(data);
  },

  /**
   * Registra una compra aumentando el stock disponible y contabilizando el ingreso.
   */
  async registerPurchase(
    id: string,
    amountBought: number,
    options?: Omit<AdjustStockPayload, 'delta' | 'reasonType'>,
  ): Promise<IngredientAdjustmentResult> {
    return this.adjustStock(id, {
      delta: amountBought,
      reasonType: 'purchase',
      ...options,
    });
  },
};
