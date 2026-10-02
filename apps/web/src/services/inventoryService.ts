import type { Product, StockStatus } from '../types';

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

export const inventoryService = {
  /**
   * Obtiene todos los ingredientes de la despensa
   * TODO: Conectar con Supabase:
   * const { data, error } = await supabase.from('ingredients').select('*').order('name');
   */
  async getProducts(): Promise<Product[]> {
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
   * TODO: Conectar con Supabase:
   * const { data, error } = await supabase.from('ingredients').insert([payload]).select().single();
   */
  async addProduct(
    productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'status'>
  ): Promise<Product> {
    const products = await this.getProducts();
    const newProduct: Product = {
      ...productData,
      id: 'ing-' + Date.now(),
      status: calculateStatus(productData.stock, productData.minStock),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    products.unshift(newProduct);
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(products));
    return newProduct;
  },

  /**
   * Edita un ingrediente existente
   * TODO: Conectar con Supabase:
   * const { data, error } = await supabase.from('ingredients').update(payload).eq('id', id).select().single();
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    const products = await this.getProducts();
    const index = products.findIndex((p) => p.id === id);

    if (index === -1) {
      throw new Error(`Ingrediente con ID ${id} no encontrado.`);
    }

    const current = products[index];
    const newStock = updates.stock !== undefined ? updates.stock : current.stock;
    const newMinStock = updates.minStock !== undefined ? updates.minStock : current.minStock;

    const updatedProduct: Product = {
      ...current,
      ...updates,
      id: current.id,
      stock: newStock,
      minStock: newMinStock,
      status: calculateStatus(newStock, newMinStock),
      updatedAt: new Date().toISOString(),
    };

    products[index] = updatedProduct;
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(products));
    return updatedProduct;
  },

  /**
   * Elimina un ingrediente de la despensa
   * TODO: Conectar con Supabase:
   * const { error } = await supabase.from('ingredients').delete().eq('id', id);
   */
  async deleteProduct(id: string): Promise<boolean> {
    const products = await this.getProducts();
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
   * Restablecer despensa a los ingredientes de muestra de la pastelería
   */
  async resetToDefaults(): Promise<Product[]> {
    localStorage.setItem(STORAGE_KEY_INGREDIENTS, JSON.stringify(INITIAL_BAKERY_INGREDIENTS));
    return INITIAL_BAKERY_INGREDIENTS;
  },
};

