import { AsyncLocalStorage } from 'async_hooks';
import { Prisma } from '@prisma/client';

export interface IdempotencyExecutionContext {
  recordId: string;
  statusCode: number;
  ttlMs: number;
  committedInTx: boolean;
}

const idempotencyStorage =
  new AsyncLocalStorage<IdempotencyExecutionContext>();

export function runWithIdempotencyContext<T>(
  store: IdempotencyExecutionContext,
  fn: () => T,
): T {
  return idempotencyStorage.run(store, fn);
}

export function getIdempotencyContext():
  | IdempotencyExecutionContext
  | undefined {
  return idempotencyStorage.getStore();
}

export function toPrismaJsonValue(
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput {
  if (value === undefined || value === null) {
    return Prisma.JsonNull;
  }
  return JSON.parse(
    JSON.stringify(value, (_key, val) =>
      typeof val === 'bigint' ? Number(val) : val,
    ),
  ) as Prisma.InputJsonValue;
}
