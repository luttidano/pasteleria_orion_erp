import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '../enums';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Fail-closed: toda ruta protegida por RolesGuard debe declarar explícitamente @Roles(...)
    if (!requiredRoles || requiredRoles.length === 0) {
      throw new ForbiddenException('Access denied: route role policy is not configured');
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.role) {
      throw new ForbiddenException('User has no role assigned');
    }

    const hasPermission = requiredRoles.includes(user.role as Role);

    if (!hasPermission) {
      throw new ForbiddenException('No tienes permisos suficientes para realizar esta acción.');
    }

    return true;
  }
}
