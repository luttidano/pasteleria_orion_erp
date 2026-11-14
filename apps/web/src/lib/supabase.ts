import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lectura de variables de entorno de Vite
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Determina si las credenciales de Supabase Auth están configuradas y no son placeholders.
 */
export const isSupabaseConfigured = (): boolean => {
  return (
    supabaseUrl.length > 0 &&
    supabaseAnonKey.length > 0 &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('tu-proyecto') &&
    !supabaseUrl.includes('your-project') &&
    !supabaseAnonKey.includes('tu-anon-key')
  );
};

/**
 * Cliente de Supabase Auth para el navegador.
 * IMPORTANTE: debe utilizarse EXCLUSIVAMENTE para flujos de autenticación (login, logout,
 * recuperación de contraseña y gestión de sesión JWT). Toda operación de datos del ERP debe
 * pasar obligatoriamente por la API NestJS vía `apiFetch`.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'pasteleria_orion_auth_token',
      },
    })
  : null;
