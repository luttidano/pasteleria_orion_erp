import { supabase, isSupabaseConfigured, createEphemeralClient } from '../lib/supabase';
import { apiFetch } from '../lib/api';
import type { UserProfile, CreateUserData, UpdateUserData, User } from '../types';

const STORAGE_KEY_REGISTERED_USERS = 'orion_users_db';

export const userService = {
  /**
   * Obtiene la lista completa de perfiles de usuario
   * Intenta primero el backend NestJS (GET /api/users) y como fallback Supabase REST directo
   */
  async getUsers(): Promise<UserProfile[]> {
    // 1. Probar backend NestJS
    try {
      const data = await apiFetch<UserProfile[]>('/users');
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (apiErr) {
      console.warn('[userService] Fallo o demora al consultar API NestJS /api/users. Usando fallback:', apiErr);
    }

    // 2. Fallback directo a Supabase
    if (isSupabaseConfigured() && supabase) {
      try {
        const { data, error } = await supabase
          .from('profile')
          .select('id, name, email, role, created_at, updated_at')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('[userService] Error al consultar profiles en Supabase:', error.message);
          throw new Error(error.message);
        }

        if (data && data.length > 0) {
          return data.map((p) => ({
            id: p.id,
            name: p.name || 'Sin nombre',
            email: p.email || '',
            role: p.role,
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          }));
        }
      } catch (err) {
        console.warn('[userService] Fallo de red con Supabase, intentando fallback local...', err);
      }
    }

    // 3. Fallback de desarrollo en localStorage
    try {
      const local = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
      if (local) {
        const users: Array<User & { passwordHash?: string }> = JSON.parse(local);
        return users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
        }));
      }
    } catch {
      // Ignorar error de parsing
    }

    return [];
  },

  /**
   * Actualiza el rol o nombre de un usuario
   */
  async updateUser(id: string, updates: UpdateUserData): Promise<UserProfile> {
    // 1. Intentar backend NestJS
    try {
      const updated = await apiFetch<UserProfile>(`/users/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      if (updated && updated.id) {
        this.syncLocalUpdate(id, updates);
        return updated;
      }
    } catch (apiErr) {
      console.warn('[userService] Fallo al actualizar vía API NestJS. Probando Supabase directo:', apiErr);
    }

    // 2. Fallback Supabase directo
    if (isSupabaseConfigured() && supabase) {
      const payload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (updates.name !== undefined) payload.name = updates.name.trim();
      if (updates.role !== undefined) payload.role = updates.role;

      const { data, error } = await supabase
        .from('profile')
        .update(payload)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      this.syncLocalUpdate(id, updates);

      return {
        id: data.id,
        name: data.name,
        email: data.email || '',
        role: data.role,
        createdAt: data.created_at,
        updatedAt: data.updated_at,
      };
    }

    // 3. Fallback modo local
    const updated = this.syncLocalUpdate(id, updates);
    if (updated) return updated;

    throw new Error('Servidor de datos no configurado.');
  },

  /**
   * Registra un nuevo usuario en Supabase Auth y crea su perfil
   */
  async createUser(data: CreateUserData): Promise<UserProfile> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();
    const cleanPass = data.password?.trim() || 'Orion2026*';

    // 1. Intentar backend NestJS
    try {
      const created = await apiFetch<UserProfile>('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          password: cleanPass,
          role: data.role,
        }),
      });
      if (created && created.id) {
        this.syncLocalCreate(created, cleanPass);
        return created;
      }
    } catch (apiErr) {
      console.warn('[userService] Fallo al crear usuario vía API NestJS. Probando cliente Supabase efímero:', apiErr);
    }

    // 2. Fallback Supabase directo con cliente efímero para proteger la sesión del admin
    if (isSupabaseConfigured()) {
      const ephemeral = createEphemeralClient();
      if (ephemeral) {
        const { data: authData, error: authError } = await ephemeral.auth.signUp({
          email: cleanEmail,
          password: cleanPass,
          options: {
            data: {
              name: cleanName,
              role: data.role,
            },
          },
        });

        if (authError) throw new Error(authError.message);
        if (!authData.user) throw new Error('No se pudo generar el usuario en autenticación.');

        const client = supabase || ephemeral;
        const { data: profile, error: profError } = await client
          .from('profile')
          .upsert({
            id: authData.user.id,
            name: cleanName,
            email: cleanEmail,
            role: data.role,
          })
          .select()
          .single();

        if (profError) {
          console.warn('[userService] Error al insertar profile tras signup:', profError.message);
        }

        const newUserProfile: UserProfile = {
          id: authData.user.id,
          name: profile?.name || cleanName,
          email: profile?.email || cleanEmail,
          role: profile?.role || data.role,
          createdAt: profile?.created_at || new Date().toISOString(),
        };

        this.syncLocalCreate(newUserProfile, cleanPass);
        return newUserProfile;
      }
    }

    // 3. Fallback modo local
    const newId = 'usr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const localProfile: UserProfile = {
      id: newId,
      name: cleanName,
      email: cleanEmail,
      role: data.role,
      createdAt: new Date().toISOString(),
    };

    this.syncLocalCreate(localProfile, cleanPass);
    return localProfile;
  },

  /**
   * Elimina un usuario de la base de datos (public.profile y auth.users)
   * Utiliza el endpoint del backend con permisos de servicio para eliminarlo de PostgreSQL
   */
  async deleteUser(id: string): Promise<void> {
    let apiSuccess = false;

    // 1. Intentar backend NestJS con privilegios de servicio
    try {
      await apiFetch<{ success: boolean; message: string }>(`/users/${id}`, {
        method: 'DELETE',
      });
      apiSuccess = true;
    } catch (apiErr) {
      console.warn('[userService] No se pudo eliminar vía backend NestJS. Intentando Supabase directo:', apiErr);
    }

    // 2. Si el backend falló o está apagado, intentar función RPC de Supabase y borrado directo
    if (!apiSuccess && isSupabaseConfigured() && supabase) {
      try {
        const { error: rpcErr } = await supabase.rpc('delete_user_by_admin', { target_user_id: id });
        if (!rpcErr) {
          apiSuccess = true;
        }
      } catch {
        // Continuar si la función RPC aún no está creada en la BD
      }

      if (!apiSuccess) {
        const { error } = await supabase.from('profile').delete().eq('id', id);
        if (error) {
          console.warn('[userService] Error al eliminar profile directamente en Supabase:', error.message);
          throw new Error(error.message);
        }
      }
    }

    // 3. Sincronizar almacenamiento local
    try {
      const local = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
      if (local) {
        const users: Array<User & { passwordHash?: string }> = JSON.parse(local);
        const filtered = users.filter((u) => u.id !== id);
        localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(filtered));
      }
    } catch {
      // Ignorar
    }
  },

  // Helpers auxiliares para sincronización local
  syncLocalCreate(profile: UserProfile, password?: string) {
    try {
      const local = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
      const users: Array<User & { passwordHash?: string }> = local ? JSON.parse(local) : [];
      users.push({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role,
        createdAt: profile.createdAt,
        passwordHash: password || '123456',
      });
      localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
    } catch {
      // Ignorar
    }
  },

  syncLocalUpdate(id: string, updates: UpdateUserData): UserProfile | null {
    try {
      const local = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
      if (local) {
        const users: Array<User & { passwordHash?: string }> = JSON.parse(local);
        const target = users.find((u) => u.id === id);
        if (target) {
          if (updates.name !== undefined) target.name = updates.name.trim();
          if (updates.role !== undefined) target.role = updates.role;
          localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
          return {
            id: target.id,
            name: target.name,
            email: target.email,
            role: target.role,
            createdAt: target.createdAt,
          };
        }
      }
    } catch {
      // Ignorar
    }
    return null;
  },
};
