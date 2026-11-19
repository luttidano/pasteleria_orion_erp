import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock<(...args: any[]) => any> };

  const makeContext = (user?: { role?: string }): ExecutionContext =>
    ({
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn<(...args: any[]) => any>(),
    };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('debe permitir acceso si la ruta está decorada con @Public()', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return true;
      return undefined;
    });

    expect(guard.canActivate(makeContext(undefined))).toBe(true);
  });

  it('debe fallar cerrado (ForbiddenException) si no existe metadata @Roles()', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      return undefined;
    });
    expect(() => guard.canActivate(makeContext({ role: Role.admin }))).toThrow(
      ForbiddenException,
    );

    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      return [];
    });
    expect(() => guard.canActivate(makeContext({ role: Role.admin }))).toThrow(
      ForbiddenException,
    );
  });

  it('debe denegar si falta user o no tiene rol asignado', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [Role.admin];
      return undefined;
    });
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('debe denegar cuando el rol del usuario no está autorizado para la ruta', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [Role.admin];
      return undefined;
    });
    expect(() => guard.canActivate(makeContext({ role: Role.cashier }))).toThrow(
      ForbiddenException,
    );
  });

  it('debe permitir acceso cuando el rol está autorizado', () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC_KEY) return false;
      if (key === ROLES_KEY) return [Role.admin, Role.cashier];
      return undefined;
    });
    expect(guard.canActivate(makeContext({ role: Role.cashier }))).toBe(true);
  });
});
