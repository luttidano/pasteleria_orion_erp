import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { Role } from '../../common/enums';
import { AuthGuard, clearAuthCache } from '../../common/guards/auth.guard';
import { PrismaService } from '../../database/prisma.service';

type AsyncMock = jest.Mock<(...args: any[]) => Promise<any>>;

describe('UsersService & CreateUserDto', () => {
  let service: UsersService;
  let createUserMock: AsyncMock;
  let deleteAuthUserMock: AsyncMock;
  let updateUserByIdMock: AsyncMock;
  let upsertProfileSingleMock: AsyncMock;
  let updateProfileSingleMock: AsyncMock;
  let lookupProfileMaybeSingleMock: AsyncMock;
  let deleteProfileEqMock: AsyncMock;
  let supabaseMock: any;

  beforeEach(() => {
    clearAuthCache();
    createUserMock = jest.fn<(...args: any[]) => Promise<any>>();
    deleteAuthUserMock = jest.fn<(...args: any[]) => Promise<any>>();
    updateUserByIdMock = jest.fn<(...args: any[]) => Promise<any>>();
    upsertProfileSingleMock = jest.fn<(...args: any[]) => Promise<any>>();
    updateProfileSingleMock = jest.fn<(...args: any[]) => Promise<any>>();
    lookupProfileMaybeSingleMock = jest.fn<(...args: any[]) => Promise<any>>();
    deleteProfileEqMock = jest.fn<(...args: any[]) => Promise<any>>();

    supabaseMock = {
      auth: {
        getUser: jest.fn(),
        admin: {
          createUser: createUserMock,
          deleteUser: deleteAuthUserMock,
          updateUserById: updateUserByIdMock,
        },
      },
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(),
          eq: jest.fn(() => ({
            maybeSingle: lookupProfileMaybeSingleMock,
          })),
        })),
        upsert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: upsertProfileSingleMock,
          })),
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: updateProfileSingleMock,
            })),
          })),
        })),
        delete: jest.fn(() => ({
          eq: deleteProfileEqMock,
        })),
      })),
    };

    service = new UsersService({ client: supabaseMock } as unknown as SupabaseService);
  });

  afterEach(() => {
    clearAuthCache();
  });

  describe('CreateUserDto ValidationPipe', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe exigir contraseña obligatoria con mínimo 8 caracteres y rol enum válido', async () => {
      await expect(
        pipe.transform(
          { name: 'Ana', email: 'ana@orion.cl', role: 'baker' },
          { type: 'body', metatype: CreateUserDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { name: 'Ana', email: 'ana@orion.cl', password: 'short', role: 'baker' },
          { type: 'body', metatype: CreateUserDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { name: 'Ana', email: 'ana@orion.cl', password: 'StrongPassword1', role: 'user' },
          { type: 'body', metatype: CreateUserDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const valid = await pipe.transform(
        {
          name: 'Ana Pastelera',
          email: 'ana@orion.cl',
          password: 'Password2026!',
          role: 'baker',
        },
        { type: 'body', metatype: CreateUserDto },
      );
      expect(valid).toBeInstanceOf(CreateUserDto);
      expect(valid.role).toBe(Role.baker);
    });
  });

  describe('create', () => {
    it('no debe guardar role en user_metadata ni usar contraseña por defecto y debe compensar ante falla de perfil', async () => {
      createUserMock.mockResolvedValue({
        data: { user: { id: 'new-usr-1' } },
        error: null,
      });
      upsertProfileSingleMock.mockResolvedValue({
        data: null,
        error: { message: 'constraint failed' },
      });
      deleteAuthUserMock.mockResolvedValue({ error: null });

      await expect(
        service.create({
          name: 'Pedro',
          email: 'pedro@orion.cl',
          password: 'MiClaveSegura123',
          role: Role.cashier,
        }),
      ).rejects.toThrow(InternalServerErrorException);

      expect(createUserMock).toHaveBeenCalledWith({
        email: 'pedro@orion.cl',
        password: 'MiClaveSegura123',
        email_confirm: true,
        user_metadata: {
          name: 'Pedro',
        },
      });
      expect(deleteAuthUserMock).toHaveBeenCalledWith('new-usr-1');
    });
  });

  describe('update & cache sync', () => {
    it('debe sincronizar en caliente syncUserCache al cambiar el rol sin escribir role en user_metadata', async () => {
      const authGuard = new AuthGuard(
        { client: supabaseMock } as unknown as SupabaseService,
        { isAvailable: false } as unknown as PrismaService,
      );

      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: 'usr-sync', email: 'sync@orion.cl' } },
        error: null,
      });
      lookupProfileMaybeSingleMock.mockResolvedValue({
        data: { id: 'usr-sync', name: 'Carlos', email: 'sync@orion.cl', role: 'cashier' },
        error: null,
      });

      const req: { headers: Record<string, string>; user?: unknown } = {
        headers: { authorization: 'Bearer cached-session-token' },
      };
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => req }),
      } as any);
      expect(req.user).toMatchObject({ role: 'cashier' });

      updateProfileSingleMock.mockResolvedValue({
        data: {
          id: 'usr-sync',
          name: 'Carlos Jefe',
          email: 'sync@orion.cl',
          role: 'admin',
          created_at: '2026-11-11T00:00:00Z',
          updated_at: '2026-11-11T01:00:00Z',
        },
        error: null,
      });
      updateUserByIdMock.mockResolvedValue({ error: null });

      await service.update('usr-sync', { name: 'Carlos Jefe', role: Role.admin });

      expect(updateUserByIdMock).toHaveBeenCalledWith('usr-sync', {
        user_metadata: { name: 'Carlos Jefe' },
      });

      const reqAfter: { headers: Record<string, string>; user?: unknown } = {
        headers: { authorization: 'Bearer cached-session-token' },
      };
      await authGuard.canActivate({
        switchToHttp: () => ({ getRequest: () => reqAfter }),
      } as any);
      expect(reqAfter.user).toMatchObject({ name: 'Carlos Jefe', role: 'admin' });
    });
  });

  describe('remove', () => {
    it('debe prohibir eliminarse a sí mismo', async () => {
      await expect(service.remove('admin-1', 'admin-1')).rejects.toThrow(BadRequestException);
      expect(deleteAuthUserMock).not.toHaveBeenCalled();
    });

    it('debe eliminar auth.users ANTES que profile y fallar sin devolver success si falla auth.admin.deleteUser', async () => {
      lookupProfileMaybeSingleMock.mockResolvedValue({ data: { id: 'target-1' }, error: null });
      deleteAuthUserMock.mockResolvedValue({
        error: { status: 500, message: 'Auth service unavailable' },
      });

      await expect(service.remove('target-1', 'admin-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(deleteProfileEqMock).not.toHaveBeenCalled();
    });

    it('debe eliminar en Auth + profile, invalidar la caché de AuthGuard y lanzar NotFoundException si no existe', async () => {
      lookupProfileMaybeSingleMock.mockResolvedValue({ data: null, error: null });
      deleteAuthUserMock.mockResolvedValue({
        error: { status: 404, message: 'User not found' },
      });
      await expect(service.remove('missing-id', 'admin-1')).rejects.toThrow(NotFoundException);

      // Eliminación exitosa con invalidación de caché
      const authGuard = new AuthGuard(
        { client: supabaseMock } as unknown as SupabaseService,
        { isAvailable: false } as unknown as PrismaService,
      );
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: { id: 'target-2', email: 'bye@orion.cl' } },
        error: null,
      });
      lookupProfileMaybeSingleMock.mockResolvedValue({
        data: { id: 'target-2', name: 'Ex', email: 'bye@orion.cl', role: 'baker' },
        error: null,
      });

      await authGuard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { authorization: 'Bearer victim-token' } }),
        }),
      } as any);

      deleteAuthUserMock.mockResolvedValue({ error: null });
      deleteProfileEqMock.mockResolvedValue({ error: null });

      const removed = await service.remove('target-2', 'admin-1');
      expect(removed).toMatchObject({ success: true, id: 'target-2' });

      // Tras invalidateUserCache, el token ya no puede reusar caché
      supabaseMock.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'User banned/deleted' },
      });
      await expect(
        authGuard.canActivate({
          switchToHttp: () => ({
            getRequest: () => ({ headers: { authorization: 'Bearer victim-token' } }),
          }),
        } as any),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
