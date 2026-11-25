import {
  BadRequestException,
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  InternalServerErrorException,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { createHash } from 'crypto';
import { Observable, from, of, throwError } from 'rxjs';
import { catchError, concatMap } from 'rxjs/operators';
import { PrismaService } from '../../database/prisma.service';
import { isUniqueViolation } from '../utils/prisma-error.util';
import {
  type IdempotencyExecutionContext,
  runWithIdempotencyContext,
  toPrismaJsonValue,
} from '../idempotency/idempotency-context';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const IDEMPOTENCY_KEY_MAX_LEN = 128;
const IDEMPOTENCY_KEY_REGEX = /^[A-Za-z0-9._:-]+$/;
const COMPLETED_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_PROCESSING_MS = 5 * 60 * 1000;

function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeValue(item));
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      const prop = obj[key];
      if (prop !== undefined) {
        sorted[key] = canonicalizeValue(prop);
      }
    }
    return sorted;
  }
  return value;
}

function hashRequestPayload(body: unknown, query: unknown): string {
  const canonical = canonicalizeValue({
    body: body ?? null,
    query: query ?? null,
  });
  return createHash('sha256')
    .update(JSON.stringify(canonical))
    .digest('hex');
}

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<any>();
    const res = http.getResponse<any>();

    const method = String(req?.method ?? '').toUpperCase();
    if (!MUTATING_METHODS.has(method)) {
      return next.handle();
    }

    const rawHeader = req?.headers?.['idempotency-key'];
    if (rawHeader === undefined || rawHeader === null) {
      throw new BadRequestException(
        'El encabezado Idempotency-Key es obligatorio para esta operación.',
      );
    }

    if (Array.isArray(rawHeader)) {
      throw new BadRequestException(
        'Solo se permite un encabezado Idempotency-Key por solicitud.',
      );
    }

    const idempotencyKey = String(rawHeader).trim();
    if (
      !idempotencyKey ||
      idempotencyKey.length > IDEMPOTENCY_KEY_MAX_LEN ||
      !IDEMPOTENCY_KEY_REGEX.test(idempotencyKey)
    ) {
      throw new BadRequestException(
        'Encabezado Idempotency-Key inválido (usa entre 1 y 128 caracteres alfanuméricos, ".", "_", ":" o "-").',
      );
    }

    const actorKey = req?.user?.id
      ? `user:${req.user.id}`
      : `anon:${req?.ip ?? 'unknown'}`;
    const rawUrl = String(req?.originalUrl || req?.url || req?.path || '/');
    const route = rawUrl.split('?')[0] || '/';
    const requestHash = hashRequestPayload(req?.body, req?.query);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + COMPLETED_TTL_MS);

    // Limpieza oportunista acotada al actor actual para evitar crecimiento sin límite
    await this.prisma.idempotencyRecord
      .deleteMany({
        where: {
          actorKey,
          expiresAt: { lt: now },
        },
      })
      .catch(() => undefined);

    const reservation = await this.reserveSlot({
      idempotencyKey,
      actorKey,
      method,
      route,
      requestHash,
      now,
      expiresAt,
    });

    if (reservation.kind === 'replay') {
      if (typeof res?.status === 'function') {
        res.status(reservation.statusCode);
      }
      if (typeof res?.setHeader === 'function') {
        res.setHeader('Idempotent-Replayed', 'true');
      }
      return of(reservation.responseBody);
    }

    const recordId = reservation.recordId;
    const defaultStatusCode =
      typeof res?.statusCode === 'number' && res.statusCode !== 200
        ? res.statusCode
        : method === 'POST'
          ? 201
          : 200;

    const executionStore: IdempotencyExecutionContext = {
      recordId,
      statusCode: defaultStatusCode,
      ttlMs: COMPLETED_TTL_MS,
      committedInTx: false,
    };

    return new Observable((subscriber) =>
      runWithIdempotencyContext(executionStore, () =>
        next
          .handle()
          .pipe(
            concatMap((responseData) => {
              const resolvedStatusCode =
                typeof res?.statusCode === 'number' && res.statusCode !== 200
                  ? res.statusCode
                  : method === 'POST'
                    ? 201
                    : 200;

              const updatePayload = {
                status: 'completed',
                statusCode: resolvedStatusCode,
                responseBody: toPrismaJsonValue(responseData),
                expiresAt: new Date(Date.now() + COMPLETED_TTL_MS),
              };

              return from(
                this.prisma.idempotencyRecord
                  .update({
                    where: { id: recordId },
                    data: updatePayload,
                  })
                  .catch(async (err) => {
                    console.error(
                      `[IdempotencyInterceptor] Error persistiendo estado completed para clave "${idempotencyKey}", reintentando:`,
                      err instanceof Error ? err.message : String(err),
                    );
                    try {
                      await this.prisma.idempotencyRecord.update({
                        where: { id: recordId },
                        data: updatePayload,
                      });
                    } catch (retryErr) {
                      console.error(
                        `[IdempotencyInterceptor] Reintento fallido para clave "${idempotencyKey}":`,
                        retryErr instanceof Error ? retryErr.message : String(retryErr),
                      );
                      if (executionStore.committedInTx) {
                        return;
                      }
                      throw new InternalServerErrorException(
                        'No se pudo registrar la confirmación de la operación idempotente en la base de datos.',
                      );
                    }
                  }),
              ).pipe(concatMap(() => of(responseData)));
            }),
            catchError((err) => {
              if (executionStore.committedInTx) {
                return throwError(() => err);
              }
              return from(
                this.prisma.idempotencyRecord
                  .deleteMany({
                    where: { id: recordId, status: 'processing' },
                  })
                  .catch(() => undefined),
              ).pipe(concatMap(() => throwError(() => err)));
            }),
          )
          .subscribe(subscriber),
      ),
    );
  }

  private async reserveSlot(params: {
    idempotencyKey: string;
    actorKey: string;
    method: string;
    route: string;
    requestHash: string;
    now: Date;
    expiresAt: Date;
  }): Promise<
    | { kind: 'acquired'; recordId: string }
    | { kind: 'replay'; statusCode: number; responseBody: unknown }
  > {
    const maxAttempts = 2;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const created = await this.prisma.idempotencyRecord.create({
          data: {
            idempotencyKey: params.idempotencyKey,
            actorKey: params.actorKey,
            method: params.method,
            route: params.route,
            requestHash: params.requestHash,
            status: 'processing',
            expiresAt: params.expiresAt,
          },
          select: { id: true },
        });
        return { kind: 'acquired', recordId: created.id };
      } catch (err) {
        if (!isUniqueViolation(err)) {
          throw err;
        }

        const existing = await this.prisma.idempotencyRecord.findUnique({
          where: {
            actorKey_method_route_idempotencyKey: {
              actorKey: params.actorKey,
              method: params.method,
              route: params.route,
              idempotencyKey: params.idempotencyKey,
            },
          },
        });

        if (!existing) {
          // La petición concurrente falló y liberó el bloqueo antes de nuestra lectura
          continue;
        }

        const currentTime = new Date();
        if (existing.expiresAt <= currentTime) {
          await this.prisma.idempotencyRecord
            .deleteMany({
              where: {
                id: existing.id,
                expiresAt: { lte: currentTime },
              },
            })
            .catch(() => undefined);
          continue;
        }

        if (existing.requestHash !== params.requestHash) {
          throw new ConflictException(
            'La clave Idempotency-Key ya fue utilizada con un payload diferente.',
          );
        }

        if (existing.status === 'processing') {
          const isStale =
            currentTime.getTime() - existing.updatedAt.getTime() >
            STALE_PROCESSING_MS;
          if (isStale) {
            await this.prisma.idempotencyRecord
              .deleteMany({
                where: { id: existing.id, status: 'processing' },
              })
              .catch(() => undefined);
            continue;
          }

          throw new ConflictException(
            'Esta operación ya se encuentra en proceso. Intenta nuevamente en unos segundos.',
          );
        }

        return {
          kind: 'replay',
          statusCode: existing.statusCode ?? 200,
          responseBody: existing.responseBody ?? null,
        };
      }
    }

    throw new ConflictException(
      'No se pudo adquirir la reserva de idempotencia para esta operación. Reintenta en un momento.',
    );
  }
}

