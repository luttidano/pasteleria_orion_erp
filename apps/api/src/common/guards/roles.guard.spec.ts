import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums';

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

  it('debe fallar cerrado (ForbiddenException) si no existe metadata @Roles()', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(() => guard.canActivate(makeContext({ role: Role.admin }))).toThrow(
      ForbiddenException,
    );

    reflector.getAllAndOverride.mockReturnValue([]);
    expect(() => guard.canActivate(makeContext({ role: Role.admin }))).toThrow(
      ForbiddenException,
    );
  });

  it('debe denegar si falta user o no tiene rol asignado', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin]);
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(makeContext({}))).toThrow(ForbiddenException);
  });

  it('debe denegar cuando el rol del usuario no está autorizado para la ruta', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin]);
    expect(() => guard.canActivate(makeContext({ role: Role.cashier }))).toThrow(
      ForbiddenException,
    );
  });

  it('debe permitir acceso cuando el rol está autorizado', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.admin, Role.cashier]);
    expect(guard.canActivate(makeContext({ role: Role.cashier }))).toBe(true);
  });
});
