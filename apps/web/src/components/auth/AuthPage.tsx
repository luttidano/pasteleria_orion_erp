import { useState } from 'react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User as UserIcon,
  ShieldAlert,
  Sparkles,
  ArrowRight,
  Sun,
  Moon,
  CheckCircle2,
} from 'lucide-react';
import { authService } from '../../services/authService';
import { useTheme } from '../../context/ThemeContext';
import type { User } from '../../types';

interface AuthPageProps {
  onLoginSuccess: (user: User) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ onLoginSuccess }) => {
  const { theme, toggleTheme } = useTheme();
  const [isRegister, setIsRegister] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setResetSuccessMessage(null);

    if (isRegister) {
      if (!name.trim()) {
        setError('Por favor ingresa tu nombre completo.');
        return;
      }
      if (!identifier.trim()) {
        setError('Por favor ingresa tu correo electrónico.');
        return;
      }
      if (password.length < 6) {
        setError('La contraseña debe tener al menos 6 caracteres.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await authService.register(name, identifier, password, 'user');
        if (result.success) {
          if (result.needsEmailConfirmation) {
            setInfoMessage(
              result.message ||
                '¡Cuenta registrada! Por favor revisa tu correo electrónico para confirmar tu cuenta y luego inicia sesión.'
            );
            setIsRegister(false);
          } else if (result.user) {
            onLoginSuccess(result.user);
          }
        } else {
          setError(result.error || 'No se pudo completar el registro.');
        }
      } catch {
        setError('Error inesperado al registrar usuario.');
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!identifier.trim() || !password) {
        setError('Por favor ingresa tu usuario/correo y contraseña.');
        return;
      }

      setIsLoading(true);
      try {
        const result = await authService.login(identifier, password);
        if (result.success && result.user) {
          onLoginSuccess(result.user);
        } else {
          setError(result.error || 'Credenciales inválidas.');
        }
      } catch {
        setError('Error al iniciar sesión.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfoMessage(null);

    const email = identifier.trim();
    if (!email || !email.includes('@')) {
      setError('Escribe tu correo electrónico en el campo superior para enviarte las instrucciones de recuperación.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await authService.resetPassword(email);
      if (res.success) {
        setResetSuccessMessage(res.message);
      } else {
        setError(res.message);
      }
    } catch {
      setError('No se pudo procesar la solicitud de recuperación.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setIdentifier('admin');
    setPassword('1234');
    setError(null);
    setInfoMessage(null);
    setResetSuccessMessage(null);
  };

  return (
    <div className="min-h-screen w-full bg-[#FAF5ED] dark:bg-[#0F0B09] flex flex-col items-center justify-center p-4 sm:p-6 text-[#2A1B16] dark:text-[#FBF4EB] transition-colors duration-200 relative">
      {/* Dark / Light Theme Toggle */}
      <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-20">
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2.5 rounded-full border border-[#DFCAA9] dark:border-[#3D2C24] bg-white/80 dark:bg-[#1E1512]/80 backdrop-blur-sm text-[#5D4A3D] dark:text-[#E8BD8A] hover:bg-white dark:hover:bg-[#251A15] shadow-xs transition-colors cursor-pointer"
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5" />}
        </button>
      </div>

      {/* Brand Header */}
      <div className="mb-7 flex flex-col items-center select-none text-center animate-fade-in">
        <span className="font-serif tracking-[0.28em] text-[13px] sm:text-[15px] font-bold text-[#8C1F25] dark:text-[#D4A373] uppercase drop-shadow-sm">
          Pastelería
        </span>
        <h1 className="font-serif text-5xl sm:text-6xl md:text-[68px] font-bold text-[#8C1F25] dark:text-[#E25C64] -mt-1 sm:-mt-2 tracking-tight">
          Orión
        </h1>
      </div>

      {/* Main Authentication Card */}
      <div className="w-full max-w-[440px] bg-[#F1DFC4] dark:bg-[#18110E] rounded-[28px] p-7 sm:p-10 shadow-card border border-[#E4CCA9]/60 dark:border-[#38261F] animate-modal-pop">
        <div className="text-center mb-6">
          <h2 className="text-xl sm:text-[22px] font-bold text-[#2A1B16] dark:text-[#FBF4EB] font-serif tracking-tight">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </h2>
          <p className="text-xs sm:text-[13px] text-[#7B685C] dark:text-[#B39F93] mt-1 font-medium">
            {isRegister
              ? 'Regístrate para continuar en Pastelería Orión'
              : 'Ingresa tus datos para continuar'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-[#FDE8E8] dark:bg-rose-950/40 border border-[#F8B4B4] dark:border-rose-900/60 text-[#9B1C1C] dark:text-rose-200 text-xs leading-relaxed animate-fade-in">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">{error}</div>
          </div>
        )}

        {/* Info / Email Confirmation Notice */}
        {infoMessage && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 text-blue-900 dark:text-blue-200 text-xs leading-relaxed animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
            <div className="flex-1">{infoMessage}</div>
          </div>
        )}

        {/* Password Reset Sent Alert */}
        {resetSuccessMessage && (
          <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200 text-xs leading-relaxed animate-fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <div className="flex-1">{resetSuccessMessage}</div>
          </div>
        )}

        {/* Auth Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nombre (sólo en registro) */}
          {isRegister && (
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-[#3C2A21] dark:text-[#E2D1C5] mb-1.5">
                Nombre completo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7B70] dark:text-[#766358]">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre y apellido"
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-white dark:bg-[#221713] text-[#2A1B16] dark:text-[#FBF4EB] placeholder-[#A8988D] dark:placeholder-[#766358] rounded-xl text-sm border border-transparent dark:border-[#38261F] focus:outline-none focus:ring-2 focus:ring-[#8C1F25] shadow-xs transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Correo electrónico o Usuario */}
          <div>
            <label className="block text-xs sm:text-[13px] font-semibold text-[#3C2A21] dark:text-[#E2D1C5] mb-1.5">
              Correo electrónico {isRegister ? '' : 'o usuario'}
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7B70] dark:text-[#766358]">
                <Mail className="w-4 h-4" />
              </div>
              <input
                type={isRegister ? 'email' : 'text'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={isRegister ? 'tu@correo.com' : 'tu@correo.com o admin'}
                className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-white dark:bg-[#221713] text-[#2A1B16] dark:text-[#FBF4EB] placeholder-[#A8988D] dark:placeholder-[#766358] rounded-xl text-sm border border-transparent dark:border-[#38261F] focus:outline-none focus:ring-2 focus:ring-[#8C1F25] shadow-xs transition-all"
                required
              />
            </div>
          </div>

          {/* Contraseña */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs sm:text-[13px] font-semibold text-[#3C2A21] dark:text-[#E2D1C5]">
                Contraseña
              </label>
              {!isRegister && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#8C1F25] dark:text-[#E8BD8A] hover:underline font-medium transition-colors cursor-pointer"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              )}
            </div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7B70] dark:text-[#766358]">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
                className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-white dark:bg-[#221713] text-[#2A1B16] dark:text-[#FBF4EB] placeholder-[#A8988D] dark:placeholder-[#766358] rounded-xl text-sm border border-transparent dark:border-[#38261F] focus:outline-none focus:ring-2 focus:ring-[#8C1F25] shadow-xs transition-all"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#8A7B70] hover:text-[#3C2A21] dark:hover:text-[#FBF4EB] transition-colors"
                aria-label="Ver u ocultar contraseña"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirmar Contraseña (solo registro) */}
          {isRegister && (
            <div>
              <label className="block text-xs sm:text-[13px] font-semibold text-[#3C2A21] dark:text-[#E2D1C5] mb-1.5">
                Confirmar contraseña
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[#8A7B70] dark:text-[#766358]">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repite tu contraseña"
                  minLength={6}
                  className="w-full pl-10 pr-3.5 py-2.5 sm:py-3 bg-white dark:bg-[#221713] text-[#2A1B16] dark:text-[#FBF4EB] placeholder-[#A8988D] dark:placeholder-[#766358] rounded-xl text-sm border border-transparent dark:border-[#38261F] focus:outline-none focus:ring-2 focus:ring-[#8C1F25] shadow-xs transition-all"
                  required
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 bg-[#8C1F25] hover:bg-[#74191E] active:scale-[0.99] text-white font-semibold text-sm sm:text-base rounded-xl shadow-btn transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : isRegister ? (
                <>
                  <span>Registrarme</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <span>Entrar</span>
              )}
            </button>
          </div>
        </form>

        {/* Bottom Toggle Link */}
        <div className="mt-5 text-center text-xs sm:text-[13px] text-[#7B685C] dark:text-[#B39F93]">
          {isRegister ? (
            <span>
              ¿Ya tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(false);
                  setError(null);
                  setInfoMessage(null);
                }}
                className="font-bold text-[#8C1F25] dark:text-[#FF8A91] hover:underline cursor-pointer"
              >
                Inicia sesión
              </button>
            </span>
          ) : (
            <span>
              ¿No tienes cuenta?{' '}
              <button
                type="button"
                onClick={() => {
                  setIsRegister(true);
                  setError(null);
                  setInfoMessage(null);
                }}
                className="font-bold text-[#8C1F25] dark:text-[#FF8A91] hover:underline cursor-pointer"
              >
                Regístrate
              </button>
            </span>
          )}
        </div>
      </div>

      {/* Testing & Admin Notice Helper (Convenient for quick testing) */}
      <div className="mt-6 max-w-[440px] w-full bg-white/80 dark:bg-[#18110E]/80 backdrop-blur-sm border border-[#EADBCE] dark:border-[#38261F] rounded-2xl p-3.5 sm:p-4 text-xs text-[#5D4C42] dark:text-[#C5B3A6] shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-semibold text-[#2A1B16] dark:text-[#FBF4EB]">Credenciales de prueba:</span>
          </div>
          <button
            type="button"
            onClick={handleFillAdmin}
            className="flex items-center gap-1 px-2.5 py-1 bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 hover:bg-[#8C1F25]/20 dark:hover:bg-[#8C1F25]/40 text-[#8C1F25] dark:text-[#FF8A91] font-semibold text-[11px] rounded-lg transition-colors cursor-pointer"
            title="Rellena admin y 1234 automáticamente"
          >
            <Sparkles className="w-3 h-3" />
            <span>Auto-completar Admin</span>
          </button>
        </div>
        <div className="mt-2 text-[11px] text-[#7B685C] dark:text-[#B39F93] leading-relaxed">
          Usa <strong>admin</strong> y contraseña <strong>1234</strong> para acceder al <strong>Panel de Administrador (Inventario ERP)</strong>. Si te registras con otra cuenta, ingresarás con la vista de usuario estándar.
        </div>
      </div>

      {/* Footer Branding */}
      <div className="mt-6 text-center text-xs text-[#A8988D] dark:text-[#6C584C]">
        Pastelería Orión ERP &bull; Diseñado para alta repostería artesanal
      </div>
    </div>
  );
};
