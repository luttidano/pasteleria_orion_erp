import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { PrismaService } from '../../database/prisma.service';
import { Role } from '../../common/enums';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  invalidateUserCache,
  syncUserCache,
} from '../../common/guards/auth.guard';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly prisma: PrismaService,
  ) {}

  private get supabase() {
    return this.supabaseService.client;
  }

  async findAll() {
    try {
      const data = await this.prisma.profile.findMany({
        orderBy: { createdAt: 'desc' },
      });

      return data.map((p) => ({
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        avatarUrl: p.avatarUrl,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));
    } catch (error) {
      this.logger.error(
        `Error listando usuarios desde Prisma: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new InternalServerErrorException('No se pudo obtener la lista de usuarios.');
    }
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

    // 2. Insertar / Actualizar perfil autoritativo en public.profile vía Prisma
    let profile: any;
    try {
      profile = await this.prisma.profile.upsert({
        where: { id: authData.user.id },
        create: {
          id: authData.user.id,
          name: cleanName,
          email: cleanEmail,
          role: dto.role,
        },
        update: {
          name: cleanName,
          email: cleanEmail,
          role: dto.role,
        },
      });
    } catch (profError: any) {
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
      createdAt: profile?.createdAt ? new Date(profile.createdAt).toISOString() : new Date().toISOString(),
    };
  }

  async update(id: string, dto: UpdateUserDto, currentAdminId?: string) {
    // 1. Validar que un administrador no se autodegrade a otro rol
    if (dto.role && dto.role !== Role.admin && id === currentAdminId) {
      throw new BadRequestException('No puedes degradar tu propia cuenta de Administrador a otro rol.');
    }

    // 2. Validar que no se degrade al único administrador activo
    if (dto.role && dto.role !== Role.admin) {
      const targetUser = await this.prisma.profile.findUnique({ where: { id } });
      if (!targetUser) {
        throw new NotFoundException('Usuario no encontrado.');
      }
      if (targetUser.role === Role.admin) {
        const adminCount = await this.prisma.profile.count({ where: { role: Role.admin } });
        if (adminCount <= 1) {
          throw new BadRequestException('No se puede degradar al único Administrador activo del sistema.');
        }
      }
    }

    const payload: { name?: string; role?: string } = {};
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

    let profile: any;
    try {
      profile = await this.prisma.profile.update({
        where: { id },
        data: payload,
      });
    } catch (error: any) {
      if (error?.code === 'P2025') {
        throw new NotFoundException('Usuario no encontrado.');
      }
      this.logger.error(`Error actualizando usuario ${id}: ${error?.message || String(error)}`);
      throw new BadRequestException('No se pudo actualizar el perfil del usuario.');
    }

    // 3. Sincronizar display name en metadatos de Auth si cambió el nombre
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

    // 4. Sincronizar caché en caliente de AuthGuard
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
      createdAt: profile.createdAt ? new Date(profile.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: profile.updatedAt ? new Date(profile.updatedAt).toISOString() : new Date().toISOString(),
    };
  }

  async remove(id: string, currentAdminId: string) {
    if (id === currentAdminId) {
      throw new BadRequestException(
        'No puedes revocar el acceso a tu propia cuenta de Administrador.',
      );
    }

    const existingProfile = await this.prisma.profile.findUnique({ where: { id } });

    if (existingProfile?.role === Role.admin) {
      const adminCount = await this.prisma.profile.count({ where: { role: Role.admin } });
      if (adminCount <= 1) {
        throw new BadRequestException('No se puede eliminar al único Administrador activo del sistema.');
      }
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

    // 2. Limpieza explícita/idempotente de public.profile vía Prisma
    try {
      await this.prisma.profile.delete({ where: { id } });
    } catch (profError: any) {
      if (profError?.code !== 'P2025') {
        this.logger.error(`Error eliminando public.profile(${id}): ${profError.message}`);
        throw new InternalServerErrorException(
          'No se pudo completar la eliminación del perfil en base de datos.',
        );
      }
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
