export type UserRole = 'admin' | 'cashier' | 'baker' | 'user';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string; // URL en Cloudflare R2 / CDN
  createdAt?: string;
}

export type CategoryType = 'ingredient' | 'recipe' | 'pos';
export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description?: string;
  icon?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type IngredientCategory =
  | 'Harinas y Polvos'
  | 'Lácteos y Huevos'
  | 'Azúcares y Endulzantes'
  | 'Chocolates y Cacaos'
  | 'Frutas, Frutos Secos y Esencias'
  | 'Grasas y Aceites';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

export interface Product {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string; // 'kg', 'Litros', 'Unidades', 'Gramos', 'Bandejas'
  price?: number; // Costo referencial de compra por unidad/kg en CLP
  description?: string;
  icon?: string; // Emoji o icono visual (ej: 🌾, 🥛, 🥚, 🧈, 🍫)
  imageUrl?: string; // URL en Cloudflare R2 / CDN
  status?: StockStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface RecipeIngredientItem {
  id?: string;
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit: string;
  avaibleStock?: number;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string;
  yieldServings: number;
  category?: string;
  imageUrl?: string;
  ingredients: RecipeIngredientItem[];
  canProduce?: boolean;
  maxBatches?: number;
  missingIngredients?: Array<{
    name: string;
    required: number;
    available: number;
    unit: string;
  }>;
  createdAt?: string;
  updatedAt?: string;
}


