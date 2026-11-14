import type { StockStatus } from '@repo/types';

export type { StockStatus };

export function computeStockStatus(
  stock: number,
  minStock: number,
): StockStatus {
  if (stock <= 0) return 'agotado';
  if (stock <= minStock) return 'bajo';
  return 'suficiente';
}
