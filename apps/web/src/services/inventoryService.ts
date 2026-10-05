import type { Product, StockStatus } from '../types';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const STORAGE_KEY_INGREDIENTS = 'orion_inventory_ingredients_v2';

const INITIAL_BAKERY_INGREDIENTS: Product[] = [
  {
    id: 'ing-001',
    name: 'Harina de Trigo Repostera (Sin polvos)',
    category: 'Harinas y Polvos',
    stock: 50,
    minStock: 20,
    unit: 'kg',
    price: 1250,
    icon: '🌾',
    description: 'Harina fina especial para bizcochos, tortas y masas quebradas.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-002',
    name: 'Mantequilla sin Sal 82% materia grasa',
    category: 'Lácteos y Huevos',
    stock: 8,
    minStock: 15,
    unit: 'kg',
    price: 6800,
    icon: '🧈',
    description: 'Fundamental para hojaldres, croissants y cremas de mantequilla.',
    status: 'bajo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-003',
    name: 'Leche Entera Natural Pasteurizada',
    category: 'Lácteos y Huevos',
    stock: 24,
    minStock: 10,
    unit: 'Litros',
    price: 1100,
    icon: '🥛',
    description: 'Para remojo de bizcochos, tres leches y cremas pasteleras.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-004',
    name: 'Huevos Frescos de Campo (Bandeja 30 un)',
    category: 'Lácteos y Huevos',
    stock: 6,
    minStock: 4,
    unit: 'Bandejas',
    price: 6500,
    icon: '🥚',
    description: 'Huevos frescos seleccionados para merengues, queques y batidos.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-005',
    name: 'Crema de Leche para Batir 35%',
    category: 'Lácteos y Huevos',
    stock: 3,
    minStock: 8,
    unit: 'Litros',
    price: 4900,
    icon: '🍶',
    description: 'Crema espesa para chantilly fresco y ganache de chocolate.',
    status: 'bajo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-006',
    name: 'Azúcar Granulada Blanca',
    category: 'Azúcares y Dulces',
    stock: 35,
    minStock: 15,
    unit: 'kg',
    price: 1350,
    icon: '🍬',
    description: 'Azúcar pura para batidos y almíbares.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-007',
    name: 'Azúcar Flor / Glacé Cernida',
    category: 'Azúcares y Dulces',
    stock: 0,
    minStock: 6,
    unit: 'kg',
    price: 2100,
    icon: '🍥',
    description: 'Para glaseados finos, macarons y espolvorear masas.',
    status: 'agotado',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-008',
    name: 'Chocolate Semi-Amargo 60% Gotas',
    category: 'Chocolates y Cacaos',
    stock: 12,
    minStock: 8,
    unit: 'kg',
    price: 8900,
    icon: '🍫',
    description: 'Para fundir, ganache, selva negra y volcanes de chocolate.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-009',
    name: 'Manjar Artesanal de Campo Tradicional',
    category: 'Azúcares y Dulces',
    stock: 18,
    minStock: 10,
    unit: 'kg',
    price: 3600,
    icon: '🍯',
    description: 'Dulce de leche repostero consistente para relleno de tortas y alfajores.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-010',
    name: 'Polvo de Hornear Doble Acción',
    category: 'Harinas y Polvos',
    stock: 4,
    minStock: 2,
    unit: 'kg',
    price: 4500,
    icon: '✨',
    description: 'Leudante químico para queques esponjosos y galletas.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-011',
    name: 'Extracto Puro de Vainilla Bourbon',
    category: 'Frutas y Esencias',
    stock: 1,
    minStock: 3,
    unit: 'Litros',
    price: 18000,
    icon: '🌸',
    description: 'Esencia aromática natural para cremas y masas.',
    status: 'bajo',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'ing-012',
    name: 'Frutos Rojos Mixtos Congelados',
    category: 'Frutas y Esencias',
    stock: 10,
    minStock: 5,
    unit: 'kg',
    price: 5200,
    icon: '🍓',
    description: 'Frambuesas, moras y arándanos para cheesecakes y coulis.',
    status: 'suficiente',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

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
          localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(items));
          return items;
        }
      } catch (err) {
        console.warn('Supabase no disponible para inventario, usando almacenamiento local:', err);
      }
    }

    // Fallback a localStorage
    try {
      const data = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      if (!data) {
        localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(INITIAL_BAKERY_INGREDIENTS));
        return INITIAL_BAKERY_INGREDIENTS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_BAKERY_INGREDIENTS;
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
              price: productData.price,
              icon: productData.icon,
              image_url: productData.imageUrl,
              description: productData.description,
              status: computedStatus,
            },
          ])
          .select()
          .single();

        if (!error && data) {
          const newProduct = mapDbToProduct(data as SupabaseIngredientRow);
          const localProducts = await this.getLocalProducts();
          localProducts.unshift(newProduct);
          localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(localProducts));
          return newProduct;
        }
      } catch (err) {
        console.warn('Error al guardar en Supabase, guardando localmente:', err);
      }
    }

    const localProducts = await this.getLocalProducts();
    const newProduct: Product = {
      ...productData,
      id: 'ing-' + Date.now(),
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

    if (isSupabaseConfigured() && supabase) {
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

        if (!error && data) {
          const updated = mapDbToProduct(data as SupabaseIngredientRow);
          if (index !== -1) {
            localProducts[index] = updated;
            localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(localProducts));
          }
          return updated;
        }
      } catch (err) {
        console.warn('Error al actualizar en Supabase, aplicando local:', err);
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
    if (isSupabaseConfigured() && supabase) {
      try {
        await supabase.from('ingredients').delete().eq('id', id);
      } catch (err) {
        console.warn('Error al eliminar en Supabase:', err);
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
   * Restablecer despensa a los ingredientes de muestra de la pastelería
   */
  async resetToDefaults(): Promise<Product[]> {
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(INITIAL_BAKERY_INGREDIENTS));
    return INITIAL_BAKERY_INGREDIENTS;
  },

  /**
   * Helper privado para lectura sincrónica de respaldo local
   */
  async getLocalProducts(): Promise<Product[]> {
    try {
      const data = localStorage.getItem(STORAGE_KEY_INGREDIENTS);
      return data ? JSON.parse(data) : INITIAL_BAKERY_INGREDIENTS;
    } catch {
      return INITIAL_BAKERY_INGREDIENTS;
    }
  },
};
