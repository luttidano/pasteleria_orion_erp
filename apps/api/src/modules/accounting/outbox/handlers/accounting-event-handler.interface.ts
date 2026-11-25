import { Prisma } from '@prisma/client';
import type {
  AccountingEntryCreatedResult,
  OutboxAggregateType,
  SaleCogsEntryCreatedResult,
} from '../accounting-outbox.types';

export interface OutboxDispatchEvent {
  id: string;
  aggregateType: OutboxAggregateType;
  aggregateId: string;
  payload: unknown;
}

export type AccountingHandlerResult =
  | AccountingEntryCreatedResult
  | SaleCogsEntryCreatedResult
  | null;

/**
 * Contrato polimórfico para manejadores de eventos contables del Outbox (SRP / OCP).
 */
export interface AccountingEventHandler {
  supports(aggregateType: OutboxAggregateType): boolean;
  handle(
    event: OutboxDispatchEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingHandlerResult>;
}
