import {
  BadRequestException,
  ConflictException,
  ExecutionContext,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { lastValueFrom, of, throwError } from 'rxjs';
import { IdempotencyInterceptor } from './idempotency.interceptor';

function createHttpContext(overrides: {
  method?: string;
  url?: string;
  headers?: Record<string, unknown>;
  body?: unknown;
  query?: unknown;
  userId?: string;
  statusCode?: number;
}): { context: ExecutionContext; res: any } {
  const res = {
    statusCode: overrides.statusCode ?? 201,
    status: jest.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    setHeader: jest.fn(),
  };

  const req = {
    method: overrides.method ?? 'POST',
    originalUrl: overrides.url ?? '/api/pos/sales',
    headers: overrides.headers ?? {},
    body: overrides.body ?? {},
    query: overrides.query ?? {},
    user: overrides.userId ? { id: overrides.userId } : { id: 'user-1' },
    ip: '127.0.0.1',
  };

  const context = {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ExecutionContext;

  return { context, res };
}

describe('IdempotencyInterceptor', () => {
  let interceptor: IdempotencyInterceptor;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      idempotencyRecord: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({ id: 'rec-1' }),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({ id: 'rec-1' }),
      },
    };
    interceptor = new IdempotencyInterceptor(prisma);
  });

  it('debe dejar pasar solicitudes GET sin crear registro de idempotencia', async () => {
    const getCtx = createHttpContext({
      method: 'GET',
      headers: { 'idempotency-key': 'k-1' },
    });
    const nextGet = { handle: jest.fn(() => of({ ok: true })) };
    const getObs = await interceptor.intercept(getCtx.context, nextGet);
    expect(await lastValueFrom(getObs)).toEqual({ ok: true });
    expect(prisma.idempotencyRecord.create).not.toHaveBeenCalled();
  });

  it('debe rechazar solicitudes mutantes sin encabezado Idempotency-Key', async () => {
    const postNoKeyCtx = createHttpContext({ method: 'POST', headers: {} });
    await expect(
      interceptor.intercept(postNoKeyCtx.context, { handle: jest.fn() }),
    ).rejects.toThrow(BadRequestException);

    const deleteNoKeyCtx = createHttpContext({ method: 'DELETE', headers: {} });
    await expect(
      interceptor.intercept(deleteNoKeyCtx.context, { handle: jest.fn() }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe rechazar encabezados Idempotency-Key inválidos o duplicados', async () => {
    const emptyKey = createHttpContext({
      headers: { 'idempotency-key': '   ' },
    });
    await expect(
      interceptor.intercept(emptyKey.context, { handle: jest.fn() }),
    ).rejects.toThrow(BadRequestException);

    const invalidChars = createHttpContext({
      headers: { 'idempotency-key': 'clave con espacios$' },
    });
    await expect(
      interceptor.intercept(invalidChars.context, { handle: jest.fn() }),
    ).rejects.toThrow(BadRequestException);

    const arrayHeader = createHttpContext({
      headers: { 'idempotency-key': ['a', 'b'] },
    });
    await expect(
      interceptor.intercept(arrayHeader.context, { handle: jest.fn() }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe registrar respuesta completed al primer intento y limpiar clave en error del handler', async () => {
    const ctx = createHttpContext({
      headers: { 'idempotency-key': 'uuid-sale-1' },
      body: { b: 2, a: 1 },
    });

    const obs = await interceptor.intercept(ctx.context, {
      handle: () => of({ id: 'sale-99', total: 1500 }),
    });
    const output = await lastValueFrom(obs);

    expect(output).toEqual({ id: 'sale-99', total: 1500 });
    expect(prisma.idempotencyRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idempotencyKey: 'uuid-sale-1',
          actorKey: 'user:user-1',
          method: 'POST',
          route: '/api/pos/sales',
          status: 'processing',
        }),
      }),
    );
    expect(prisma.idempotencyRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-1' },
        data: expect.objectContaining({
          status: 'completed',
          statusCode: 201,
          responseBody: { id: 'sale-99', total: 1500 },
        }),
      }),
    );

    const failCtx = createHttpContext({
      headers: { 'idempotency-key': 'uuid-fail-1' },
      body: { amount: 10 },
    });
    const failObs = await interceptor.intercept(failCtx.context, {
      handle: () => throwError(() => new BadRequestException('Falló negocio')),
    });
    await expect(lastValueFrom(failObs)).rejects.toThrow('Falló negocio');
    expect(prisma.idempotencyRecord.deleteMany).toHaveBeenCalledWith({
      where: { id: 'rec-1', status: 'processing' },
    });
  });

  it('debe reintentar la persistencia de completed y lanzar InternalServerErrorException si ambos fallan', async () => {
    prisma.idempotencyRecord.update
      .mockRejectedValueOnce(new Error('DB Timeout'))
      .mockRejectedValueOnce(new Error('DB Disconnect'));

    const ctx = createHttpContext({
      headers: { 'idempotency-key': 'uuid-retry-fail' },
      body: { action: 'test' },
    });

    const obs = await interceptor.intercept(ctx.context, {
      handle: () => of({ done: true }),
    });

    await expect(lastValueFrom(obs)).rejects.toThrow(InternalServerErrorException);
    expect(prisma.idempotencyRecord.update).toHaveBeenCalledTimes(2);
  });

  it('debe reproducir respuesta cacheada con Idempotent-Replayed cuando el hash canónico coincide', async () => {
    let capturedHash = '';
    prisma.idempotencyRecord.create.mockImplementationOnce(async (args: any) => {
      capturedHash = args.data.requestHash;
      return { id: 'rec-1' };
    });

    const firstCtx = createHttpContext({
      headers: { 'idempotency-key': 'uuid-replay-1' },
      body: { a: 1, nested: { y: 2, x: 1 } },
    });
    await lastValueFrom(
      await interceptor.intercept(firstCtx.context, {
        handle: () => of({ ok: true, seq: 1 }),
      }),
    );

    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });
    prisma.idempotencyRecord.create.mockRejectedValueOnce(p2002);
    prisma.idempotencyRecord.findUnique.mockResolvedValueOnce({
      id: 'rec-1',
      requestHash: capturedHash,
      status: 'completed',
      statusCode: 201,
      responseBody: { ok: true, seq: 1 },
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });

    // Mismo payload con distinto orden de propiedades -> hash canónico idéntico
    const replayCtx = createHttpContext({
      headers: { 'idempotency-key': 'uuid-replay-1' },
      body: { nested: { x: 1, y: 2 }, a: 1 },
      statusCode: 200,
    });
    const nextHandler = { handle: jest.fn(() => of({ seq: 999 })) };

    const replayObs = await interceptor.intercept(replayCtx.context, nextHandler);
    const replayRes = await lastValueFrom(replayObs);

    expect(nextHandler.handle).not.toHaveBeenCalled();
    expect(replayRes).toEqual({ ok: true, seq: 1 });
    expect(replayCtx.res.status).toHaveBeenCalledWith(201);
    expect(replayCtx.res.setHeader).toHaveBeenCalledWith(
      'Idempotent-Replayed',
      'true',
    );
  });

  it('debe lanzar ConflictException si la clave ya se usó con otro payload o sigue en processing', async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError('Unique', {
      code: 'P2002',
      clientVersion: '7.10.0',
    });

    prisma.idempotencyRecord.create.mockRejectedValueOnce(p2002);
    prisma.idempotencyRecord.findUnique.mockResolvedValueOnce({
      id: 'rec-other',
      requestHash: 'hash-distinto',
      status: 'completed',
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });

    const diffPayloadCtx = createHttpContext({
      headers: { 'idempotency-key': 'uuid-conflict-1' },
      body: { total: 5000 },
    });
    await expect(
      interceptor.intercept(diffPayloadCtx.context, { handle: jest.fn() }),
    ).rejects.toThrow(ConflictException);

    // Calcular hash exacto para probar conflicto en estado 'processing'
    let sameHash = '';
    prisma.idempotencyRecord.create.mockImplementationOnce(async (args: any) => {
      sameHash = args.data.requestHash;
      return { id: 'rec-seed' };
    });
    await interceptor.intercept(
      createHttpContext({
        headers: { 'idempotency-key': 'uuid-seed' },
        body: { total: 5000 },
      }).context,
      { handle: () => of({ ok: true }) },
    );

    prisma.idempotencyRecord.create.mockRejectedValueOnce(p2002);
    prisma.idempotencyRecord.findUnique.mockResolvedValueOnce({
      id: 'rec-proc',
      requestHash: sameHash,
      status: 'processing',
      expiresAt: new Date(Date.now() + 60_000),
      updatedAt: new Date(),
    });

    await expect(
      interceptor.intercept(
        createHttpContext({
          headers: { 'idempotency-key': 'uuid-conflict-2' },
          body: { total: 5000 },
        }).context,
        { handle: jest.fn() },
      ),
    ).rejects.toThrow(ConflictException);
  });
});

