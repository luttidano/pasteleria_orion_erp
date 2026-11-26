import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EntryService } from '../entries/entry.service';
import { AccountingOutboxService } from './accounting-outbox.service';
import type { AccountingEventHandler } from './handlers/accounting-event-handler.interface';
import { InventoryAccountingHandler } from './handlers/inventory-accounting.handler';
import { PurchaseAccountingHandler } from './handlers/purchase-accounting.handler';
import { SaleAccountingHandler } from './handlers/sale-accounting.handler';
import { ShiftAccountingHandler } from './handlers/shift-accounting.handler';
import type {
  InventoryAdjustmentRequestedPayload,
  InventoryProductionRequestedPayload,
  InventoryPurchaseRequestedPayload,
  OutboxAggregateType,
  OutboxProcessResult,
  OutboxSyncBatchResult,
  PosSaleCogsRequestedPayload,
  RecoveredSaleItemCost,
  SaleCogsEntryCreatedResult,
  SaleIncomeRequestedPayload,
  ShiftDifferenceRequestedPayload,
  SupplierPaymentRequestedPayload,
  SyncedSaleRef,
  SyncedShiftRef,
} from './accounting-outbox.types';

export class OutboxDeferredError extends Error {
  constructor(maxWaitMs: number) {
    super(
      `Sincronización contable diferida al worker en segundo plano (>${maxWaitMs}ms).`,
    );
    this.name = 'OutboxDeferredError';
  }
}

export function isOutboxDeferredError(
  error: unknown,
): error is OutboxDeferredError {
  return error instanceof OutboxDeferredError;
}

@Injectable()
export class AccountingOutboxProcessorService {
  private readonly handlers: AccountingEventHandler[];

  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: AccountingOutboxService,
    private readonly entryService: EntryService,
    @Optional() private readonly saleHandler?: SaleAccountingHandler,
    @Optional() private readonly shiftHandler?: ShiftAccountingHandler,
    @Optional() private readonly inventoryHandler?: InventoryAccountingHandler,
    @Optional() private readonly purchaseHandler?: PurchaseAccountingHandler,
  ) {
    const candidates: Array<AccountingEventHandler | undefined> = [
      this.saleHandler,
      this.shiftHandler,
      this.inventoryHandler,
      this.purchaseHandler,
    ];
    this.handlers = candidates.filter(
      (h): h is AccountingEventHandler => Boolean(h),
    );
  }

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

        const matchingHandler = this.handlers.find((h) =>
          h.supports(aggregateType),
        );

        if (matchingHandler) {
          const handlerResult = await matchingHandler.handle(
            {
              id: event.id,
              aggregateType,
              aggregateId: event.aggregateId,
              payload: event.payload,
            },
            tx,
          );
          createdEntry = handlerResult;
          if (
            aggregateType === 'pos_sale_cogs' &&
            handlerResult &&
            'recoveredItemCosts' in handlerResult
          ) {
            recoveredItemCosts = (
              handlerResult as SaleCogsEntryCreatedResult
            ).recoveredItemCosts;
          }
        } else if (aggregateType === 'pos_sale') {
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

      const updated = await this.prisma.accountingOutbox
        .update({
          where: { id: outboxId },
          data: {
            attempts: { increment: 1 },
            lastError: errorMsg.slice(0, 500),
          },
          select: { attempts: true },
        })
        .catch(() => null);

      if (updated && updated.attempts >= 5) {
        await this.prisma.accountingOutbox
          .update({
            where: { id: outboxId },
            data: { status: 'failed' },
          })
          .catch(() => undefined);
      }

      throw error;
    }
  }

  /**
   * Ejecuta processEvent con un presupuesto máximo de latencia en el hot path HTTP.
   * Si supera maxWaitMs, libera el request sin bloquear y deja que el worker
   * asíncrono o la promesa en curso completen la contabilización.
   */
  async processEventBestEffort(
    outboxId: string,
    maxWaitMs = 4500,
  ): Promise<OutboxProcessResult> {
    if (maxWaitMs <= 0) {
      return this.processEvent(outboxId);
    }

    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const processingPromise = this.processEvent(outboxId);
    processingPromise.catch(() => undefined);

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new OutboxDeferredError(maxWaitMs));
      }, maxWaitMs);
      if (typeof timeoutHandle.unref === 'function') {
        timeoutHandle.unref();
      }
    });

    try {
      return await Promise.race([processingPromise, timeoutPromise]);
    } finally {
      if (timeoutHandle !== undefined) {
        clearTimeout(timeoutHandle);
      }
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

export async function dispatchOutboxBestEffort(
  processor: Pick<AccountingOutboxProcessorService, 'processEvent'> &
    Partial<Pick<AccountingOutboxProcessorService, 'processEventBestEffort'>>,
  outboxId: string,
  maxWaitMs = 4500,
): Promise<OutboxProcessResult> {
  if (typeof processor.processEventBestEffort === 'function') {
    return processor.processEventBestEffort(outboxId, maxWaitMs);
  }
  return processor.processEvent(outboxId);
}
