import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EntryService } from '../entries/entry.service';
import { AccountingOutboxService } from './accounting-outbox.service';
import type {
  InventoryAdjustmentRequestedPayload,
  InventoryProductionRequestedPayload,
  InventoryPurchaseRequestedPayload,
  OutboxAggregateType,
  OutboxProcessResult,
  OutboxSyncBatchResult,
  PosSaleCogsRequestedPayload,
  RecoveredSaleItemCost,
  SaleIncomeRequestedPayload,
  ShiftDifferenceRequestedPayload,
  SupplierPaymentRequestedPayload,
  SyncedSaleRef,
  SyncedShiftRef,
} from './accounting-outbox.types';

@Injectable()
export class AccountingOutboxProcessorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: AccountingOutboxService,
    private readonly entryService: EntryService,
  ) {}

  async processEvent(outboxId: string): Promise<OutboxProcessResult> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.accounting_outbox
          WHERE id = ${outboxId}::uuid
          FOR UPDATE
        `;

        const event = await tx.accountingOutbox.findUnique({
          where: { id: outboxId },
        });

        if (!event) {
          throw new NotFoundException(
            `El evento de salida contable "${outboxId}" no existe.`,
          );
        }

        const aggregateType = event.aggregateType as OutboxAggregateType;

        if (event.status === 'processed') {
          const existing = await tx.accountingEntry.findFirst({
            where:
              aggregateType === 'pos_sale'
                ? { posSaleId: event.aggregateId, status: 'active' }
                : aggregateType === 'pos_shift'
                  ? { posShiftId: event.aggregateId, status: 'active' }
                  : { outboxId: event.id, status: 'active' },
            select: { id: true, entryNumber: true },
          });

          return {
            outboxId: event.id,
            aggregateType,
            aggregateId: event.aggregateId,
            entryId: existing?.id ?? null,
            entryNumber: existing ? Number(existing.entryNumber) : null,
            alreadyProcessed: true,
          };
        }

        let createdEntry: { entryId: string; entryNumber: number } | null = null;
        let recoveredItemCosts: RecoveredSaleItemCost[] | undefined;

        if (aggregateType === 'pos_sale') {
          const payload =
            event.payload as unknown as SaleIncomeRequestedPayload;
          createdEntry = await this.entryService.registerSaleIncome(
            {
              id: event.aggregateId,
              ticketNumber: payload.ticketNumber,
              soldAt: payload.soldAt,
              total: Number(payload.total),
              paymentMethod: payload.paymentMethod,
            },
            tx,
          );
        } else if (aggregateType === 'pos_shift') {
          const payload =
            event.payload as unknown as ShiftDifferenceRequestedPayload;
          createdEntry =
            await this.entryService.registerShiftDifferenceAdjustment(
              {
                shiftId: event.aggregateId,
                shiftNumber: Number(payload.shiftNumber),
                closedAt: payload.closedAt,
                cashDifference: Number(payload.cashDifference),
                entryDate: payload.entryDate,
              },
              tx,
            );
        } else if (aggregateType === 'inventory_purchase') {
          const payload =
            event.payload as unknown as InventoryPurchaseRequestedPayload;
          createdEntry = await this.entryService.registerInventoryPurchase(
            event.id,
            payload,
            tx,
          );
        } else if (aggregateType === 'inventory_production') {
          const payload =
            event.payload as unknown as InventoryProductionRequestedPayload;
          createdEntry = await this.entryService.registerProductionTransfer(
            event.id,
            payload,
            tx,
          );
        } else if (aggregateType === 'inventory_adjustment') {
          const payload =
            event.payload as unknown as InventoryAdjustmentRequestedPayload;
          createdEntry = await this.entryService.registerInventoryAdjustment(
            event.id,
            payload,
            tx,
          );
        } else if (aggregateType === 'pos_sale_cogs') {
          const payload =
            event.payload as unknown as PosSaleCogsRequestedPayload;
          const cogsResult = await this.entryService.registerSaleCogs(
            event.id,
            payload,
            tx,
          );
          createdEntry = cogsResult;
          recoveredItemCosts = cogsResult?.recoveredItemCosts;
        } else if (aggregateType === 'supplier_payment') {
          const payload =
            event.payload as unknown as SupplierPaymentRequestedPayload;
          createdEntry = await this.entryService.registerSupplierPayment(
            event.id,
            payload,
            tx,
          );
        } else {
          throw new InternalServerErrorException(
            `Tipo de agregado no soportado en accounting_outbox: "${String(event.aggregateType)}".`,
          );
        }

        await tx.accountingOutbox.update({
          where: { id: event.id },
          data: {
            status: 'processed',
            processedAt: new Date(),
            lastError: null,
            attempts: { increment: 1 },
          },
        });

        return {
          outboxId: event.id,
          aggregateType,
          aggregateId: event.aggregateId,
          entryId: createdEntry?.entryId ?? null,
          entryNumber: createdEntry?.entryNumber ?? null,
          alreadyProcessed: false,
          ...(recoveredItemCosts?.length ? { recoveredItemCosts } : {}),
        };
      });
    } catch (error) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : 'Error procesando evento contable en outbox.';

      await this.prisma.accountingOutbox
        .update({
          where: { id: outboxId },
          data: {
            attempts: { increment: 1 },
            lastError: errorMsg.slice(0, 500),
          },
        })
        .catch(() => undefined);

      throw error;
    }
  }

  async syncPendingEvents(): Promise<OutboxSyncBatchResult> {
    const pendingEvents = await this.outboxService.findPendingEvents();

    let synced = 0;
    let failed = 0;
    const syncedSales: SyncedSaleRef[] = [];
    const syncedShifts: SyncedShiftRef[] = [];
    const recoveredItemCosts: RecoveredSaleItemCost[] = [];

    for (const event of pendingEvents) {
      try {
        const result = await this.processEvent(event.id);
        synced++;

        if (result.aggregateType === 'pos_sale') {
          syncedSales.push({
            saleId: result.aggregateId,
            entryId: result.entryId,
          });
        } else if (result.aggregateType === 'pos_shift') {
          syncedShifts.push({
            shiftId: result.aggregateId,
            entryId: result.entryId,
            entryNumber: result.entryNumber,
          });
        } else if (
          result.aggregateType === 'pos_sale_cogs' &&
          result.recoveredItemCosts?.length
        ) {
          recoveredItemCosts.push(...result.recoveredItemCosts);
        }
      } catch {
        failed++;
      }
    }

    return {
      synced,
      failed,
      syncedSales,
      syncedShifts,
      recoveredItemCosts,
    };
  }
}
