import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly clientInstance: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl = (
      this.configService?.get<string>('SUPABASE_URL') ||
      this.configService?.get<string>('VITE_SUPABASE_URL') ||
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      ''
    ).trim();

    const serviceRoleKey = (
      this.configService?.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      ''
    ).trim();

    if (!supabaseUrl || !supabaseUrl.startsWith('http') || !serviceRoleKey) {
      this.logger.error(
        'Configuración inválida de Supabase Admin: se requieren SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY.',
      );
      throw new Error(
        'SupabaseService requiere SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY configurados.',
      );
    }

    this.clientInstance = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  get client(): SupabaseClient {
    return this.clientInstance;
  }
}
