export type UserRole = 'admin' | 'cashier' | 'baker' | 'user'
;

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatarUrl?: string; // URL en Cloudflare R2
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
  | 'Azúcares y Dulces'
  | 'Chocolates y Cacaos'
  | 'Frutas y Esencias'
  | 'Grasas y Aceites';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

export interface Product {
  id: string;
  name: string;
  category: IngredientCategory | string;
  stock: number;
  minStock: number;
  unit: string; // 'kg', 'Litros', 'Unidades', 'Gramos', 'Bandejas'
  price?: number; // Costo por unidad/kg en CLP
  description?: string;
  icon?: string;
  imageUrl?: string; // URL en Cloudflare R2 / CDN
  status?: StockStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message?: string;
}

export interface RecipeIngredientItem {
  id?: string;
  ingredientId: string;
  ingredientName?: string;
  quantity: number;
  unit: string;
  availableStock?: number;
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


