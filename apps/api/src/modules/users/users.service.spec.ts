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
  let lookupProfileMaybeSingleMock: AsyncMock;
  let supabaseMock: any;
  let prismaMock: any;

  beforeEach(() => {
    clearAuthCache();
    createUserMock = jest.fn<(...args: any[]) => Promise<any>>();
    deleteAuthUserMock = jest.fn<(...args: any[]) => Promise<any>>();
    updateUserByIdMock = jest.fn<(...args: any[]) => Promise<any>>();
    lookupProfileMaybeSingleMock = jest.fn<(...args: any[]) => Promise<any>>();

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
      })),
    };

    prismaMock = {
      profile: {
        findMany: jest.fn<(...args: any[]) => Promise<any>>(),
        findUnique: jest.fn<(...args: any[]) => Promise<any>>(),
        count: jest.fn<(...args: any[]) => Promise<any>>(),
        upsert: jest.fn<(...args: any[]) => Promise<any>>(),
        update: jest.fn<(...args: any[]) => Promise<any>>(),
        delete: jest.fn<(...args: any[]) => Promise<any>>(),
      },
    };

    service = new UsersService(
      { client: supabaseMock } as unknown as SupabaseService,
      prismaMock as unknown as PrismaService,
    );
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

  describe('findAll', () => {
    it('debe retornar lista de usuarios desde Prisma con mapeo de campos', async () => {
      const now = new Date();
      prismaMock.profile.findMany.mockResolvedValue([
        {
          id: 'u-1',
          name: 'Ana',
          email: 'ana@orion.cl',
          role: 'baker',
          avatarUrl: null,
          createdAt: now,
          updatedAt: now,
        },
      ]);

      const result = await service.findAll();
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'u-1',
        name: 'Ana',
        email: 'ana@orion.cl',
        role: 'baker',
      });
      expect(prismaMock.profile.findMany).toHaveBeenCalledWith({
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('create', () => {
    it('no debe guardar role en user_metadata ni usar contraseña por defecto y debe compensar ante falla de perfil', async () => {
      createUserMock.mockResolvedValue({
        data: { user: { id: 'new-usr-1' } },
        error: null,
      });
      prismaMock.profile.upsert.mockRejectedValue(new Error('constraint failed'));
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

    it('debe crear exitosamente en Auth y luego en Prisma', async () => {
      createUserMock.mockResolvedValue({
        data: { user: { id: 'new-usr-2' } },
        error: null,
      });
      const now = new Date();
      prismaMock.profile.upsert.mockResolvedValue({
        id: 'new-usr-2',
        name: 'Carlos',
        email: 'carlos@orion.cl',
        role: Role.baker,
        createdAt: now,
        updatedAt: now,
      });

      const res = await service.create({
        name: 'Carlos',
        email: 'carlos@orion.cl',
        password: 'Password123!',
        role: Role.baker,
      });

      expect(res.id).toBe('new-usr-2');
      expect(res.name).toBe('Carlos');
      expect(prismaMock.profile.upsert).toHaveBeenCalled();
    });
  });

  describe('update & cache sync', () => {
    it('debe prohibir autodegradar la propia cuenta de administrador', async () => {
      await expect(
        service.update('admin-1', { role: Role.cashier }, 'admin-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe prohibir degradar al único administrador activo', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({ id: 'admin-1', role: Role.admin });
      prismaMock.profile.count.mockResolvedValue(1);

      await expect(
        service.update('admin-1', { role: Role.cashier }, 'other-caller'),
      ).rejects.toThrow(BadRequestException);
    });

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

      prismaMock.profile.findUnique.mockResolvedValue({ id: 'usr-sync', role: Role.cashier });
      prismaMock.profile.update.mockResolvedValue({
        id: 'usr-sync',
        name: 'Carlos Jefe',
        email: 'sync@orion.cl',
        role: 'admin',
        createdAt: new Date('2026-11-11T00:00:00Z'),
        updatedAt: new Date('2026-11-11T01:00:00Z'),
      });
      updateUserByIdMock.mockResolvedValue({ error: null });

      await service.update('usr-sync', { name: 'Carlos Jefe', role: Role.admin }, 'admin-boss');

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

    it('debe prohibir eliminar al único administrador activo', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({ id: 'admin-solo', role: Role.admin });
      prismaMock.profile.count.mockResolvedValue(1);

      await expect(service.remove('admin-solo', 'caller-id')).rejects.toThrow(BadRequestException);
      expect(deleteAuthUserMock).not.toHaveBeenCalled();
    });

    it('debe eliminar auth.users ANTES que profile y fallar sin devolver success si falla auth.admin.deleteUser', async () => {
      prismaMock.profile.findUnique.mockResolvedValue({ id: 'target-1', role: Role.baker });
      deleteAuthUserMock.mockResolvedValue({
        error: { status: 500, message: 'Auth service unavailable' },
      });

      await expect(service.remove('target-1', 'admin-1')).rejects.toThrow(
        InternalServerErrorException,
      );
      expect(prismaMock.profile.delete).not.toHaveBeenCalled();
    });

    it('debe eliminar en Auth + profile, invalidar la caché de AuthGuard y lanzar NotFoundException si no existe', async () => {
      prismaMock.profile.findUnique.mockResolvedValue(null);
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

      prismaMock.profile.findUnique.mockResolvedValue({ id: 'target-2', role: Role.baker });
      deleteAuthUserMock.mockResolvedValue({ error: null });
      prismaMock.profile.delete.mockResolvedValue({ id: 'target-2' });

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