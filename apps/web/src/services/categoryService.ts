import { apiFetch } from '../lib/api';
import type { Category, CategoryType } from '../types';

export const categoryService = {
  async getAll(type?: CategoryType): Promise<Category[]> {
    const query = type ? `?type=${type}` : '';
    return apiFetch<Category[]>(`/categories${query}`);
  },

  async create(data: Partial<Category>): Promise<Category> {
    return apiFetch<Category>('/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async update(id: string, data: Partial<Category>): Promise<Category> {
    return apiFetch<Category>(`/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(id: string): Promise<void> {
    return apiFetch<void>(`/categories/${id}`, {
      method: 'DELETE',
    });
  },
};
