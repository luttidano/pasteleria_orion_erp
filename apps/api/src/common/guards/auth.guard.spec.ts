import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import {
  AuthGuard,
  MAX_AUTH_CACHE_SIZE,
  clearAuthCache,
  invalidateUserCache,
  syncUserCache,
} from './auth.guard';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../../database/prisma.service';

function createJwtWithExp(expSeconds: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ sub: 'user-1', exp: expSeconds })).toString(
    'base64url',
  );
  return `${header}.${payload}.signature`;
}

function createHttpContext(authorization?: string): {
  context: ExecutionContext;
  request: { headers: Record<string, string | undefined>; user?: unknown };
} {
  const request: { headers: Record<string, string | undefined>; user?: unknown } = {
    headers: authorization !== undefined ? { authorization } : {},
  };
  const context = {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
  return { context, request };
}

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let getUserMock: AsyncMock;
  let profileMaybeSingleMock: AsyncMock;
  let profileUpsertMock: AsyncMock;
  let prisma: { isAvailable: boolean; profile: { findUnique: AsyncMock } };

  beforeEach(() => {
    clearAuthCache();
    getUserMock = jest.fn<(...args: any[]) => Promise<any>>();
    profileMaybeSingleMock = jest.fn<(...args: any[]) => Promise<any>>();
    profileUpsertMock = jest.fn<(...args: any[]) => Promise<any>>();

    const supabaseService = {
      client: {
        auth: {
          getUser: getUserMock,
        },
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: profileMaybeSingleMock,
            })),
          })),
          upsert: profileUpsertMock,
        })),
      },
    } as unknown as SupabaseService;

    prisma = {
      isAvailable: false,
      profile: {
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
      },
    };

    guard = new AuthGuard(supabaseService, prisma as unknown as PrismaService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    clearAuthCache();
  });

  it('debe rechazar peticiones sin header Bearer válido', async () => {
    await expect(guard.canActivate(createHttpContext(undefined).context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(createHttpContext('Basic abc').context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(createHttpContext('Bearer   ').context)).rejects.toThrow(
      UnauthorizedException,
    );
    await expect(guard.canActivate(createHttpContext('Bearer undefined').context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe usar el rol autoritativo de public.profile ignorando user_metadata.role', async () => {
    const token = createJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u-1',
          email: 'cajero@orion.cl',
          user_metadata: { name: 'Cajero', role: 'admin' },
        },
      },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: {
        id: 'u-1',
        name: 'Cajero Real',
        email: 'cajero@orion.cl',
        role: 'cashier',
      },
      error: null,
    });

    const { context, request } = createHttpContext(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({
      id: 'u-1',
      name: 'Cajero Real',
      email: 'cajero@orion.cl',
      role: 'cashier',
    });
    expect(profileUpsertMock).not.toHaveBeenCalled();
  });

  it('debe fallar cerrado (fail-closed) cuando el perfil no existe en PostgreSQL', async () => {
    const token = createJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    getUserMock.mockResolvedValue({
      data: {
        user: {
          id: 'u-missing',
          email: 'intruder@orion.cl',
          user_metadata: { role: 'admin' },
        },
      },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(guard.canActivate(createHttpContext(`Bearer ${token}`).context)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(profileUpsertMock).not.toHaveBeenCalled();
  });

  it('debe rechazar usuarios cuyo rol en public.profile sea inactivo ("user")', async () => {
    const token = createJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u-inactive', email: 'nuevo@orion.cl' } },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: { id: 'u-inactive', name: 'Pendiente', email: 'nuevo@orion.cl', role: 'user' },
      error: null,
    });

    await expect(guard.canActivate(createHttpContext(`Bearer ${token}`).context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('debe usar Prisma solo cuando Supabase REST falla técnicamente y fallar si tampoco existe', async () => {
    prisma.isAvailable = true;
    const token = createJwtWithExp(Math.floor(Date.now() / 1000) + 3600);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u-prisma', email: 'baker@orion.cl' } },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: null,
      error: { message: 'Edge timeout' },
    });
    prisma.profile.findUnique.mockResolvedValue({
      id: 'u-prisma',
      name: 'Pastelero',
      email: 'baker@orion.cl',
      role: 'baker',
    });

    const { context, request } = createHttpContext(`Bearer ${token}`);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toMatchObject({ id: 'u-prisma', role: 'baker' });
  });

  it('debe respetar el claim exp del JWT para expirar la caché y reflejar invalidateUserCache / syncUserCache', async () => {
    const baseNowMs = 1_700_000_000_000;
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(baseNowMs);
    const shortLivedToken = createJwtWithExp(Math.floor(baseNowMs / 1000) + 5);

    getUserMock.mockResolvedValue({
      data: { user: { id: 'u-cache', email: 'a@orion.cl' } },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: { id: 'u-cache', name: 'Original', email: 'a@orion.cl', role: 'cashier' },
      error: null,
    });

    await guard.canActivate(createHttpContext(`Bearer ${shortLivedToken}`).context);
    expect(getUserMock).toHaveBeenCalledTimes(1);

    // Cache hit dentro de los 5s
    syncUserCache('u-cache', { role: 'admin', name: 'Promovido' });
    const second = createHttpContext(`Bearer ${shortLivedToken}`);
    await guard.canActivate(second.context);
    expect(getUserMock).toHaveBeenCalledTimes(1);
    expect(second.request.user).toMatchObject({ role: 'admin', name: 'Promovido' });

    // Avanza más allá de exp (5s): aunque AUTH_CACHE_TTL_MS son 10m, debe revalidar
    nowSpy.mockReturnValue(baseNowMs + 6000);
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'JWT expired' },
    });
    await expect(
      guard.canActivate(createHttpContext(`Bearer ${shortLivedToken}`).context),
    ).rejects.toThrow(UnauthorizedException);
    expect(getUserMock).toHaveBeenCalledTimes(2);

    // Nueva sesión válida e invalidación inmediata
    const freshToken = createJwtWithExp(Math.floor((baseNowMs + 6000) / 1000) + 3600);
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u-cache', email: 'a@orion.cl' } },
      error: null,
    });
    await guard.canActivate(createHttpContext(`Bearer ${freshToken}`).context);
    invalidateUserCache('u-cache');
    await guard.canActivate(createHttpContext(`Bearer ${freshToken}`).context);
    expect(getUserMock).toHaveBeenCalledTimes(4);
  });

  it('debe acotar el tamaño máximo de la caché en memoria (MAX_AUTH_CACHE_SIZE)', async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 3600;
    getUserMock.mockResolvedValue({
      data: { user: { id: 'u-bounded', email: 'b@orion.cl' } },
      error: null,
    });
    profileMaybeSingleMock.mockResolvedValue({
      data: { id: 'u-bounded', name: 'User', email: 'b@orion.cl', role: 'baker' },
      error: null,
    });

    const firstToken = createJwtWithExp(futureExp) + '-0';
    // Token 0 será cacheado primero (usemos token opaco con formato único para probar claves distintas)
    await guard.canActivate(createHttpContext('Bearer token-0').context);
    for (let i = 1; i <= MAX_AUTH_CACHE_SIZE; i++) {
      await guard.canActivate(createHttpContext(`Bearer token-${i}`).context);
    }

    // `token-0` fue desalojado al superarse MAX_AUTH_CACHE_SIZE -> debe reconsultar a Supabase Auth
    const callsBefore = getUserMock.mock.calls.length;
    await guard.canActivate(createHttpContext('Bearer token-0').context);
    expect(getUserMock.mock.calls.length).toBe(callsBefore + 1);
    expect(firstToken).toBeDefined();
  });
});
