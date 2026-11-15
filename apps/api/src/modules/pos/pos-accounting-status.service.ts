import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import type {
  RecoveredSaleItemCost,
  SyncedSaleRef,
  SyncedShiftRef,
} from '../accounting/outbox/accounting-outbox.types';

@Injectable()
export class PosAccountingStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async markSalePosted(saleId: string): Promise<void> {
    await this.prisma.posSale.updateMany({
      where: {
        id: saleId,
        accountingStatus: { not: 'posted' },
      },
      data: {
        accountingStatus: 'posted',
        accountingError: null,
      },
    });
  }

  async markSalePending(saleId: string, errorMessage: string): Promise<void> {
    await this.prisma.posSale.updateMany({
      where: { id: saleId },
      data: {
        accountingStatus: 'pending',
        accountingError: errorMessage.slice(0, 500),
      },
    });
  }

  async markShiftPosted(
    shiftId: string,
    closingEntryId: string | null,
  ): Promise<void> {
    await this.prisma.posShift.updateMany({
      where: { id: shiftId },
      data: {
        accountingStatus: 'posted',
        ...(closingEntryId ? { closingEntryId } : {}),
        accountingWarning: null,
      },
    });
  }

  async markShiftPending(
    shiftId: string,
    warningMessage: string,
  ): Promise<void> {
    await this.prisma.posShift.updateMany({
      where: { id: shiftId },
      data: {
        accountingStatus: 'pending',
        accountingWarning: warningMessage.slice(0, 500),
      },
    });
  }

  async applyRecoveredItemCosts(
    recoveredItemCosts: RecoveredSaleItemCost[],
  ): Promise<void> {
    if (recoveredItemCosts.length === 0) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      for (const item of recoveredItemCosts) {
        if (!item.saleItemId || item.unitCost <= 0) {
          continue;
        }
        await tx.posSaleItem.updateMany({
          where: {
            id: item.saleItemId,
            unitCost: { lte: 0 },
          },
          data: {
            unitCost: item.unitCost,
          },
        });
      }
    });
  }

  async applySyncResults(
    syncedSales: SyncedSaleRef[],
    syncedShifts: SyncedShiftRef[],
    recoveredItemCosts: RecoveredSaleItemCost[] = [],
  ): Promise<void> {
    if (
      syncedSales.length === 0 &&
      syncedShifts.length === 0 &&
      recoveredItemCosts.length === 0
    ) {
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      if (syncedSales.length > 0) {
        await tx.posSale.updateMany({
          where: {
            id: { in: syncedSales.map((s) => s.saleId) },
            accountingStatus: { not: 'posted' },
          },
          data: {
            accountingStatus: 'posted',
            accountingError: null,
          },
        });
      }

      for (const shift of syncedShifts) {
        await tx.posShift.updateMany({
          where: { id: shift.shiftId },
          data: {
            accountingStatus: 'posted',
            ...(shift.entryId ? { closingEntryId: shift.entryId } : {}),
            accountingWarning: null,
          },
        });
      }

      for (const item of recoveredItemCosts) {
        if (!item.saleItemId || item.unitCost <= 0) {
          continue;
        }
        await tx.posSaleItem.updateMany({
          where: {
            id: item.saleItemId,
            unitCost: { lte: 0 },
          },
          data: {
            unitCost: item.unitCost,
          },
        });
      }
    });
  }
}

