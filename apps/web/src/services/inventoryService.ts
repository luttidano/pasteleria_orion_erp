import type { Product } from '../types';
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
   * Obtiene la caché local de ingredientes
   */
  getCachedProducts(): Product[] {
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
  setCachedProducts(products: Product[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(products));
    } catch {
      // Ignorar fallo de escritura de caché
    }
  },

  /**
   * Obtiene todos los insumos desde el backend NestJS (GET /api/inventory)
   * con recuperación transparente vía Supabase REST directo y caché local ante desconexión temporal
   */
  async getProducts(): Promise<Product[]> {
    // 1. Intentar backend NestJS
    try {
      const data = await apiFetch<ApiIngredient[]>('/inventory');
      const products = data.map(mapApiToProduct);
      this.setCachedProducts(products);
      return products;
    } catch (err) {
      console.warn('[inventoryService] API backend demoró o falló. Intentando fallback Supabase directo:', err);

      // 2. Fallback directo a Supabase vía HTTPS desde el navegador
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('ingredient')
            .select('*, categoryRef:category(*)')
            .order('name', { ascending: true });

          if (!error && Array.isArray(data) && data.length > 0) {
            const products: Product[] = data.map((row: any) => {
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

            this.setCachedProducts(products);
            return products;
          }
        } catch (sbErr) {
          console.warn('[inventoryService] Fallback Supabase directo arrojó error:', sbErr);
        }
      }

      // 3. Fallback a caché local persistente
      const cached = this.getCachedProducts();
      if (cached.length > 0) {
        console.warn('[inventoryService] Mostrando catálogo desde caché local resiliente');
        return cached;
      }
      throw err;
    }
  },

  /**
   * Registra un nuevo insumo (POST /api/inventory)
   */
  async addProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
  ): Promise<Product> {
    try {
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
      const product = mapApiToProduct(data);
      const cached = this.getCachedProducts();
      this.setCachedProducts([product, ...cached]);
      return product;
    } catch (err) {
      // Fallback local si no hay conexión al backend
      const fallbackProduct: Product = {
        ...productData,
        id: (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : 'ing-' + Date.now(),
        status: (productData.stock <= 0) ? 'agotado' : (productData.stock <= productData.minStock) ? 'bajo' : 'suficiente',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      const cached = this.getCachedProducts();
      this.setCachedProducts([fallbackProduct, ...cached]);
      throw err;
    }
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
    const product = mapApiToProduct(data);
    const cached = this.getCachedProducts();
    const idx = cached.findIndex((p) => p.id === id);
    if (idx !== -1) {
      cached[idx] = product;
      this.setCachedProducts(cached);
    }
    return product;
  },

  /**
   * Elimina un insumo (DELETE /api/inventory/:id)
   */
  async deleteProduct(id: string): Promise<boolean> {
    await apiFetch(`/inventory/${id}`, {
      method: 'DELETE',
    });
    const cached = this.getCachedProducts();
    this.setCachedProducts(cached.filter((p) => p.id !== id));
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
    const product = mapApiToProduct(data);
    const cached = this.getCachedProducts();
    const idx = cached.findIndex((p) => p.id === id);
    if (idx !== -1) {
      cached[idx] = product;
      this.setCachedProducts(cached);
    }
    return product;
  },

  /**
   * Registra una compra aumentando el stock disponible
   */
  async registerPurchase(id: string, amountBought: number): Promise<Product> {
    return this.adjustStock(id, amountBought);
  },
};
