import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StockMovementItemType, StockMovementType } from '@repo/types';
import { roundMoney, roundQuantity } from '../../../common/utils/money.util';

export interface RecordStockMovementInput {
  itemType: StockMovementItemType;
  itemId: string;
  itemName: string;
  movementType: StockMovementType;
  quantityDelta: number;
  unit: string;
  stockBefore: number;
  stockAfter: number;
  unitCost: number;
  totalCost?: number;
  referenceType?: string;
  referenceId?: string;
  reason?: string;
  createdById?: string;
}

export function computeWeightedAverageUnitCost(params: {
  currentStock: number;
  currentUnitCost: number;
  addedQuantity: number;
  addedNetTotalCost: number;
}): number {
  const currentStock = Math.max(0, Number(params.currentStock || 0));
  const currentUnitCost = Math.max(0, Number(params.currentUnitCost || 0));
  const addedQty = Number(params.addedQuantity || 0);
  const addedNetTotal = Number(params.addedNetTotalCost || 0);

  if (addedQty <= 0 || addedNetTotal <= 0) {
    return roundMoney(currentUnitCost);
  }

  if (currentStock <= 0 || currentUnitCost <= 0) {
    return roundMoney(addedNetTotal / addedQty);
  }

  const existingValue = currentStock * currentUnitCost;
  const totalQty = currentStock + addedQty;
  return roundMoney((existingValue + addedNetTotal) / totalQty);
}

function buildMovementRow(params: RecordStockMovementInput) {
  const delta = roundQuantity(params.quantityDelta);
  if (delta === 0) {
    return null;
  }

  const unitCost = roundMoney(Math.max(0, params.unitCost));
  const totalCost =
    params.totalCost !== undefined
      ? roundMoney(Math.max(0, params.totalCost))
      : roundMoney(Math.abs(delta) * unitCost);

  return {
    itemType: params.itemType,
    itemId: params.itemId,
    itemName: params.itemName,
    movementType: params.movementType,
    quantityDelta: delta,
    unit: params.unit,
    stockBefore: roundQuantity(Math.max(0, params.stockBefore)),
    stockAfter: roundQuantity(Math.max(0, params.stockAfter)),
    unitCost,
    totalCost,
    referenceType: params.referenceType ?? null,
    referenceId: params.referenceId ?? null,
    reason: params.reason ?? null,
    createdById: params.createdById ?? null,
  };
}

@Injectable()
export class StockMovementService {
  async recordInTx(
    tx: Prisma.TransactionClient,
    params: RecordStockMovementInput,
  ): Promise<{ id: string } | null> {
    if (!tx.stockMovement?.create) {
      return null;
    }

    const row = buildMovementRow(params);
    if (!row) {
      return null;
    }

    const created = await tx.stockMovement.create({
      data: row,
      select: { id: true },
    });

    return { id: created.id };
  }

  /**
   * Inserta múltiples movimientos de Kardex en una sola operación batch para evitar round-trips N+1.
   */
  async recordManyInTx(
    tx: Prisma.TransactionClient,
    entries: RecordStockMovementInput[],
  ): Promise<number> {
    const rows = entries
      .map(buildMovementRow)
      .filter((row): row is NonNullable<typeof row> => row !== null);

    if (rows.length === 0) {
      return 0;
    }

    if (typeof tx.stockMovement?.createMany === 'function') {
      const result = await tx.stockMovement.createMany({ data: rows });
      return result.count;
    }

    if (typeof tx.stockMovement?.create === 'function') {
      for (const row of rows) {
        await tx.stockMovement.create({ data: row, select: { id: true } });
      }
      return rows.length;
    }

    return 0;
  }
}
