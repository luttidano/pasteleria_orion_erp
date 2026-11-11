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
  products?: Array<{
    id: string;
    name: string;
    stock: number;
    unit: string;
    salePrice?: number;
    productType?: string;
  }>;
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

export type SupplierType = 'materia_prima' | 'empaque' | 'reventa' | 'insumo_general';

export interface Supplier {
  id: string;
  name: string; // Nombre del proveedor / empresa
  phone: string; // Teléfono o número de WhatsApp
  deliverySchedule: string; // Cuándo entrega (días, horarios o frecuencia)
  category: string; // Proveedor de qué es (rubro o insumos principales)
  approximatePrices: string; // Precios aproximados o lista de referencia
  supplierTypes: SupplierType[];
  contactPerson?: string; // Nombre de la persona o vendedor de contacto
  icon?: string; // Emoji representativo
  email?: string;
  address?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  ingredientsCount?: number;
  resaleProductsCount?: number;
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
  supplierId?: string;
  supplier?: Supplier;
  icon?: string;
  description?: string;
  status?: StockStatus;
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
  supplier?: Supplier | null;
  icon?: string;
  description?: string | null;
  status?: StockStatus;
  createdAt?: string;
  updatedAt?: string;
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
  product: { id: string; name: string; addedStock: number; newStock: number; unit: string };
  deductedIngredients: Array<{
    ingredientId: string;
    name: string;
    deducted: number;
    newStock: number;
    unit: string;
  }>;
}

export type AccountingPeriodStatus = 'abierto' | 'cerrado';
export type AccountingEntryOrigin = 'manual' | 'pos' | 'closing' | 'reversal';
export type AccountingEntryStatus = 'active' | 'voided';

export interface AccountingPeriod {
  id: string | null;
  year: number;
  month: number;
  monthLabel: string;
  status: AccountingPeriodStatus;
  closedAt?: string | null;
  closedBy?: { id: string; name: string } | null;
  reopenedAt?: string | null;
  reopenedBy?: { id: string; name: string } | null;
  closingEntryId?: string | null;
  notes?: string | null;
  entriesCount: number;
  activeEntriesCount: number;
  pendingSalesCount: number;
  isPersisted: boolean;
  isBeforeAccountingStart?: boolean;
}

export interface AccountingSettings {
  accountingStartDate: string | null;
  updatedAt?: string | null;
  updatedBy?: { id: string; name: string } | null;
}

export interface AccountingYearOverview {
  year: number;
  accountingStartDate: string | null;
  isYearClosed: boolean;
  closingEntry: {
    id: string;
    entryNumber: number;
    entryDate: string;
    concept: string;
    createdAt: string;
  } | null;
  periods: AccountingPeriod[];
}

export interface AnnualClosingLinePreview {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: 'ingreso' | 'costo' | 'gasto' | 'patrimonio';
  currentBalance: number;
  debit: number;
  credit: number;
  description: string;
}

export interface AnnualClosingPreview {
  year: number;
  closingDate: string;
  alreadyClosed: boolean;
  existingClosingEntryId?: string | null;
  hasLaterYearClosed: boolean;
  totalIngresos: number;
  totalCostos: number;
  totalGastos: number;
  resultadoEjercicio: number;
  equityAccount: {
    id: string;
    code: string;
    name: string;
  } | null;
  openMonthsCount: number;
  pendingSalesCount: number;
  canExecute: boolean;
  blockingReason?: string | null;
  lines: AnnualClosingLinePreview[];
}

export interface PeriodCheckResult {
  date: string;
  year: number;
  month: number;
  monthLabel: string;
  status: AccountingPeriodStatus;
  isOpen: boolean;
  isYearClosed: boolean;
  isBeforeAccountingStart?: boolean;
  accountingStartDate?: string | null;
  reason?: string | null;
}

export type PosShiftStatus = 'abierto' | 'cerrado';
export type PosShiftAccountingStatus = 'none' | 'posted' | 'pending';

export interface PosShiftRecord {
  id: string;
  shiftNumber: number;
  status: PosShiftStatus;
  openedAt: string;
  openedBy: { id: string; name: string } | null;
  closedAt: string | null;
  closedBy: { id: string; name: string } | null;
  openingCash: number;
  totalSales: number;
  transactionsCount: number;
  cashSalesTotal: number;
  debitTotal: number;
  creditTotal: number;
  transferTotal: number;
  cardPosTotal: number;
  expectedCash: number;
  countedCash: number | null;
  cashDifference: number | null;
  notes: string | null;
  closingEntryId: string | null;
  closingEntryNumber: number | null;
  accountingStatus: PosShiftAccountingStatus;
  accountingWarning: string | null;
}

export interface PosActiveShiftOverview {
  businessDate?: string;
  hasOpenShift: boolean;
  activeShiftId: string | null;
  shiftNumber: number | null;
  openedAt: string | null;
  openedByName: string | null;
  openingCash: number;
  totalSales: number;
  transactionsCount: number;
  cashSalesTotal: number;
  cardPosTotal: number;
  debitTotal: number;
  creditTotal: number;
  transferTotal: number;
  expectedCash: number;
  lastClosedShift: {
    id: string;
    shiftNumber: number;
    closedAt: string;
    closedByName: string;
    totalSales: number;
    expectedCash: number;
    countedCash: number;
    cashDifference: number;
  } | null;
}
