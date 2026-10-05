import type { Product, StockStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY_INGREDIENTS = 'orion_inventory_ingredients_v2';

function calculateStatus(stock: number, minStock: number): StockStatus {
  if (stock <= 0) return 'agotado';
  if (stock <= minStock) return 'bajo';
  return 'suficiente';
}

interface SupabaseIngredientRow {
  id: string;
  name: string;
  category: string;
  stock: number | string;
  min_stock?: number | string;
  unit: string;
  price?: number | string | null;
  icon?: string | null;
  image_url?: string | null;
  description?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

function mapDbToProduct(row: SupabaseIngredientRow): Product {
  const stock = Number(row.stock);
  const minStock = Number(row.min_stock ?? 0);
  return {
    id: String(row.id),
    name: row.name,
    category: row.category,
    stock,
    minStock,
    unit: row.unit || 'kg',
    price: row.price !== null && row.price !== undefined ? Number(row.price) : undefined,
    icon: row.icon || '📦',
    imageUrl: row.image_url || undefined,
    description: row.description || '',
    status: (row.status as StockStatus) || calculateStatus(stock, minStock),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const inventoryService = {
  /**
   * Obtiene todos los productos de la despensa (Supabase en Producción + Fallback Local)
   */
  async getProducts(): Promise<Product[]> {
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ingredients')
          .select('*')
          .order('name', { ascending: true });

        if (!error && data) {
          const items = (data as SupabaseIngredientRow[]).map(mapDbToProduct);
          // Reflejar exactamente los datos de Supabase en el almacenamiento local
          localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(items));
          return items;
        }
        if (error) {
          console.warn('Error al consultar ingredientes en Supabase:', error.message);
        }
      } catch (err) {
        console.warn('Supabase no disponible para inventario, usando almacenamiento local:', err);
      }
    }

    // Fallback a localStorage (solo si Supabase no está configurado)
    try {
      const data = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  /**
   * Agrega un nuevo ingrediente al inventario
   */
  async addProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<Product> {
    const computedStatus = calculateStatus(productData.stock, productData.minStock);

    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('ingredients')
          .insert([
            {
              name: productData.name,
              category: productData.category,
              stock: productData.stock,
              min_stock: productData.minStock,
              unit: productData.unit,
              price: productData.price !== undefined ? productData.price : 0,
              icon: productData.icon,
              image_url: productData.imageUrl || null,
              description: productData.description || null,
              status: computedStatus,
            },
          ])
          .select()
          .single();

        if (error) {
          console.error('Error al insertar ingrediente en Supabase:', error);
          let userMsg = error.message;
          if (error.code === '42P17') {
            userMsg = 'Error en Supabase: Recursión infinita en políticas RLS. Por favor ejecuta el script supabase/schema.sql actualizado en el SQL Editor de Supabase.';
          } else if (error.code === '42501') {
            userMsg = 'No tienes permisos de administrador en Supabase para crear ingredientes. Verifica que tu usuario tenga role = "admin" en la tabla profiles.';
          }
          throw new Error(userMsg);
        }

        if (data) {
          const newProduct = mapDbToProduct(data as SupabaseIngredientRow);
          const localProducts = await this.getLocalProducts();
          localProducts.unshift(newProduct);
          localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(localProducts));
          return newProduct;
        }
      } catch (err) {
        console.error('Fallo en addProduct:', err);
        throw err;
      }
    }

    // Modo local / demo cuando no hay conexión activa
    const localProducts = await this.getLocalProducts();
    const newProduct: Product = {
      ...productData,
      id: typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : '00000000-0000-4000-8000-' + Date.now().toString(16).padStart(12, '0'),
      status: computedStatus,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localProducts.unshift(newProduct);
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(localProducts));
    return newProduct;
  },

  /**
   * Edita un ingrediente existente
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const localProducts = await this.getLocalProducts();
    const index = localProducts.findIndex((p) => p.id === id);
    const current = index !== -1 ? localProducts[index] : null;

    const newStock = updates.stock !== undefined ? updates.stock : (current ? current.stock : 0);
    const newMinStock = updates.minStock !== undefined ? updates.minStock : (current ? current.minStock : 0);
    const newStatus = calculateStatus(newStock, newMinStock);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    if (isSupabaseConfigured() && supabase && isUuid) {
      try {
        const payload: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.stock !== undefined) payload.stock = updates.stock;
        if (updates.minStock !== undefined) payload.min_stock = updates.minStock;
        if (updates.unit !== undefined) payload.unit = updates.unit;
        if (updates.price !== undefined) payload.price = updates.price;
        if (updates.icon !== undefined) payload.icon = updates.icon;
        if (updates.imageUrl !== undefined) payload.image_url = updates.imageUrl;
        if (updates.description !== undefined) payload.description = updates.description;
        payload.status = newStatus;

        const { data, error } = await supabase
          .from('ingredients')
          .update(payload)
          .eq('id', id)
          .select()
          .maybeSingle();

        if (error) {
          console.error('Error al actualizar en Supabase:', error);
          let userMsg = error.message;
          if (error.code === '42P17') {
            userMsg = 'Error en Supabase: Recursión infinita en políticas RLS. Por favor ejecuta el script supabase/schema.sql actualizado en el SQL Editor de Supabase.';
          } else if (error.code === '42501') {
            userMsg = 'No tienes permisos de administrador para modificar ingredientes.';
          }
          throw new Error(userMsg);
        }

        if (data) {
          const updated = mapDbToProduct(data as SupabaseIngredientRow);
          if (index !== -1) {
            localProducts[index] = updated;
            localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(localProducts));
          }
          return updated;
        }
      } catch (err) {
        console.error('Fallo en updateProduct:', err);
        throw err;
      }
    }

    if (index === -1 || !current) {
      throw new Error(`Ingrediente con ID ${id} no encontrado.`);
    }

    const updatedProduct: Product = {
      ...current,
      ...updates,
      id: current.id,
      stock: newStock,
      minStock: newMinStock,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    };

    localProducts[index] = updatedProduct;
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(localProducts));
    return updatedProduct;
  },

  /**
   * Elimina un ingrediente de la despensa
   */
  async deleteProduct(id: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Solo consultar Supabase si el ID es un UUID válido de la base de datos
    if (isSupabaseConfigured() && supabase && isUuid) {
      try {
        const { error } = await supabase.from('ingredients').delete().eq('id', id);
        if (error) {
          console.error('Error al eliminar en Supabase:', error);
          let userMsg = error.message;
          if (error.code === '42501') {
            userMsg = 'No tienes permisos de administrador para eliminar ingredientes.';
          }
          throw new Error(userMsg);
        }
      } catch (err) {
        console.error('Fallo en deleteProduct:', err);
        throw err;
      }
    }

    const products = await this.getLocalProducts();
    const filtered = products.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(filtered));
    return true;
  },

  /**
   * Ajuste rápido de existencias (+ o - desde la vista)
   */
  async adjustStock(id: string, delta: number): Promise<Product> {
    const products = await this.getProducts();
    const item = products.find((p) => p.id === id);
    if (!item) throw new Error('Ingrediente no encontrado');

    const nextStock = Math.max(0, item.stock + delta);
    return this.updateProduct(id, { stock: nextStock });
  },

  /**
   * Registra una compra de insumos, aumentando el stock disponible
   */
  async registerPurchase(id: string, amountBought: number): Promise<Product> {
    const products = await this.getProducts();
    const item = products.find((p) => p.id === id);
    if (!item) throw new Error('Ingrediente no encontrado');

    const nextStock = Math.max(0, item.stock + amountBought);
    return this.updateProduct(id, { stock: nextStock });
  },

  /**
   * Restablecer despensa (vaciar inventario local)
   */
  async resetToDefaults(): Promise<Product[]> {
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify([]));
    return [];
  },

  /**
   * Helper privado para lectura sincrónica de respaldo local
   */
  async getLocalProducts(): Promise<Product[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },
};
