export type OutboxAggregateType =
  | 'pos_sale'
  | 'pos_shift'
  | 'inventory_purchase'
  | 'inventory_production'
  | 'inventory_adjustment'
  | 'pos_sale_cogs';

export type InventoryOutboxItemType =
  | 'ingredient'
  | 'product'
  | 'packaging'
  | 'general_supply';

export interface SaleIncomeRequestedPayload {
  ticketNumber: string;
  soldAt: string;
  total: number;
  paymentMethod: string;
}

export interface ShiftDifferenceRequestedPayload {
  shiftNumber: number;
  closedAt: string;
  cashDifference: number;
  entryDate?: string;
}

export interface InventoryPurchaseRequestedPayload {
  itemType: InventoryOutboxItemType;
  itemId: string;
  itemName: string;
  quantity: number;
  unit: string;
  totalCost: number;
  hasInvoice: boolean;
  paymentMethod: string;
  occurredAt: string;
  notes?: string;
}

export interface InventoryProductionMissingIngredient {
  ingredientId: string;
  name: string;
  deductedQty: number;
}

export interface InventoryProductionRequestedPayload {
  recipeId: string;
  recipeName: string;
  productId: string;
  productName: string;
  batches: number;
  unitsProduced: number;
  totalCost: number;
  missingCostIngredients: InventoryProductionMissingIngredient[];
  producedAt: string;
}

export interface InventoryAdjustmentRequestedPayload {
  itemType: Exclude<InventoryOutboxItemType, 'general_supply'>;
  itemId: string;
  itemName: string;
  reasonType: 'waste' | 'internal_use' | 'recount_surplus' | 'recount_shortage';
  quantityDelta: number;
  unit: string;
  unitCost: number;
  totalCost: number;
  occurredAt: string;
  reason?: string;
}

export interface PosSaleCogsLinePayload {
  saleItemId?: string;
  productId?: string | null;
  packagingId?: string | null;
  productName: string;
  quantity: number;
  unitCost: number;
}

export interface PosSaleCogsRequestedPayload {
  ticketNumber: string;
  soldAt: string;
  items: PosSaleCogsLinePayload[];
}

export interface RecoveredSaleItemCost {
  saleItemId: string;
  unitCost: number;
}

export interface AccountingEntryCreatedResult {
  entryId: string;
  entryNumber: number;
}

export interface SaleCogsEntryCreatedResult extends AccountingEntryCreatedResult {
  recoveredItemCosts?: RecoveredSaleItemCost[];
}

export interface OutboxProcessResult {
  outboxId: string;
  aggregateType: OutboxAggregateType;
  aggregateId: string;
  entryId: string | null;
  entryNumber: number | null;
  alreadyProcessed: boolean;
  recoveredItemCosts?: RecoveredSaleItemCost[];
}

export interface SyncedSaleRef {
  saleId: string;
  entryId: string | null;
}

export interface SyncedShiftRef {
  shiftId: string;
  entryId: string | null;
  entryNumber: number | null;
}

export interface OutboxSyncBatchResult {
  synced: number;
  failed: number;
  syncedSales: SyncedSaleRef[];
  syncedShifts: SyncedShiftRef[];
  recoveredItemCosts: RecoveredSaleItemCost[];
}
