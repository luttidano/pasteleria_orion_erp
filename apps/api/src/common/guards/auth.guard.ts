import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { PrismaService } from '../../database/prisma.service';

interface CachedAuthProfile {
  profile: { id: string; name: string; email?: string | null; role: string };
  expiresAt: number;
}

export const AUTH_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutos para navegación ultrarrápida (0ms)
const tokenProfileCache = new Map<string, CachedAuthProfile>();

/**
 * Sincroniza en caliente el perfil en caché cuando un administrador modifica los datos de un usuario (ej. rol o nombre)
 */
export function syncUserCache(
  userId: string,
  updates: Partial<{ role: string; name: string; email: string | null }>,
) {
  for (const [, cached] of tokenProfileCache.entries()) {
    if (cached.profile.id === userId) {
      cached.profile = {
        ...cached.profile,
        ...updates,
      };
      cached.expiresAt = Date.now() + AUTH_CACHE_TTL_MS;
    }
  }
}

/**
 * Invalida inmediatamente las sesiones en caché cuando un usuario es eliminado o bloqueado
 */
export function invalidateUserCache(userId: string) {
  for (const [token, cached] of tokenProfileCache.entries()) {
    if (cached.profile.id === userId) {
      tokenProfileCache.delete(token);
    }
  }
}

/**
 * Limpia toda la caché de autenticación en memoria
 */
export function clearAuthCache() {
  tokenProfileCache.clear();
}

@Injectable()
export class AuthGuard implements CanActivate {
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
      console.warn('[AuthGuard] Missing or malformed authorization header');
      throw new UnauthorizedException('No authentication token provided');
    }

    const token = authHeader.split(' ')[1]?.trim();

    if (!token || token === 'undefined' || token === 'null') {
      console.warn('[AuthGuard] Empty or invalid token string received');
      throw new UnauthorizedException('No authentication token provided');
    }

    // Retorno ultrarrápido si el token ya fue validado recientemente en memoria (0ms)
    const cached = tokenProfileCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      request.user = cached.profile;
      return true;
    }

    try {
      const { data, error } = await this.supabase.auth.getUser(token);

      if (error || !data.user) {
        tokenProfileCache.delete(token);
        console.error('[AuthGuard] Supabase getUser failed:', error?.message);
        throw new UnauthorizedException(error?.message || 'Invalid or expired authentication token');
      }

      // Obtener el perfil real de PostgreSQL con su rol asignado
      let profile: { id: string; name: string; email?: string | null; role: string } | null = null;

      // 1. Intentar consulta directa vía Supabase Client (HTTPS edge, inmune a restricciones de red IPv6)
      try {
        const { data: sbProfile } = await this.supabase
          .from('profile')
          .select('id, name, email, role')
          .eq('id', data.user.id)
          .maybeSingle();

        if (sbProfile) {
          profile = sbProfile;
        }
      } catch (e) {
        console.warn('[AuthGuard] Error al consultar perfil vía Supabase REST:', e);
      }

      // 2. Fallback a Prisma si Supabase client no respondió
      if (!profile && this.prisma.isAvailable) {
        try {
          profile = await this.prisma.profile.findUnique({
            where: { id: data.user.id },
          });
        } catch {
          // Ignorar fallo de conexión directa a BD
        }
      }

      // 3. Si no existe en la tabla profile, crear o sincronizar registro base
      if (!profile) {
        console.log('[AuthGuard] Profile not found, creating base profile for user:', data.user.id);
        const fallbackRole = (data.user.user_metadata?.role as string) || 'baker';
        const newProfile = {
          id: data.user.id,
          name: data.user.user_metadata?.name || data.user.email?.split('@')[0] || 'User',
          email: data.user.email || null,
          role: fallbackRole,
        };

        try {
          const { data: created } = await this.supabase
            .from('profile')
            .upsert(newProfile)
            .select()
            .maybeSingle();
          profile = created || newProfile;
        } catch {
          profile = newProfile;
        }
      }

      if (profile) {
        tokenProfileCache.set(token, {
          profile,
          expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
        });
      }

      request.user = profile;
      return true;
    } catch (err) {
      console.error('[AuthGuard] Unexpected error in canActivate:', err);
      if (err instanceof UnauthorizedException) throw err;
      throw new UnauthorizedException(
        err instanceof Error ? `Auth error: ${err.message}` : 'Authentication verification failed',
      );
    }
  }
}
