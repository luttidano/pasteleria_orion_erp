import {
  Injectable,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
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

  async findAll() {
    const { data, error } = await this.supabase
      .from('profile')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
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
    const cleanPass = dto.password?.trim() || 'Orion2026*';

    // 1. Crear en auth.users con Supabase Admin
    const { data: authData, error: authError } = await this.supabase.auth.admin.createUser({
      email: cleanEmail,
      password: cleanPass,
      email_confirm: true,
      user_metadata: {
        name: cleanName,
        role: dto.role,
      },
    });

    if (authError) {
      throw new BadRequestException(authError.message);
    }

    if (!authData.user) {
      throw new InternalServerErrorException('No se pudo generar la cuenta en Supabase Auth');
    }

    // 2. Insertar / Actualizar en tabla profile
    const { data: profile, error: profError } = await this.supabase
      .from('profile')
      .upsert({
        id: authData.user.id,
        name: cleanName,
        email: cleanEmail,
        role: dto.role,
      })
      .select()
      .single();

    if (profError) {
      console.warn('[UsersService] Error al crear profile:', profError.message);
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
    if (dto.name !== undefined) payload.name = dto.name.trim();
    if (dto.role !== undefined) payload.role = dto.role;

    // Actualizar tabla profile
    const { data: profile, error } = await this.supabase
      .from('profile')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }

    // Actualizar metadatos en Supabase Auth
    try {
      const metadataUpdates: Record<string, unknown> = {};
      if (dto.name !== undefined) metadataUpdates.name = dto.name.trim();
      if (dto.role !== undefined) metadataUpdates.role = dto.role;
      await this.supabase.auth.admin.updateUserById(id, { user_metadata: metadataUpdates });
    } catch {
      // Ignorar si falla actualización secundaria de auth
    }

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
      throw new BadRequestException('No puedes revocar el acceso a tu propia cuenta de Administrador.');
    }

    // 1. Eliminar de public.profile
    const { error: profError } = await this.supabase
      .from('profile')
      .delete()
      .eq('id', id);

    if (profError) {
      console.warn('[UsersService] Error al eliminar profile:', profError.message);
    }

    // 2. Eliminar de auth.users (Supabase Auth)
    const { error: authError } = await this.supabase.auth.admin.deleteUser(id);
    if (authError) {
      console.warn('[UsersService] Error al eliminar usuario de auth.users:', authError.message);
    }

    return {
      success: true,
      message: 'Usuario eliminado exitosamente de la base de datos.',
      id,
    };
  }
}
