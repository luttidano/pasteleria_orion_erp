import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  public isAvailable = false;

  constructor() {
    const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/dummy';
    const adapter = new PrismaPg({ connectionString });
    super({ adapter });
  }

  async onModuleInit() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString || connectionString.includes('[TU-PASSWORD]') || connectionString.includes('tu-password')) {
      this.isAvailable = false;
      console.log('[PrismaService] DATABASE_URL no configurada o con valor placeholder. Modo activo: Supabase REST de alta velocidad (~400ms).');
      return;
    }

    try {
      await Promise.race([
        this.$queryRaw`SELECT 1`,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Prisma connection timeout (1.2s)')), 1200)),
      ]);
      this.isAvailable = true;
      console.log('[PrismaService] Connected to PostgreSQL successfully via Prisma Pooler');
    } catch (err: unknown) {
      this.isAvailable = false;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[PrismaService] Conexión PostgreSQL directa no disponible. Proveedor resiliente activo: Supabase REST:', msg);
    }
  }

  disable(reason?: string) {
    if (this.isAvailable) {
      this.isAvailable = false;
      console.warn('[PrismaService] Prisma desactivado por fallo en tiempo de ejecución. Modo activo: Supabase REST.', reason || '');
    }
  }

  async onModuleDestroy() {
    if (this.isAvailable) {
      await this.$disconnect();
    }
  }
}
