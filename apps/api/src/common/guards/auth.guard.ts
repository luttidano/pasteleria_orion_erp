import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '../enums';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

interface CachedAuthProfile {
  profile: AuthenticatedUser;
  expiresAt: number;
}

export const AUTH_CACHE_TTL_MS = 10 * 60 * 1000;
export const MAX_AUTH_CACHE_SIZE = 500;

const ACTIVE_ERP_ROLES = new Set<string>([Role.admin, Role.baker, Role.cashier]);
const tokenProfileCache = new Map<string, CachedAuthProfile>();

/**
 * Extrae el claim `exp` (en ms) de un JWT solo para limitar el tiempo de vida máximo en caché.
 * Nunca se usa para autenticar ni autorizar sin validar antes el token en Supabase Auth.
 */
function extractJwtExpirationMs(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) {
      return null;
    }
    const decoded = Buffer.from(parts[1], 'base64url').toString('utf8');
    const payload = JSON.parse(decoded) as { exp?: unknown };
    if (typeof payload.exp === 'number' && Number.isFinite(payload.exp)) {
      return payload.exp * 1000;
    }
    return null;
  } catch {
    return null;
  }
}

function setCachedProfile(
  token: string,
  profile: AuthenticatedUser,
  jwtExpMs: number | null,
): void {
  const now = Date.now();
  const maxAllowedExpiry = now + AUTH_CACHE_TTL_MS;
  const expiresAt =
    jwtExpMs !== null ? Math.min(maxAllowedExpiry, jwtExpMs) : maxAllowedExpiry;

  if (expiresAt <= now) {
    tokenProfileCache.delete(token);
    return;
  }

  for (const [cachedToken, entry] of tokenProfileCache.entries()) {
    if (entry.expiresAt <= now) {
      tokenProfileCache.delete(cachedToken);
    }
  }

  if (tokenProfileCache.has(token)) {
    tokenProfileCache.delete(token);
  } else if (tokenProfileCache.size >= MAX_AUTH_CACHE_SIZE) {
    const oldestKey = tokenProfileCache.keys().next().value;
    if (oldestKey !== undefined) {
      tokenProfileCache.delete(oldestKey);
    }
  }

  tokenProfileCache.set(token, { profile, expiresAt });
}

/**
 * Sincroniza en caliente el perfil en caché cuando un administrador modifica los datos de un usuario (ej. rol o nombre).
 */
export function syncUserCache(
  userId: string,
  updates: Partial<{ role: string; name: string; email: string | null }>,
): void {
  const now = Date.now();
  for (const [token, cached] of tokenProfileCache.entries()) {
    if (cached.profile.id !== userId) {
      continue;
    }

    const updatedRole = updates.role ?? cached.profile.role;
    if (!ACTIVE_ERP_ROLES.has(updatedRole) || cached.expiresAt <= now) {
      tokenProfileCache.delete(token);
      continue;
    }

    cached.profile = {
      ...cached.profile,
      ...updates,
    };
  }
}

/**
 * Invalida inmediatamente las sesiones en caché cuando un usuario es eliminado o bloqueado.
 */
export function invalidateUserCache(userId: string): void {
  for (const [token, cached] of tokenProfileCache.entries()) {
    if (cached.profile.id === userId) {
      tokenProfileCache.delete(token);
    }
  }
}

/**
 * Limpia toda la caché de autenticación en memoria.
 */
export function clearAuthCache(): void {
  tokenProfileCache.clear();
}

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      this.logger.warn('Missing or malformed authorization header');
      throw new UnauthorizedException('No authentication token provided');
    }

    const token = authHeader.slice(7).trim();

    if (!token || token === 'undefined' || token === 'null') {
      this.logger.warn('Empty or invalid bearer token received');
      throw new UnauthorizedException('No authentication token provided');
    }

    const now = Date.now();
    const cached = tokenProfileCache.get(token);
    if (cached) {
      if (cached.expiresAt > now) {
        request.user = cached.profile;
        return true;
      }
      tokenProfileCache.delete(token);
    }

    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error || !data?.user) {
        tokenProfileCache.delete(token);
        this.logger.warn(`Supabase auth.getUser rejected token: ${error?.message || 'missing user'}`);
        throw new UnauthorizedException('Invalid or expired authentication token');
      }

      let profile: AuthenticatedUser | null = null;
      let supabaseQueryFailed = false;

      // 1. Consultar perfil real autoritativo vía Supabase Client (service_role)
      try {
        const { data: sbProfile, error: sbError } = await this.supabase
          .from('profile')
          .select('id, name, email, role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (sbError) {
          supabaseQueryFailed = true;
          this.logger.warn(
            `Error consultando perfil vía Supabase REST para usuario ${data.user.id}: ${sbError.message}`,
          );
        } else if (sbProfile) {
          profile = {
            id: sbProfile.id,
            name: sbProfile.name,
            email: sbProfile.email ?? null,
            role: sbProfile.role,
          };
        }
      } catch (e) {
        supabaseQueryFailed = true;
        this.logger.warn(
          `Excepción consultando perfil vía Supabase REST para usuario ${data.user.id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }

      // 2. Fallback exclusivo ante falla técnica de Supabase REST cuando Prisma está disponible
      if (!profile && supabaseQueryFailed && this.prisma?.isAvailable) {
        try {
          const prismaProfile = await this.prisma.profile.findUnique({
            where: { id: data.user.id },
            select: { id: true, name: true, email: true, role: true },
          });
          if (prismaProfile) {
            profile = {
              id: prismaProfile.id,
              name: prismaProfile.name,
              email: prismaProfile.email ?? null,
              role: prismaProfile.role,
            };
          }
        } catch (e) {
          this.logger.warn(
            `Error en fallback Prisma consultando perfil ${data.user.id}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        }
      }

      // 3. Fail-closed: nunca sintetizar perfiles ni confiar en user_metadata.role
      if (!profile) {
        tokenProfileCache.delete(token);
        throw new UnauthorizedException('Perfil de usuario no encontrado o inactivo');
      }

      if (!ACTIVE_ERP_ROLES.has(profile.role)) {
        tokenProfileCache.delete(token);
        throw new UnauthorizedException('Usuario sin rol operativo autorizado en el ERP');
      }

      const jwtExpMs = extractJwtExpirationMs(token);
      setCachedProfile(token, profile, jwtExpMs);

      request.user = profile;
      return true;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        throw err;
      }
      this.logger.error(
        'Error inesperado validando autenticación',
        err instanceof Error ? err.stack : String(err),
      );
      throw new UnauthorizedException('Authentication verification failed');
    }
  }
}
