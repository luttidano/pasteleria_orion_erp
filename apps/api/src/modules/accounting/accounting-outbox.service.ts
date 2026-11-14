import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { roundMoney } from '../../common/utils/money.util';
import type {
  InventoryAdjustmentRequestedPayload,
  InventoryProductionRequestedPayload,
  InventoryPurchaseRequestedPayload,
  PosSaleCogsRequestedPayload,
  SaleIncomeRequestedPayload,
  ShiftDifferenceRequestedPayload,
} from './accounting-outbox.types';

@Injectable()
export class AccountingOutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async enqueueSaleInTx(
    tx: Prisma.TransactionClient,
    params: {
      saleId: string;
      ticketNumber: string;
      soldAt: Date | string;
      total: number;
      paymentMethod: string;
    },
  ): Promise<{ id: string } | null> {
    const total = roundMoney(params.total);
    if (total <= 0) {
      return null;
    }

    const soldAtDate =
      params.soldAt instanceof Date ? params.soldAt : new Date(params.soldAt);

    const payload: SaleIncomeRequestedPayload = {
      ticketNumber: params.ticketNumber,
      soldAt: soldAtDate.toISOString(),
      total,
      paymentMethod: params.paymentMethod,
    };

    const record = await tx.accountingOutbox.upsert({
      where: {
        aggregateType_aggregateId: {
          aggregateType: 'pos_sale',
          aggregateId: params.saleId,
        },
      },
      create: {
        aggregateType: 'pos_sale',
        aggregateId: params.saleId,
        businessDate: soldAtDate,
        referenceCode: params.ticketNumber,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
      update: {},
      select: { id: true },
    });

    return { id: record.id };
  }

  async enqueueShiftDifferenceInTx(
    tx: Prisma.TransactionClient,
    params: {
      shiftId: string;
      shiftNumber: number;
      closedAt: Date | string;
      cashDifference: number;
      entryDate?: string;
    },
  ): Promise<{ id: string } | null> {
    const diff = roundMoney(params.cashDifference);
    if (Math.abs(diff) < 0.01) {
      return null;
    }

    const closedAtDate =
      params.closedAt instanceof Date
        ? params.closedAt
        : new Date(params.closedAt);

    const payload: ShiftDifferenceRequestedPayload = {
      shiftNumber: params.shiftNumber,
      closedAt: closedAtDate.toISOString(),
      cashDifference: diff,
      ...(params.entryDate ? { entryDate: params.entryDate } : {}),
    };

    const record = await tx.accountingOutbox.upsert({
      where: {
        aggregateType_aggregateId: {
          aggregateType: 'pos_shift',
          aggregateId: params.shiftId,
        },
      },
      create: {
        aggregateType: 'pos_shift',
        aggregateId: params.shiftId,
        businessDate: closedAtDate,
        referenceCode: `Turno #${params.shiftNumber}`,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
      update: {},
      select: { id: true },
    });

    return { id: record.id };
  }

  async enqueuePurchaseInTx(
    tx: Prisma.TransactionClient,
    params: {
      movementId?: string;
      itemType: InventoryPurchaseRequestedPayload['itemType'];
      itemId: string;
      itemName: string;
      quantity: number;
      unit: string;
      totalCost: number;
      hasInvoice: boolean;
      paymentMethod: string;
      occurredAt?: Date | string;
      notes?: string;
    },
  ): Promise<{ id: string }> {
    const occurredAtDate = params.occurredAt
      ? params.occurredAt instanceof Date
        ? params.occurredAt
        : new Date(params.occurredAt)
      : new Date();
    const aggregateId = params.movementId ?? randomUUID();

    const payload: InventoryPurchaseRequestedPayload = {
      itemType: params.itemType,
      itemId: params.itemId,
      itemName: params.itemName,
      quantity: params.quantity,
      unit: params.unit,
      totalCost: roundMoney(params.totalCost),
      hasInvoice: params.hasInvoice,
      paymentMethod: params.paymentMethod,
      occurredAt: occurredAtDate.toISOString(),
      ...(params.notes ? { notes: params.notes } : {}),
    };

    const record = await tx.accountingOutbox.upsert({
      where: {
        aggregateType_aggregateId: {
          aggregateType: 'inventory_purchase',
          aggregateId,
        },
      },
      create: {
        aggregateType: 'inventory_purchase',
        aggregateId,
        businessDate: occurredAtDate,
        referenceCode: `Compra ${params.itemName}`,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
      update: {},
      select: { id: true },
    });

    return { id: record.id };
  }

  async enqueueProductionInTx(
    tx: Prisma.TransactionClient,
    params: {
      productionId?: string;
      recipeId: string;
      recipeName: string;
      productId: string;
      productName: string;
      batches: number;
      unitsProduced: number;
      totalCost: number;
      missingCostIngredients: InventoryProductionRequestedPayload['missingCostIngredients'];
      producedAt?: Date | string;
    },
  ): Promise<{ id: string }> {
    const producedAtDate = params.producedAt
      ? params.producedAt instanceof Date
        ? params.producedAt
        : new Date(params.producedAt)
      : new Date();
    const aggregateId = params.productionId ?? randomUUID();

    const payload: InventoryProductionRequestedPayload = {
      recipeId: params.recipeId,
      recipeName: params.recipeName,
      productId: params.productId,
      productName: params.productName,
      batches: params.batches,
      unitsProduced: params.unitsProduced,
      totalCost: roundMoney(params.totalCost),
      missingCostIngredients: params.missingCostIngredients,
      producedAt: producedAtDate.toISOString(),
    };

    const record = await tx.accountingOutbox.upsert({
      where: {
        aggregateType_aggregateId: {
          aggregateType: 'inventory_production',
          aggregateId,
        },
      },
      create: {
        aggregateType: 'inventory_production',
        aggregateId,
        businessDate: producedAtDate,
        referenceCode: `Producción ${params.productName}`,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
      update: {},
      select: { id: true },
    });

    return { id: record.id };
  }

  async enqueueInventoryAdjustmentInTx(
    tx: Prisma.TransactionClient,
    params: {
      movementId?: string;
      itemType: InventoryAdjustmentRequestedPayload['itemType'];
      itemId: string;
      itemName: string;
      reasonType: InventoryAdjustmentRequestedPayload['reasonType'];
      quantityDelta: number;
      unit: string;
      unitCost: number;
      totalCost: number;
      occurredAt?: Date | string;
      reason?: string;
    },
  ): Promise<{ id: string }> {
    const occurredAtDate = params.occurredAt
      ? params.occurredAt instanceof Date
        ? params.occurredAt
        : new Date(params.occurredAt)
      : new Date();
    const aggregateId = params.movementId ?? randomUUID();

    const payload: InventoryAdjustmentRequestedPayload = {
      itemType: params.itemType,
      itemId: params.itemId,
      itemName: params.itemName,
      reasonType: params.reasonType,
      quantityDelta: params.quantityDelta,
      unit: params.unit,
      unitCost: roundMoney(params.unitCost),
      totalCost: roundMoney(params.totalCost),
      occurredAt: occurredAtDate.toISOString(),
      ...(params.reason ? { reason: params.reason } : {}),
    };

    const record = await tx.accountingOutbox.upsert({
      where: {
        aggregateType_aggregateId: {
          aggregateType: 'inventory_adjustment',
          aggregateId,
        },
      },
      create: {
        aggregateType: 'inventory_adjustment',
        aggregateId,
        businessDate: occurredAtDate,
        referenceCode: `Ajuste ${params.itemName}`,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
      update: {},
      select: { id: true },
    });

    return { id: record.id };
  }

  async enqueueSaleCogsInTx(
    tx: Prisma.TransactionClient,
    params: {
      saleId: string;
      ticketNumber: string;
      soldAt: Date | string;
      items: PosSaleCogsRequestedPayload['items'];
    },
  ): Promise<{ id: string } | null> {
    if (!params.items || params.items.length === 0) {
      return null;
    }

    const soldAtDate =
      params.soldAt instanceof Date ? params.soldAt : new Date(params.soldAt);

    const payload: PosSaleCogsRequestedPayload = {
      ticketNumber: params.ticketNumber,
      soldAt: soldAtDate.toISOString(),
      items: params.items,
    };

    const record = await tx.accountingOutbox.upsert({
      where: {
        aggregateType_aggregateId: {
          aggregateType: 'pos_sale_cogs',
          aggregateId: params.saleId,
        },
      },
      create: {
        aggregateType: 'pos_sale_cogs',
        aggregateId: params.saleId,
        businessDate: soldAtDate,
        referenceCode: `COGS ${params.ticketNumber}`,
        payload: payload as unknown as Prisma.InputJsonValue,
        status: 'pending',
      },
      update: {},
      select: { id: true },
    });

    return { id: record.id };
  }

  async getPendingCount(): Promise<{ pendingCount: number }> {
    try {
      const pendingCount = await this.prisma.accountingOutbox.count({
        where: { status: 'pending' },
      });
      return { pendingCount };
    } catch {
      return { pendingCount: 0 };
    }
  }

  async getPendingEventsInRange(
    start: Date,
    end: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Array<{ id: string; businessDate: Date; aggregateType: string }>> {
    return db.accountingOutbox.findMany({
      where: {
        status: 'pending',
        businessDate: {
          gte: start,
          lte: end,
        },
      },
      select: {
        id: true,
        businessDate: true,
        aggregateType: true,
      },
    });
  }

  async countPendingInRange(
    start: Date,
    end: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    return db.accountingOutbox.count({
      where: {
        status: 'pending',
        businessDate: {
          gte: start,
          lte: end,
        },
      },
    });
  }

  async countPendingUpTo(
    cutoffEnd: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<number> {
    return db.accountingOutbox.count({
      where: {
        status: 'pending',
        businessDate: { lte: cutoffEnd },
      },
    });
  }

  async findEarliestPendingBefore(
    dateUtc: Date,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ referenceCode: string; businessDate: Date } | null> {
    return db.accountingOutbox.findFirst({
      where: {
        status: 'pending',
        businessDate: { lt: dateUtc },
      },
      orderBy: { businessDate: 'asc' },
      select: {
        referenceCode: true,
        businessDate: true,
      },
    });
  }

  async findPendingEvents(
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    return db.accountingOutbox.findMany({
      where: { status: 'pending' },
      orderBy: { businessDate: 'asc' },
    });
  }
}
