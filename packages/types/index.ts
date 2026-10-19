export type UserRole = 'admin' | 'cashier' | 'baker';

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

export interface Ingredient {
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

export type SupplierType = 'materia_prima' | 'reventa' | 'ambos';

export interface Supplier {
  id: string;
  name: string; // Nombre del proveedor / empresa
  phone: string; // Teléfono o número de WhatsApp
  deliverySchedule: string; // Cuándo entrega (días, horarios o frecuencia)
  category: string; // Proveedor de qué es (rubro o insumos principales)
  approximatePrices: string; // Precios aproximados o lista de referencia
  supplierType?: SupplierType;
  contactPerson?: string; // Nombre de la persona o vendedor de contacto
  icon?: string; // Emoji representativo
  email?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductKind = 'manufactured' | 'resale';

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string;
  productType: ProductKind;
  stock: number;
  minStock: number;
  unit: string; // 'un', 'porción', 'docena', etc.
  salePrice: number; // Precio de venta en CLP
  costPrice?: number; // Costo referencial / compra en CLP
  recipeId?: string;
  recipeName?: string;
  supplierId?: string;
  supplierName?: string;
  categoryId?: string;
  categoryName?: string;
  imageUrl?: string;
  icon?: string;
  status?: StockStatus;
  createdAt?: string;
  updatedAt?: string;
}

