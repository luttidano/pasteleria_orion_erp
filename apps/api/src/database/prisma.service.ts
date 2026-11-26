import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  getIdempotencyContext,
  toPrismaJsonValue,
} from '../common/idempotency/idempotency-context';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public isAvailable = false;
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/dummy';

    // Pool para Supabase (Supavisor / PgBouncer)
    const pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 45000, // Mantiene conexiones tibias sin reabrir TCP/SSL en cada vista
      connectionTimeoutMillis: 10000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    // Evitar que socket cerrado lance excepción no capturada
    pool.on('error', (err) => {
      this.logger.warn(
        `Socket inactivo cerrado por el servidor remoto: ${err.message}`,
      );
    });

    const adapter = new PrismaPg(pool);
    super({ adapter });
    this.pool = pool;
  }

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    if (
      !connectionString ||
      connectionString.includes('[TU-PASSWORD]') ||
      connectionString.includes('tu-password')
    ) {
      this.isAvailable = false;
      this.logger.error(
        'DATABASE_URL no configurada o con valor placeholder. Las transacciones ACID con PostgreSQL no están operativas.',
      );
      return;
    }

    try {
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Prisma connection timeout (8s)')), 8000),
        ),
      ]);
      this.isAvailable = true;
      this.logger.log('Connected to PostgreSQL successfully via Prisma Pooler');
    } catch (err: unknown) {
      this.isAvailable = false;
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Conexión PostgreSQL no disponible (las operaciones ACID requieren base de datos conectada): ${msg}`,
      );
    }
  }

  async onModuleDestroy() {
    try {
      await this.$disconnect();
    } catch {
      // Ignorar si ya estaba desconectado
    }
    if (this.pool) {
      await this.pool.end();
    }
  }

  override $transaction<P extends Prisma.PrismaPromise<any>[]>(
    arg: [...P],
    options?: { isolationLevel?: Prisma.TransactionIsolationLevel },
  ): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  override $transaction<R>(
    fn: (prisma: Prisma.TransactionClient) => Promise<R>,
    options?: {
      maxWait?: number;
      timeout?: number;
      isolationLevel?: Prisma.TransactionIsolationLevel;
    },
  ): Promise<R>;
  override async $transaction(arg: any, options?: any): Promise<any> {
    if (typeof arg !== 'function') {
      return super.$transaction(arg, options);
    }

    const txOptions = {
      ...options,
      maxWait: options?.maxWait ?? 10000,
      timeout: options?.timeout ?? 15000,
    };

    const store = getIdempotencyContext();
    if (!store || store.committedInTx) {
      return super.$transaction(arg, txOptions);
    }

    const result = await super.$transaction(async (tx) => {
      const fnResult = await arg(tx);
      if (
        !store.committedInTx &&
        typeof (tx as any)?.idempotencyRecord?.updateMany === 'function'
      ) {
        await tx.idempotencyRecord.updateMany({
          where: { id: store.recordId, status: 'processing' },
          data: {
            status: 'completed',
            statusCode: store.statusCode,
            responseBody: toPrismaJsonValue(fnResult),
            expiresAt: new Date(Date.now() + store.ttlMs),
          },
        });
      }
      return fnResult;
    }, txOptions);

    store.committedInTx = true;
    return result;
  }
}
