import { apiFetch } from '../lib/api';
import type { Recipe } from '../types';

export const recipeService = {
  async getAll(): Promise<Recipe[]> {
    return apiFetch<Recipe[]>('/recipes');
  },

  async create(data: Partial<Recipe>): Promise<Recipe> {
    return apiFetch<Recipe>('/recipes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/recipes/${id}`, {
      method: 'DELETE',
    });
  },
};
