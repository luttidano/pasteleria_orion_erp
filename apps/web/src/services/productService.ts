import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { CatalogProduct, ProductKind } from '../types';

function mapRowToProduct(row: any): CatalogProduct {
  const stock = Number(row.stock);
  const minStock = Number(row.min_stock ?? row.minStock ?? 0);
  const status = stock <= 0 ? 'agotado' : stock <= minStock ? 'bajo' : 'suficiente';

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    productType: row.product_type || row.productType,
    stock,
    minStock,
    unit: row.unit || 'un',
    salePrice: Number(row.sale_price ?? row.salePrice ?? 0),
    costPrice:
      row.cost_price !== null && row.cost_price !== undefined
        ? Number(row.cost_price)
        : row.costPrice
          ? Number(row.costPrice)
          : 0,
    recipeId: row.recipe_id || row.recipeId,
    recipeName: row.recipe?.name,
    supplierId: row.supplier_id || row.supplierId,
    supplierName: row.supplier?.name,
    categoryId: row.category_id || row.categoryId,
    categoryName: row.categoryRef?.name,
    imageUrl: row.image_url || row.imageUrl,
    icon: row.icon || '🧁',
    status,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export const productService = {
  /**
   * Obtiene todos los productos comerciales (elaborados o de reventa)
   */
  async getAll(type?: ProductKind): Promise<CatalogProduct[]> {
    // 1. Intentar backend NestJS
    try {
      const query = type ? `?type=${type}` : '';
      return await apiFetch<CatalogProduct[]>(`/products${query}`);
    } catch (err) {
      console.warn('[productService] API NestJS demoró o falló. Intentando fallback Supabase:', err);

      // 2. Fallback resiliente directo a Supabase
      if (supabase) {
        let query = supabase
          .from('product')
          .select('*, recipe:recipe(*), supplier:suppliers(*), categoryRef:category(*)')
          .order('name', { ascending: true });

        if (type) {
          query = query.eq('product_type', type);
        }

        const { data, error } = await query;
        if (!error && Array.isArray(data)) {
          return data.map(mapRowToProduct);
        }
      }
      throw err;
    }
  },

  /**
   * Obtiene un producto por su identificador
   */
  async getById(id: string): Promise<CatalogProduct> {
    try {
      return await apiFetch<CatalogProduct>(`/products/${id}`);
    } catch {
      if (supabase) {
        const { data } = await supabase
          .from('product')
          .select('*, recipe:recipe(*), supplier:suppliers(*), categoryRef:category(*)')
          .eq('id', id)
          .maybeSingle();
        if (data) return mapRowToProduct(data);
      }
      throw new Error(`Producto ${id} no encontrado`);
    }
  },

  /**
   * Registra un nuevo producto comercial en catálogo
   */
  async create(data: Partial<CatalogProduct>): Promise<CatalogProduct> {
    try {
      return await apiFetch<CatalogProduct>('/products', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch {
      if (supabase) {
        const { data: inserted, error } = await supabase
          .from('product')
          .insert({
            name: data.name,
            product_type: data.productType,
            stock: data.stock,
            min_stock: data.minStock,
            unit: data.unit,
            sale_price: data.salePrice,
            cost_price: data.costPrice ?? 0,
            recipe_id: data.recipeId || null,
            supplier_id: data.supplierId || null,
            category_id: data.categoryId || null,
            description: data.description,
            image_url: data.imageUrl,
            icon: data.icon || '🧁',
          })
          .select('*, recipe:recipe(*), supplier:suppliers(*), categoryRef:category(*)')
          .single();

        if (!error && inserted) {
          return mapRowToProduct(inserted);
        }
      }
      throw new Error('Error al crear el producto.');
    }
  },

  /**
   * Actualiza los datos de un producto comercial
   */
  async update(id: string, data: Partial<CatalogProduct>): Promise<CatalogProduct> {
    try {
      return await apiFetch<CatalogProduct>(`/products/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    } catch {
      if (supabase) {
        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (data.name !== undefined) payload.name = data.name;
        if (data.productType !== undefined) payload.product_type = data.productType;
        if (data.stock !== undefined) payload.stock = data.stock;
        if (data.minStock !== undefined) payload.min_stock = data.minStock;
        if (data.unit !== undefined) payload.unit = data.unit;
        if (data.salePrice !== undefined) payload.sale_price = data.salePrice;
        if (data.costPrice !== undefined) payload.cost_price = data.costPrice;
        if (data.recipeId !== undefined) payload.recipe_id = data.recipeId || null;
        if (data.supplierId !== undefined) payload.supplier_id = data.supplierId || null;
        if (data.categoryId !== undefined) payload.category_id = data.categoryId || null;
        if (data.description !== undefined) payload.description = data.description;
        if (data.imageUrl !== undefined) payload.image_url = data.imageUrl;
        if (data.icon !== undefined) payload.icon = data.icon;

        const { data: updated, error } = await supabase
          .from('product')
          .update(payload)
          .eq('id', id)
          .select('*, recipe:recipe(*), supplier:suppliers(*), categoryRef:category(*)')
          .single();

        if (!error && updated) {
          return mapRowToProduct(updated);
        }
      }
      throw new Error('Error al actualizar el producto.');
    }
  },

  /**
   * Elimina un producto comercial
   */
  async delete(id: string): Promise<{ success: boolean; id: string }> {
    try {
      return await apiFetch<{ success: boolean; id: string }>(`/products/${id}`, {
        method: 'DELETE',
      });
    } catch {
      if (supabase) {
        const { error } = await supabase.from('product').delete().eq('id', id);
        if (!error) return { success: true, id };
      }
      throw new Error('Error al eliminar el producto.');
    }
  },
};

