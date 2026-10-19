import React, { useState, useEffect } from 'react';
import {
  X,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
  Wheat,
  Store,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import type { UserProfile, CreateUserData, UpdateUserData, UserRole } from '../../../types';

interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: CreateUserData | UpdateUserData) => Promise<void>;
  userToEdit: UserProfile | null;
  currentAdminId: string;
}

export const UserModal: React.FC<UserModalProps> = ({
  isOpen,
  onClose,
  onSave,
  userToEdit,
  currentAdminId,
}) => {
  const isEditing = !!userToEdit;
  const isEditingSelf = isEditing && userToEdit.id === currentAdminId;

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('baker');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (userToEdit) {
        setName(userToEdit.name || '');
        setEmail(userToEdit.email || '');
        setRole(userToEdit.role || 'baker');
        setPassword('');
      } else {
        setName('');
        setEmail('');
        setPassword('');
        setRole('baker');
      }
      setErrorMsg(null);
      setIsSubmitting(false);
    }
  }, [isOpen, userToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPass = password.trim();

    if (!cleanName) {
      setErrorMsg('Por favor ingresa el nombre del colaborador.');
      return;
    }

    if (!cleanEmail) {
      setErrorMsg('Por favor ingresa un correo electrónico.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      setErrorMsg('El formato del correo electrónico no es válido.');
      return;
    }

    if (!isEditing) {
      if (!cleanPass) {
        setErrorMsg('Debes asignar una contraseña inicial para la nueva cuenta.');
        return;
      }
      if (cleanPass.length < 6) {
        setErrorMsg('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (isEditing) {
        const payload: UpdateUserData = {
          name: cleanName,
          // No permitir que el admin se degrade a sí mismo
          role: isEditingSelf ? 'admin' : role,
        };
        await onSave(payload);
      } else {
        const payload: CreateUserData = {
          name: cleanName,
          email: cleanEmail,
          password: cleanPass,
          role,
        };
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ocurrió un error al guardar el usuario.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const roleOptions: Array<{
    id: UserRole;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
  }> = [
    {
      id: 'admin',
      title: 'Administrador',
      description: 'Acceso total a Inventario, POS, Contabilidad y Ajustes',
      icon: ShieldCheck,
      color: 'border-[#8C1F25] text-[#8C1F25] dark:text-[#E25C64] bg-[#8C1F25]/5',
    },
    {
      id: 'baker',
      title: 'Maestro Pastelero',
      description: 'Despensa de insumos, recetario técnico y catálogo',
      icon: Wheat,
      color: 'border-amber-600 text-amber-700 dark:text-amber-400 bg-amber-500/5',
    },
    {
      id: 'cashier',
      title: 'Cajero / Mostrador',
      description: 'Caja y cobro rápido POS, tickets del día y arqueo de caja',
      icon: Store,
      color: 'border-emerald-600 text-emerald-700 dark:text-emerald-400 bg-emerald-500/5',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-fade-in">
      <div
        className="w-full max-w-lg bg-white dark:bg-[#18110E] rounded-[26px] p-6 sm:p-7 shadow-modal border border-stone-200 dark:border-[#38261F] text-[#2A1B16] dark:text-[#FBF4EB] animate-modal-pop relative max-h-[90vh] flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-100 dark:border-[#2C1D18]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900 dark:text-stone-100">
                {isEditing ? 'Editar Colaborador' : 'Nuevo Colaborador'}
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                {isEditing
                  ? 'Modifica los datos y asignación de rol'
                  : 'Crea una cuenta de acceso al ERP Orión'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#251814] transition-colors cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4 pt-4 overflow-y-auto flex-1 pr-1">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Campo: Nombre */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Nombre y Apellido <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Francisca Pérez"
                required
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1512] text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#8C1F25] dark:focus:border-[#E25C64] transition-colors"
              />
            </div>
          </div>

          {/* Campo: Correo Electrónico */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Correo Electrónico <span className="text-[#8C1F25]">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="francisca@pasteleriaorion.cl"
                disabled={isEditing}
                required
                className={`w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1512] text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#8C1F25] dark:focus:border-[#E25C64] transition-colors ${
                  isEditing ? 'opacity-60 cursor-not-allowed bg-stone-100 dark:bg-stone-800' : ''
                }`}
              />
            </div>
            {isEditing && (
              <p className="text-[11px] text-stone-400 mt-1">
                El correo está vinculado a la autenticación del usuario y no se puede modificar directamente.
              </p>
            )}
          </div>

          {/* Campo: Contraseña (Solo nuevo) */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
                Contraseña Inicial <span className="text-[#8C1F25]">*</span>
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1512] text-xs sm:text-sm text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#8C1F25] dark:focus:border-[#E25C64] transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-1.5 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-stone-400 mt-1">
                El colaborador podrá ingresar de inmediato con esta clave temporal.
              </p>
            </div>
          )}

          {/* Selector de Rol */}
          <div className="pt-2">
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-2">
              Asignación de Rol & Privilegios <span className="text-[#8C1F25]">*</span>
            </label>

            {isEditingSelf && (
              <div className="mb-2 p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>
                  Estás editando tu propia cuenta. Por seguridad, no puedes cambiar tu propio rol de Administrador.
                </span>
              </div>
            )}

            <div className="space-y-2">
              {roleOptions.map((opt) => {
                const isSelected = role === opt.id;
                const Icon = opt.icon;
                const disabled = isEditingSelf && opt.id !== 'admin';

                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={disabled}
                    onClick={() => setRole(opt.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl border text-left transition-all cursor-pointer ${
                      disabled
                        ? 'opacity-40 cursor-not-allowed border-stone-200 dark:border-stone-800'
                        : isSelected
                        ? `${opt.color} ring-1 ring-offset-0 ring-current`
                        : 'border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-[#201511]'
                    }`}
                  >
                    <div className="mt-0.5 shrink-0">
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                          {opt.title}
                        </span>
                        {isSelected && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-stone-200/80 dark:bg-stone-700/80">
                            Seleccionado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botones de Acción */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-[#2C1D18]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2.5 rounded-xl bg-[#8C1F25] hover:bg-[#73191E] text-white text-xs font-semibold shadow-btn transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Colaborador'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
