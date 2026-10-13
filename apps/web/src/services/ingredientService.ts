import type { Ingredient } from '../types';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';

const CACHE_KEY = 'pasteleria_orion_ingredients_cache';

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

function mapApiToIngredient(item: ApiIngredient): Ingredient {
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

export const ingredientService = {
  /**
   * Obtiene la caché local de ingredientes
   */
  getCachedIngredients(): Ingredient[] {
    try {
      const data = localStorage.getItem(CACHE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignorar fallo de lectura de caché
    }
    return [];
  },

  /**
   * Guarda los ingredientes en caché local
   */
  setCachedIngredients(ingredients: Ingredient[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(ingredients));
    } catch {
      // Ignorar fallo de escritura de caché
    }
  },

  /**
   * Obtiene todos los insumos desde el backend NestJS (GET /api/ingredients)
   * con recuperación transparente vía Supabase REST directo y caché local ante desconexión
   */
  async getIngredients(): Promise<Ingredient[]> {
    // 1. Intentar backend NestJS
    try {
      const data = await apiFetch<ApiIngredient[]>('/ingredients');
      const ingredients = data.map(mapApiToIngredient);
      this.setCachedIngredients(ingredients);
      return ingredients;
    } catch (err) {
      console.warn('[ingredientService] API backend demoró o falló. Intentando fallback Supabase directo:', err);

      // 2. Fallback directo a Supabase vía HTTPS desde el navegador
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('ingredient')
            .select('*, categoryRef:category(*)')
            .order('name', { ascending: true });

          if (!error && Array.isArray(data) && data.length > 0) {
            const ingredients: Ingredient[] = data.map((row: any) => {
              const stock = Number(row.stock);
              const minStock = Number(row.min_stock ?? row.minStock ?? 0);
              const status: 'suficiente' | 'bajo' | 'agotado' =
                stock <= 0 ? 'agotado' : stock <= minStock ? 'bajo' : 'suficiente';

              return {
                id: row.id,
                name: row.name,
                category: row.categoryRef?.name || row.category || 'General',
                stock,
                minStock,
                unit: row.unit || 'kg',
                price: row.price !== null && row.price !== undefined ? Number(row.price) : undefined,
                icon: row.icon || '📦',
                imageUrl: row.image_url || row.imageUrl || undefined,
                description: row.description || '',
                status,
                createdAt: row.created_at || row.createdAt,
                updatedAt: row.updated_at || row.updatedAt,
              };
            });

            this.setCachedIngredients(ingredients);
            return ingredients;
          }
        } catch (sbErr) {
          console.warn('[ingredientService] Fallback Supabase directo arrojó error:', sbErr);
        }
      }

      // 3. Fallback a caché local persistente
      const cached = this.getCachedIngredients();
      if (cached.length > 0) {
        console.warn('[ingredientService] Mostrando catálogo desde caché local resiliente');
        return cached;
      }
      throw err;
    }
  },

  /**
   * Registra un nuevo insumo (POST /api/ingredients)
   */
  async addIngredient(
    ingredientData: Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Ingredient> {
    try {
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
      const ingredient = mapApiToIngredient(data);
      const cached = this.getCachedIngredients();
      this.setCachedIngredients([ingredient, ...cached]);
      return ingredient;
    } catch (err) {
      // Fallback local si no hay conexión al backend
      const fallbackIngredient: Ingredient = {
        ...ingredientData,
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'ing-' + Date.now(),
        status: (ingredientData.stock <= 0) ? 'agotado' : (ingredientData.stock <= ingredientData.minStock) ? 'bajo' : 'suficiente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const cached = this.getCachedIngredients();
      this.setCachedIngredients([fallbackIngredient, ...cached]);
      throw err;
    }
  },

  /**
   * Actualiza datos de un insumo existente (PATCH /api/ingredients/:id)
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
    const ingredient = mapApiToIngredient(data);
    const cached = this.getCachedIngredients();
    const idx = cached.findIndex((p) => p.id === id);
    if (idx !== -1) {
      cached[idx] = ingredient;
      this.setCachedIngredients(cached);
    }
    return ingredient;
  },

  /**
   * Elimina un insumo (DELETE /api/ingredients/:id)
   */
  async deleteIngredient(id: string): Promise<boolean> {
    await apiFetch(`/ingredients/${id}`, {
      method: 'DELETE',
    });
    const cached = this.getCachedIngredients();
    this.setCachedIngredients(cached.filter((p) => p.id !== id));
    return true;
  },

  /**
   * Ajuste rápido de stock / consumo (POST /api/ingredients/:id/adjust-stock)
   */
  async adjustStock(id: string, delta: number): Promise<Ingredient> {
    const data = await apiFetch<ApiIngredient>(`/ingredients/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    });
    const ingredient = mapApiToIngredient(data);
    const cached = this.getCachedIngredients();
    const idx = cached.findIndex((p) => p.id === id);
    if (idx !== -1) {
      cached[idx] = ingredient;
      this.setCachedIngredients(cached);
    }
    return ingredient;
  },

  /**
   * Registra una compra aumentando el stock disponible
   */
  async registerPurchase(id: string, amountBought: number): Promise<Ingredient> {
    return this.adjustStock(id, amountBought);
  },
};
