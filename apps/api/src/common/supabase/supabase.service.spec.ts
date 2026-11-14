import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from './supabase.service';

describe('SupabaseService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_ANON_KEY;
    delete process.env.VITE_SUPABASE_ANON_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const makeConfig = (values: Record<string, string | undefined>) =>
    ({
      get: (key: string) => values[key],
    }) as unknown as ConfigService;

  it('debe fallar al iniciar si falta SUPABASE_SERVICE_ROLE_KEY incluso con ANON_KEY configurada', () => {
    const config = makeConfig({
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      VITE_SUPABASE_ANON_KEY: 'anon-key-must-never-be-used-by-backend',
      SUPABASE_ANON_KEY: 'anon-key-fallback-must-fail',
    });

    expect(() => new SupabaseService(config)).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it('debe fallar al iniciar si falta la URL o tiene formato inválido', () => {
    const missingUrl = makeConfig({
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
    });
    expect(() => new SupabaseService(missingUrl)).toThrow(/SUPABASE_URL/);

    const invalidUrl = makeConfig({
      SUPABASE_URL: 'not-a-valid-url',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
    });
    expect(() => new SupabaseService(invalidUrl)).toThrow(/SUPABASE_URL/);
  });

  it('debe inicializar el cliente admin usando VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY', () => {
    const config = makeConfig({
      VITE_SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key-test',
    });

    const service = new SupabaseService(config);
    expect(service.client).toBeDefined();
  });
});

