import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lectura de variables de entorno de Vite
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

/**
 * Determina si las credenciales de Supabase están configuradas y no son placeholders
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
 * Cliente de Supabase listo para producción.
 * Si las credenciales no están presentes aún en el entorno local,
 * se mantendrá en null permitiendo el fallback fluido al modo demo local.
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
