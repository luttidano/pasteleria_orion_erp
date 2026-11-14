import { apiFetch } from '../lib/api';
import type { UserProfile, CreateUserData, UpdateUserData } from '../types';

export const userService = {
  /**
   * Obtiene la lista completa de perfiles de usuario vía API NestJS (GET /api/users).
   */
  async getUsers(): Promise<UserProfile[]> {
    return await apiFetch<UserProfile[]>('/users');
  },

  /**
   * Actualiza el rol o nombre de un usuario vía API NestJS (PATCH /api/users/:id).
   */
  async updateUser(id: string, updates: UpdateUserData): Promise<UserProfile> {
    return await apiFetch<UserProfile>(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  /**
   * Registra un nuevo usuario vía API NestJS con contraseña explícita (POST /api/users).
   */
  async createUser(data: CreateUserData): Promise<UserProfile> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim();
    const cleanPass = data.password?.trim() || '';

    if (cleanPass.length < 8) {
      throw new Error('La contraseña inicial debe tener al menos 8 caracteres.');
    }

    return await apiFetch<UserProfile>('/users', {
      method: 'POST',
      body: JSON.stringify({
        name: cleanName,
        email: cleanEmail,
        password: cleanPass,
        role: data.role,
      }),
    });
  },

  /**
   * Elimina un usuario de la base de datos y revoca su cuenta en Auth vía API NestJS (DELETE /api/users/:id).
   */
  async deleteUser(id: string): Promise<void> {
    await apiFetch<{ success: boolean; message: string }>(`/users/${id}`, {
      method: 'DELETE',
    });
  },
};
