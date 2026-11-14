import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  invalidateUserCache,
  syncUserCache,
} from '../../common/guards/auth.guard';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async findAll() {
    const { data, error } = await this.supabase
      .from('profile')
      .select('id, name, email, role, avatar_url, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      this.logger.error(`Error listando usuarios: ${error.message}`);
      throw new InternalServerErrorException('No se pudo obtener la lista de usuarios.');
    }

    return (data || []).map((p) => ({
      id: p.id,
      name: p.name,
      email: p.email,
      role: p.role,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
    }));
  }

  async create(dto: CreateUserDto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanName = dto.name.trim();
    const cleanPass = dto.password?.trim() || '';

    if (!cleanName) {
      throw new BadRequestException('El nombre es obligatorio.');
    }

    if (cleanPass.length < 8) {
      throw new BadRequestException('La contraseña inicial debe tener al menos 8 caracteres.');
    }

    // 1. Crear en auth.users con Supabase Admin (sin almacenar rol autoritativo en user_metadata)
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPass,
      email_confirm: true,
      user_metadata: {
        name: cleanName,
      },
    });

    if (authError) {
      this.logger.warn(`Fallo al crear cuenta en Supabase Auth (${cleanEmail}): ${authError.message}`);
      const lowerMsg = authError.message.toLowerCase();
      if (lowerMsg.includes('already') || lowerMsg.includes('registered') || lowerMsg.includes('exists')) {
        throw new BadRequestException('Este correo electrónico ya está registrado.');
      }
      throw new BadRequestException('No se pudo crear la cuenta de acceso en autenticación.');
    }

    if (!authData.user) {
      throw new InternalServerErrorException('No se pudo generar la cuenta en Supabase Auth.');
    }

    // 2. Insertar / Actualizar perfil autoritativo en public.profile
    const { data: profile, error: profError } = await this.supabase
      .from('profile')
      .upsert({
        id: authData.user.id,
        name: cleanName,
        email: cleanEmail,
        role: dto.role,
      })
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (profError) {
      this.logger.error(
        `Error creando public.profile para ${authData.user.id}, compensando en auth.users: ${profError.message}`,
      );
      const { error: rollbackError } = await this.supabase.auth.admin.deleteUser(authData.user.id);
      if (rollbackError) {
        this.logger.error(
          `CRITICAL: falló la compensación deleteUser(${authData.user.id}): ${rollbackError.message}`,
        );
      }
      throw new InternalServerErrorException('No se pudo crear el perfil del usuario.');
    }

    return {
      id: authData.user.id,
      name: profile?.name || cleanName,
      email: profile?.email || cleanEmail,
      role: profile?.role || dto.role,
      createdAt: profile?.created_at || new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const payload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) {
      const cleanName = dto.name.trim();
      if (!cleanName) {
        throw new BadRequestException('El nombre no puede quedar vacío.');
      }
      payload.name = cleanName;
    }
    if (dto.role !== undefined) {
      payload.role = dto.role;
    }

    // 1. Actualizar tabla autoritativa public.profile
    const { data: profile, error } = await this.supabase
      .from('profile')
      .update(payload)
      .eq('id', id)
      .select('id, name, email, role, created_at, updated_at')
      .single();

    if (error || !profile) {
      if (error?.code === 'PGRST116') {
        throw new NotFoundException('Usuario no encontrado.');
      }
      this.logger.error(`Error actualizando usuario ${id}: ${error?.message || 'sin datos'}`);
      throw new BadRequestException('No se pudo actualizar el perfil del usuario.');
    }

    // 2. Sincronizar solo display name en metadatos de Auth (el rol vive exclusivamente en public.profile)
    if (dto.name !== undefined) {
      try {
        const { error: metaError } = await this.supabase.auth.admin.updateUserById(id, {
          user_metadata: { name: profile.name },
        });
        if (metaError) {
          this.logger.warn(`No se pudo sincronizar nombre en auth.users(${id}): ${metaError.message}`);
        }
      } catch (e) {
        this.logger.warn(
          `Excepción sincronizando metadatos de Auth para ${id}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      }
    }

    // 3. Sincronizar caché en caliente de AuthGuard
    syncUserCache(profile.id, {
      name: profile.name,
      role: profile.role,
      email: profile.email ?? null,
    });

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      createdAt: profile.created_at,
      updatedAt: profile.updated_at,
    };
  }

  async remove(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException(
        'No puedes revocar el acceso a tu propia cuenta de Administrador.',
      );
    }

    const { data: existingProfile, error: lookupError } = await this.supabase
      .from('profile')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (lookupError) {
      this.logger.error(`Error verificando usuario ${id}: ${lookupError.message}`);
      throw new InternalServerErrorException('No se pudo verificar el usuario a eliminar.');
    }

    // 1. Revocar primero en Supabase Auth (auth.users); cascade elimina public.profile
    const { error: authError } = await this.supabase.auth.admin.deleteUser(id);
    if (authError) {
      const isNotFound =
        authError.status === 404 ||
        authError.message.toLowerCase().includes('not found');
      if (isNotFound && !existingProfile) {
        throw new NotFoundException('Usuario no encontrado.');
      }
      if (!isNotFound) {
        this.logger.error(`Error eliminando usuario ${id} de auth.users: ${authError.message}`);
        throw new InternalServerErrorException(
          'No se pudo eliminar la cuenta de autenticación del usuario.',
        );
      }
      this.logger.warn(`Usuario ${id} no existía en auth.users; limpiando perfil residual.`);
    }

    // 2. Limpieza explícita/idempotente de public.profile
    const { error: profError } = await this.supabase
      .from('profile')
      .delete()
      .eq('id', id);

    if (profError) {
      this.logger.error(`Error eliminando public.profile(${id}): ${profError.message}`);
      throw new InternalServerErrorException(
        'No se pudo completar la eliminación del perfil en base de datos.',
      );
    }

    // 3. Invalidar de inmediato cualquier token cacheado del usuario eliminado
    invalidateUserCache(id);

    return {
      success: true,
      message: 'Usuario eliminado exitosamente de la base de datos.',
      id,
    };
  }
}
