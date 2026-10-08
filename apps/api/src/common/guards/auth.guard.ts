import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service';

interface CachedAuthProfile {
  profile: { id: string; name: string; email?: string | null; role: string };
  expiresAt: number;
}

const tokenProfileCache = new Map<string, CachedAuthProfile>();

@Injectable()
export class AuthGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const supabaseUrl =
      this.configService.get<string>('VITE_SUPABASE_URL') ||
      this.configService.get<string>('SUPABASE_URL') ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('VITE_SUPABASE_ANON_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    this.supabase = createClient(supabaseUrl, supabaseKey);
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
          expiresAt: Date.now() + 60_000,
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
