import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  ShieldCheck,
  Wheat,
  Store,
  UserPlus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Lock,
  Calendar,
  Loader2,
} from 'lucide-react';
import type { User, UserProfile, ToastMessage, UserRole, CreateUserData, UpdateUserData } from '../../../types';
import { userService } from '../../../services/userService';
import { formatChileShortDate } from '../../../utils/formatters';
import { UserModal } from './UserModal';
import { ConfirmDeleteModal } from '../../common/ConfirmDeleteModal';
import { DataTable, type DataTableColumn } from '../../common/DataTable';

interface UsersManagementTabProps {
  currentUser: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const UsersManagementTab: React.FC<UsersManagementTabProps> = ({
  currentUser,
  addToast,
}) => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'todos' | UserRole>('todos');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<UserProfile | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeletingUser, setIsDeletingUser] = useState(false);

  const loadUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('[UsersManagement] Error al cargar colaboradores:', err);
      addToast({
        type: 'error',
        title: 'Error de Usuarios',
        message: 'No se pudo obtener el listado de colaboradores.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Contadores para métricas rápidas
  const counts = useMemo(() => {
    const admin = users.filter((u) => u.role === 'admin').length;
    const baker = users.filter((u) => u.role === 'baker').length;
    const cashier = users.filter((u) => u.role === 'cashier').length;
    return {
      total: users.length,
      admin,
      baker,
      cashier,
    };
  }, [users]);

  // Filtrado reactivo por término y rol
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchRole = roleFilter === 'todos' || u.role === roleFilter;
      const term = searchTerm.toLowerCase().trim();
      const matchSearch =
        !term ||
        u.name.toLowerCase().includes(term) ||
        u.email.toLowerCase().includes(term);
      return matchRole && matchSearch;
    });
  }, [users, roleFilter, searchTerm]);

  const handleOpenCreateModal = () => {
    setUserToEdit(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (profile: UserProfile) => {
    setUserToEdit(profile);
    setIsModalOpen(true);
  };

  const handleSaveUser = async (data: CreateUserData | UpdateUserData) => {
    if (userToEdit) {
      // Edición
      const updated = await userService.updateUser(userToEdit.id, data as UpdateUserData);
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
      addToast({
        type: 'success',
        title: 'Colaborador Actualizado',
        message: `Los datos y rol de ${updated.name} se han guardado con éxito.`,
      });
    } else {
      // Creación
      const created = await userService.createUser(data as CreateUserData);
      setUsers((prev) => [created, ...prev]);
      addToast({
        type: 'success',
        title: 'Colaborador Creado',
        message: `Cuenta generada exitosamente para ${created.name} (${created.email}).`,
      });
    }
  };

  const handleConfirmDelete = async () => {
    if (!userToDelete || isDeletingUser) return;
    setIsDeletingUser(true);
    try {
      await userService.deleteUser(userToDelete.id);
      setUsers((prev) => prev.filter((u) => u.id !== userToDelete.id));
      addToast({
        type: 'info',
        title: 'Acceso Revocado',
        message: `El usuario ${userToDelete.name} ha sido desvinculado del sistema.`,
      });
      setUserToDelete(null);
    } catch (err) {
      console.error('[UsersManagement] Error al eliminar usuario:', err);
      addToast({
        type: 'error',
        title: 'Error al revocar acceso',
        message: err instanceof Error ? err.message : 'No se pudo eliminar el usuario.',
      });
    } finally {
      setIsDeletingUser(false);
    }
  };

  const formatDate = (isoString?: string) => formatChileShortDate(isoString, 'Reciente');

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 text-[#8C1F25] dark:text-[#FFAAB0] border border-[#8C1F25]/20 dark:border-[#8C1F25]/40">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Administrador</span>
          </span>
        );
      case 'baker':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/40">
            <Wheat className="w-3.5 h-3.5" />
            <span>Maestro Pastelero</span>
          </span>
        );
      case 'cashier':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/40">
            <Store className="w-3.5 h-3.5" />
            <span>Cajero (POS)</span>
          </span>
        );
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((n) => n[0].toUpperCase())
      .join('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. KPIs de Resumen de Roles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400">
              Total Cuentas
            </span>
            <div className="text-2xl font-bold font-serif text-stone-900 dark:text-stone-100 mt-0.5">
              {counts.total}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-stone-100 dark:bg-[#201612] text-stone-700 dark:text-stone-300 flex items-center justify-center">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#8C1F25] dark:text-[#E25C64]">
              Administradores
            </span>
            <div className="text-2xl font-bold font-serif text-[#8C1F25] dark:text-[#E25C64] mt-0.5">
              {counts.admin}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pasteleros
            </span>
            <div className="text-2xl font-bold font-serif text-amber-700 dark:text-amber-400 mt-0.5">
              {counts.baker}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Wheat className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Cajeros (POS)
            </span>
            <div className="text-2xl font-bold font-serif text-emerald-700 dark:text-emerald-400 mt-0.5">
              {counts.cashier}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <Store className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Barra de Control: Búsqueda, Filtros y Botón de Creación */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Input de Búsqueda */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o correo..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-[#FAF5ED]/50 dark:bg-[#1E1512] text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#8C1F25] transition-colors"
          />
        </div>

        {/* Filtro por Rol y Acciones */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'todos' | UserRole)}
            className="px-3 py-2 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1512] text-xs font-semibold text-stone-700 dark:text-stone-200 focus:outline-hidden focus:border-[#8C1F25] cursor-pointer"
          >
            <option value="todos">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="baker">Pasteleros</option>
            <option value="cashier">Cajeros</option>
          </select>

          <button
            type="button"
            onClick={loadUsers}
            disabled={isLoading}
            className="p-2 rounded-xl border border-stone-200 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-600 dark:text-stone-300 transition-colors cursor-pointer disabled:opacity-50"
            title="Recargar colaboradores"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-semibold shadow-btn transition-all flex items-center gap-2 cursor-pointer active:scale-98 shrink-0"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Colaborador</span>
          </button>
        </div>
      </div>

      {/* 3. Tabla de Colaboradores */}
      <div className="rounded-[22px] bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs overflow-hidden">
        {isLoading && users.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#8C1F25] animate-spin" />
            <p className="text-xs text-stone-500 font-medium">Cargando directorio de colaboradores...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-400 flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <h4 className="font-serif text-base font-bold text-stone-800 dark:text-stone-200 mt-2">
              No se encontraron usuarios
            </h4>
            <p className="text-xs text-stone-500 max-w-sm">
              {searchTerm || roleFilter !== 'todos'
                ? 'Ningún usuario coincide con los filtros aplicados. Intenta cambiar el término de búsqueda.'
                : 'Aún no hay colaboradores registrados en el sistema.'}
            </p>
          </div>
        ) : (
          <DataTable
            data={filteredUsers}
            keyExtractor={(profile) => profile.id}
            headerRowClassName="border-b border-stone-200/80 dark:border-[#2C1D18] bg-stone-50/70 dark:bg-[#1A120F] text-[11px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider"
            bodyClassName="divide-y divide-stone-100 dark:divide-[#241713] text-xs"
            rowClassName={() =>
              'hover:bg-stone-50/50 dark:hover:bg-[#1E1410]/50 transition-colors'
            }
            columns={
              [
                {
                  key: 'collaborator',
                  header: 'Colaborador',
                  headerClassName: 'py-3 px-4',
                  cellClassName: 'py-3.5 px-4',
                  render: (profile) => {
                    const isCurrent = profile.id === currentUser.id;
                    return (
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#8C1F25] to-[#B33939] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
                          {getInitials(profile.name)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-stone-900 dark:text-stone-100 truncate">
                              {profile.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8C1F25]/10 text-[#8C1F25] dark:text-[#FFAAB0] border border-[#8C1F25]/20">
                                Tú
                              </span>
                            )}
                          </div>
                          <span className="text-stone-500 dark:text-stone-400 text-[11px] block truncate">
                            {profile.email}
                          </span>
                        </div>
                      </div>
                    );
                  },
                },
                {
                  key: 'role',
                  header: 'Rol & Permisos',
                  headerClassName: 'py-3 px-4',
                  cellClassName: 'py-3.5 px-4',
                  render: (profile) => getRoleBadge(profile.role),
                },
                {
                  key: 'createdAt',
                  header: 'Fecha Alta',
                  headerClassName: 'py-3 px-4 hidden md:table-cell',
                  cellClassName:
                    'py-3.5 px-4 hidden md:table-cell text-stone-500 dark:text-stone-400 font-medium',
                  render: (profile) => (
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-stone-400" />
                      <span>{formatDate(profile.createdAt)}</span>
                    </div>
                  ),
                },
                {
                  key: 'actions',
                  header: 'Acciones',
                  headerClassName: 'py-3 px-4 text-right',
                  cellClassName: 'py-3.5 px-4 text-right',
                  render: (profile) => {
                    const isCurrent = profile.id === currentUser.id;
                    return (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(profile)}
                          className="p-1.5 rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#251814] transition-colors cursor-pointer"
                          title="Editar datos y rol"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {isCurrent ? (
                          <button
                            type="button"
                            disabled
                            className="p-1.5 rounded-lg text-stone-300 dark:text-stone-700 cursor-not-allowed opacity-50"
                            title="No puedes revocar el acceso a tu propia cuenta"
                          >
                            <Lock className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setUserToDelete(profile)}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                            title="Revocar acceso de usuario"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    );
                  },
                },
              ] satisfies DataTableColumn<UserProfile>[]
            }
          />
        )}
      </div>

      {/* 4. Modales de Creación/Edición y Confirmación */}
      <UserModal
        isOpen={isModalOpen}
        userToEdit={userToEdit}
        currentAdminId={currentUser.id}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSaveUser}
      />

      <ConfirmDeleteModal
        isOpen={Boolean(userToDelete)}
        title={userToDelete ? `¿Eliminar acceso de ${userToDelete.name}?` : '¿Eliminar acceso?'}
        description={
          userToDelete ? (
            <>
              Esta acción desvinculará a{' '}
              <strong className="text-[#1C120D] dark:text-[#FBF4EB]">{userToDelete.email}</strong> del sistema ERP. El colaborador ya no podrá iniciar sesión en la pastelería.
            </>
          ) : null
        }
        confirmLabel="Sí, Eliminar Acceso"
        isDeleting={isDeletingUser}
        onClose={() => !isDeletingUser && setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
};
