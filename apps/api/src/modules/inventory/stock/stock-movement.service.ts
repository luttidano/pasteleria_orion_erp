import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { StockMovementItemType, StockMovementType } from '@repo/types';
import { roundMoney, roundQuantity } from '../../../common/utils/money.util';

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

@Injectable()
export class StockMovementService {
  async recordInTx(
    tx: Prisma.TransactionClient,
    params: {
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
    },
  ): Promise<{ id: string } | null> {
    if (!tx.stockMovement?.create) {
      return null;
    }

    const delta = roundQuantity(params.quantityDelta);
    if (delta === 0) {
      return null;
    }

    const unitCost = roundMoney(Math.max(0, params.unitCost));
    const totalCost =
      params.totalCost !== undefined
        ? roundMoney(Math.max(0, params.totalCost))
        : roundMoney(Math.abs(delta) * unitCost);

    const created = await tx.stockMovement.create({
      data: {
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
      },
      select: { id: true },
    });

    return { id: created.id };
  }
}

