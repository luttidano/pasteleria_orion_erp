import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import type {
  InventoryAdjustmentReasonType,
  InventoryPurchasePaymentMethod,
  StockMovementItemType,
} from '@repo/types';
import { roundMoney, roundQuantity } from '../../common/utils/money.util';
import type { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import type { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import {
  computeWeightedAverageUnitCost,
  StockMovementService,
} from './stock-movement.service';

export interface ResolvedAdjustmentDecision {
  delta: number;
  nextStock: number;
  reasonType: InventoryAdjustmentReasonType;
  reasonLabel: string | undefined;
  isPurchase: boolean;
  totalCost: number;
  netCost: number;
  hasInvoice: boolean;
  paymentMethod: InventoryPurchasePaymentMethod;
  updatedUnitCost: number | undefined;
  movementUnitCost: number;
  movementTotalCost: number;
}

export function resolveInventoryAdjustmentDecision(params: {
  itemType: StockMovementItemType;
  itemName: string;
  currentStock: number;
  currentUnitCost: number;
  dto: AdjustStockDto;
}): ResolvedAdjustmentDecision {
  const { itemType, itemName, currentStock, currentUnitCost, dto } = params;
  const delta = roundQuantity(dto.delta);

  if (!Number.isFinite(dto.delta) || delta === 0) {
    throw new BadRequestException(
      'El ajuste delta debe ser un número finito distinto de cero.',
    );
  }

  const nextStock = roundQuantity(currentStock + delta);
  if (currentStock + delta < -1e-9 || nextStock < 0) {
    throw new ConflictException(
      `Stock insuficiente para "${itemName}". Disponible: ${currentStock}, ajuste solicitado: ${delta}.`,
    );
  }

  const isPositive = delta > 0;
  let reasonType: InventoryAdjustmentReasonType;

  if (isPositive) {
    if (
      dto.reasonType === 'waste' ||
      dto.reasonType === 'internal_use' ||
      dto.reasonType === 'recount_shortage'
    ) {
      throw new BadRequestException(
        `El motivo "${dto.reasonType}" solo es válido para disminuciones de stock (delta < 0).`,
      );
    }
    reasonType =
      dto.reasonType ??
      (dto.totalCost !== undefined && dto.totalCost > 0
        ? 'purchase'
        : 'recount_surplus');
  } else {
    if (dto.reasonType === 'purchase' || dto.reasonType === 'recount_surplus') {
      throw new BadRequestException(
        `El motivo "${dto.reasonType}" solo es válido para aumentos de stock (delta > 0).`,
      );
    }
    reasonType =
      dto.reasonType ??
      (itemType === 'general_supply' ? 'internal_use' : 'waste');
  }

  const normalizedReason = dto.reason?.trim() || undefined;

  if (reasonType === 'purchase') {
    const totalCost = roundMoney(Number(dto.totalCost ?? 0));
    if (!Number.isFinite(totalCost) || totalCost <= 0) {
      throw new BadRequestException(
        `Para registrar una compra de "${itemName}" debes indicar un monto total pagado mayor a $0.`,
      );
    }
    const hasInvoice = dto.hasInvoice ?? true;
    const paymentMethod: InventoryPurchasePaymentMethod =
      dto.paymentMethod ?? 'efectivo';
    const netCost = hasInvoice ? roundMoney(totalCost / 1.19) : totalCost;
    const updatedUnitCost = computeWeightedAverageUnitCost({
      currentStock,
      currentUnitCost,
      addedQuantity: delta,
      addedNetTotalCost: netCost,
    });

    return {
      delta,
      nextStock,
      reasonType,
      reasonLabel: normalizedReason,
      isPurchase: true,
      totalCost,
      netCost,
      hasInvoice,
      paymentMethod,
      updatedUnitCost,
      movementUnitCost: roundMoney(netCost / delta),
      movementTotalCost: netCost,
    };
  }

  const movementUnitCost = roundMoney(Math.max(0, currentUnitCost));
  const movementTotalCost = roundMoney(Math.abs(delta) * movementUnitCost);

  return {
    delta,
    nextStock,
    reasonType,
    reasonLabel: normalizedReason,
    isPurchase: false,
    totalCost: movementTotalCost,
    netCost: movementTotalCost,
    hasInvoice: false,
    paymentMethod: 'efectivo',
    updatedUnitCost: undefined,
    movementUnitCost,
    movementTotalCost,
  };
}

export async function recordInventoryAdjustmentInTx(params: {
  tx: Prisma.TransactionClient;
  itemType: StockMovementItemType;
  itemId: string;
  itemName: string;
  unit: string;
  currentStock: number;
  decision: ResolvedAdjustmentDecision;
  userId?: string;
  stockMovementService?: StockMovementService;
  accountingOutboxService?: AccountingOutboxService;
}): Promise<{ movementId: string; outboxEventId: string | null }> {
  const {
    tx,
    itemType,
    itemId,
    itemName,
    unit,
    currentStock,
    decision,
    userId,
    stockMovementService,
    accountingOutboxService,
  } = params;

  const occurredAt = new Date();
  const referenceId = randomUUID();

  const recordedMovement = stockMovementService
    ? await stockMovementService.recordInTx(tx, {
        itemType,
        itemId,
        itemName,
        movementType: decision.reasonType,
        quantityDelta: decision.delta,
        unit,
        stockBefore: currentStock,
        stockAfter: decision.nextStock,
        unitCost: decision.movementUnitCost,
        totalCost: decision.movementTotalCost,
        referenceType: decision.isPurchase
          ? 'inventory_purchase'
          : 'inventory_adjustment',
        referenceId,
        reason: decision.reasonLabel,
        createdById: userId,
      })
    : null;

  const aggregateId = recordedMovement?.id ?? referenceId;
  let outboxEventId: string | null = null;

  if (accountingOutboxService) {
    if (decision.isPurchase) {
      const enqueued = await accountingOutboxService.enqueuePurchaseInTx(tx, {
        movementId: aggregateId,
        itemType,
        itemId,
        itemName,
        quantity: decision.delta,
        unit,
        totalCost: decision.totalCost,
        hasInvoice: decision.hasInvoice,
        paymentMethod: decision.paymentMethod,
        occurredAt,
        notes: decision.reasonLabel,
      });
      outboxEventId = enqueued.id;
    } else if (itemType !== 'general_supply') {
      const enqueued =
        await accountingOutboxService.enqueueInventoryAdjustmentInTx(tx, {
          movementId: aggregateId,
          itemType,
          itemId,
          itemName,
          reasonType: decision.reasonType as Exclude<
            InventoryAdjustmentReasonType,
            'purchase'
          >,
          quantityDelta: decision.delta,
          unit,
          unitCost: decision.movementUnitCost,
          totalCost: decision.movementTotalCost,
          occurredAt,
          reason: decision.reasonLabel,
        });
      outboxEventId = enqueued.id;
    }
  }

  return {
    movementId: aggregateId,
    outboxEventId,
  };
}

export async function processInventoryOutboxAfterCommit(
  outboxEventId: string | null,
  accountingOutboxProcessor?: AccountingOutboxProcessorService,
): Promise<{
  accountingStatus: 'posted' | 'pending';
  accountingWarning: string | null;
}> {
  if (!outboxEventId || !accountingOutboxProcessor) {
    return {
      accountingStatus: 'posted',
      accountingWarning: null,
    };
  }

  try {
    await accountingOutboxProcessor.processEvent(outboxEventId);
    return {
      accountingStatus: 'posted',
      accountingWarning: null,
    };
  } catch (error) {
    const errorMsg =
      error instanceof Error
        ? error.message
        : 'Error al generar asiento contable de inventario.';
    return {
      accountingStatus: 'pending',
      accountingWarning: `Movimiento físico guardado. Contabilización pendiente: ${errorMsg}`,
    };
  }
}

