import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Recipe } from '../types';

function mapSupabaseRecipe(row: any): Recipe {
  const ingredients = (row.ingredients || []).map((ri: any) => ({
    id: ri.id,
    ingredientId: ri.ingredient_id || ri.ingredientId,
    ingredientName: ri.ingredients?.name || ri.ingredient?.name || 'Insumo',
    quantity: Number(ri.quantity),
    unit: ri.unit || 'g',
    availableStock: ri.ingredients?.stock !== undefined ? Number(ri.ingredients.stock) : undefined,
  }));

  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    yieldServings: Number(row.yield_servings ?? row.yieldServings ?? 1),
    category: row.categoryRef?.name || row.category || 'Pastelería',
    imageUrl: row.image_url || row.imageUrl || undefined,
    ingredients,
    canProduce: true,
    maxBatches: 1,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export const recipeService = {
  /**
   * Obtiene todas las recetas de pastelería con recuperación transparente ante fallas de red
   */
  async getAll(): Promise<Recipe[]> {
    try {
      return await apiFetch<Recipe[]>('/recipes');
    } catch (err) {
      console.warn('[recipeService] API backend demoró o falló. Intentando fallback Supabase:', err);
      if (supabase) {
        const { data, error } = await supabase
          .from('recipe')
          .select('*, categoryRef:category(*), ingredients:recipe_ingredient(*, ingredients:ingredient(*))')
          .order('name', { ascending: true });

        if (!error && Array.isArray(data)) {
          return data.map(mapSupabaseRecipe);
        }
      }
      throw err;
    }
  },

  async create(data: Partial<Recipe>): Promise<Recipe> {
    try {
      return await apiFetch<Recipe>('/recipes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (supabase) {
        const { data: inserted, error } = await supabase
          .from('recipe')
          .insert({
            name: data.name,
            description: data.description,
            yield_servings: data.yieldServings || 1,
            image_url: data.imageUrl,
          })
          .select()
          .single();

        if (!error && inserted) {
          return mapSupabaseRecipe(inserted);
        }
      }
      throw err;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      return await apiFetch<void>(`/recipes/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      if (supabase) {
        const { error } = await supabase.from('recipe').delete().eq('id', id);
        if (!error) return;
      }
      throw err;
    }
  },
};
