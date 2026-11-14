export type CategoryType = 'ingredient' | 'recipe' | 'pos';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description?: string | null;
  icon?: string | null;
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

export interface Ingredient {
  id: string;
  name: string;
  categoryId?: string | null;
  category: IngredientCategory | string;
  stock: number;
  minStock: number;
  unit: string;
  price?: number;
  description?: string | null;
  icon?: string | null;
  imageUrl?: string | null;
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
  availableStock?: number;
  stockUnit?: string;
}

export interface RecipeLinkedProduct {
  id: string;
  name: string;
  stock: number;
  unit: string;
  salePrice?: number;
  productType?: ProductKind | string;
}

export interface RecipeMissingIngredient {
  name: string;
  required: number;
  available: number;
  unit: string;
  incompatibleUnits?: boolean;
}

export interface Recipe {
  id: string;
  name: string;
  description?: string | null;
  yieldServings: number;
  category?: string;
  categoryId?: string | null;
  imageUrl?: string | null;
  ingredients: RecipeIngredientItem[];
  products?: RecipeLinkedProduct[];
  canProduce?: boolean;
  maxBatches?: number;
  missingIngredients?: RecipeMissingIngredient[];
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type SupplierType =
  | 'materia_prima'
  | 'empaque'
  | 'reventa'
  | 'insumo_general';

export type SupplyModality = 'despacho' | 'presencial' | 'mixto';

export interface SupplierSummary {
  id: string;
  name: string;
  phone: string;
  deliverySchedule: string;
  category: string;
  supplierTypes: SupplierType[];
  contactPerson?: string | null;
  icon?: string | null;
}

export interface Supplier extends SupplierSummary {
  approximatePrices: string;
  supplierType?: SupplierType;
  supplyModality?: SupplyModality;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: string;
  updatedAt?: string;
  ingredientsCount?: number;
  resaleProductsCount?: number;
}

export type ProductKind = 'manufactured' | 'resale';

export interface CatalogProduct {
  id: string;
  name: string;
  description?: string | null;
  productType: ProductKind;
  stock: number;
  minStock: number;
  unit: string;
  salePrice: number;
  costPrice?: number;
  recipeId?: string | null;
  recipeName?: string | null;
  supplierId?: string | null;
  supplierName?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  icon?: string | null;
  status?: StockStatus;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type PackagingType = 'primario' | 'secundario';

export interface Packaging {
  id: string;
  name: string;
  packageType: PackagingType;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  costPrice?: number;
  salePrice?: number;
  supplierId?: string | null;
  supplier?: SupplierSummary | null;
  icon?: string | null;
  description?: string | null;
  status?: StockStatus;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface GeneralSupply {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  costPrice?: number;
  supplierId?: string | null;
  supplier?: SupplierSummary | null;
  icon?: string | null;
  description?: string | null;
  status?: StockStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface SaveGeneralSupplyPayload {
  name: string;
  category: string;
  stock: number;
  minStock: number;
  unit?: string;
  costPrice?: number;
  supplierId?: string | null;
  icon?: string;
  description?: string | null;
}

export interface ProduceRecipeData {
  quantity: number;
  productId?: string;
  producedUnits?: number;
  notes?: string;
}

export interface ProductionResult {
  success: boolean;
  message: string;
  recipe: { id: string; name: string; batches: number };
  product: {
    id: string;
    name: string;
    addedStock: number;
    newStock: number;
    unit: string;
    unitCost?: number;
  };
  deductedIngredients: Array<{
    ingredientId: string;
    name: string;
    deducted: number;
    newStock: number;
    unit: string;
    cost?: number;
  }>;
  totalCost?: number;
  accountingStatus?: 'posted' | 'pending';
  accountingWarning?: string | null;
}

export type InventoryAdjustmentReasonType =
  | 'purchase'
  | 'waste'
  | 'internal_use'
  | 'recount_surplus'
  | 'recount_shortage';

export type InventoryPurchasePaymentMethod =
  | 'efectivo'
  | 'banco'
  | 'transferencia'
  | 'credito_proveedor';

export interface AdjustStockPayload {
  delta: number;
  reasonType?: InventoryAdjustmentReasonType;
  reason?: string;
  totalCost?: number;
  hasInvoice?: boolean;
  paymentMethod?: InventoryPurchasePaymentMethod;
}

export type StockMovementItemType =
  | 'ingredient'
  | 'product'
  | 'packaging'
  | 'general_supply';

export type StockMovementType =
  | 'purchase'
  | 'production_in'
  | 'production_out'
  | 'sale'
  | 'waste'
  | 'internal_use'
  | 'recount_surplus'
  | 'recount_shortage';

export interface StockMovementRecord {
  id: string;
  itemType: StockMovementItemType;
  itemId: string;
  itemName: string;
  movementType: StockMovementType;
  quantityDelta: number;
  unit: string;
  stockBefore: number;
  stockAfter: number;
  unitCost: number;
  totalCost: number;
  referenceType?: string | null;
  referenceId?: string | null;
  reason?: string | null;
  createdAt: string;
}

export type ShoppingItemKind =
  | 'ingredient'
  | 'resale'
  | 'packaging'
  | 'general_supply';

export interface ShoppingItem {
  id: string;
  name: string;
  kind: ShoppingItemKind;
  category: string;
  stock: number;
  minStock: number;
  unit: string;
  price?: number;
  description?: string;
  icon?: string;
  supplierName?: string;
}

export interface InventoryTopValuationItem {
  id: string;
  name: string;
  stock: number;
  unit: string;
  unitCost: number;
  totalValue: number;
}

export interface InventoryValuationReport {
  totalWarehouseValue: number;
  rawMaterialsValue: number;
  packagingValue: number;
  finishedProductsValue: number;
  topRawMaterials: InventoryTopValuationItem[];
  topPackaging: InventoryTopValuationItem[];
  topProducts: InventoryTopValuationItem[];
}
