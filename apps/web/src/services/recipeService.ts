import { apiFetch } from '../lib/api';
import type { Recipe, ProduceRecipeData, ProductionResult } from '../types';

export const recipeService = {
  /**
   * Obtiene todas las recetas de pastelería vía API NestJS.
   */
  async getAll(): Promise<Recipe[]> {
    return await apiFetch<Recipe[]>('/recipes');
  },

  /**
   * Crea una nueva receta vía API NestJS.
   */
  async create(data: Partial<Recipe>): Promise<Recipe> {
    return await apiFetch<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  /**
   * Elimina una receta vía API NestJS.
   */
  async delete(id: string): Promise<void> {
    return await apiFetch<void>(`/recipes/${id}`, {
      method: 'DELETE',
    });
  },

  /**
   * Orden de producción: hornea/produce una cantidad de tandas de la receta.
   */
  async produce(
    id: string,
    data: ProduceRecipeData,
    idempotencyKey?: string,
  ): Promise<ProductionResult> {
    return await apiFetch<ProductionResult>(`/recipes/${id}/produce`, {
      method: 'POST',
      headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
      body: JSON.stringify(data),
    });
  },
};
