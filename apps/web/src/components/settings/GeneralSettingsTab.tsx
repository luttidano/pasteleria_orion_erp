import React from 'react';
import {
  Database,
  Layers,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
  Store,
  Wheat,
  CheckCircle2,
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { isSupabaseConfigured } from '../../lib/supabase';

export const GeneralSettingsTab: React.FC = () => {
  const { isDarkMode, toggleDarkMode } = useTheme();
  const isCloudConnected = isSupabaseConfigured();

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Banner de Bienvenida Institucional */}
      <div className="p-6 sm:p-8 rounded-[26px] bg-gradient-to-br from-[#8C1F25] to-[#5C1014] text-white shadow-card relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Sparkles className="w-64 h-64" />
        </div>
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-white/90 text-xs font-semibold uppercase tracking-wider mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>Arquitectura Monolito Modular</span>
          </div>
          <h2 className="font-serif text-2xl sm:text-3xl font-bold tracking-tight mb-2">
            Configuración & Parámetros del Sistema
          </h2>
          <p className="text-white/80 text-xs sm:text-sm leading-relaxed font-normal">
            Pastelería Orión ERP integra la gestión de inventario de materias primas, recetario artesanal,
            punto de venta y contabilidad financiera bajo una arquitectura robusta y desacoplada.
          </p>
        </div>
      </div>

      {/* Grid de Estado de Módulos y Base de Datos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Tarjeta: Estado de Conexión de Datos */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Infraestructura de Datos
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Motor de persistencia y catálogo
                </p>
              </div>
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isCloudConnected
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isCloudConnected ? 'Supabase PostgreSQL' : 'Copia Local Resiliente'}
            </span>
          </div>

          <div className="space-y-2.5 text-xs text-stone-600 dark:text-stone-300 pt-2 border-t border-stone-100 dark:border-[#2A1D18]">
            <div className="flex justify-between items-center py-1">
              <span className="text-stone-500 dark:text-stone-400">Tipo de Despliegue</span>
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                Monolito Modular Web + API
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-stone-500 dark:text-stone-400">Sincronización de Catálogo</span>
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                Tiempo real reactivo
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-stone-500 dark:text-stone-400">Versión del Sistema</span>
              <span className="font-mono font-semibold text-[#8C1F25] dark:text-[#E25C64]">
                v1.2.0-clean-routes
              </span>
            </div>
          </div>
        </div>

        {/* Tarjeta: Preferencias Visuales */}
        <div className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                {isDarkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
                  Apariencia de la Interfaz
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  Modo diurno cálido o nocturno
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="px-3.5 py-1.5 rounded-xl border border-stone-300 dark:border-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-semibold text-stone-700 dark:text-stone-200 transition-colors cursor-pointer"
            >
              Cambiar a {isDarkMode ? 'Modo Claro' : 'Modo Oscuro'}
            </button>
          </div>

          <div className="space-y-2.5 text-xs text-stone-600 dark:text-stone-300 pt-2 border-t border-stone-100 dark:border-[#2A1D18]">
            <div className="flex justify-between items-center py-1">
              <span className="text-stone-500 dark:text-stone-400">Tema Activo</span>
              <span className="font-semibold text-stone-900 dark:text-stone-100">
                {isDarkMode ? '🌙 Café Noir & Cacao (Oscuro)' : '☀️ Vainilla & Canela (Claro)'}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-stone-500 dark:text-stone-400">Paleta Principal</span>
              <span className="font-semibold text-[#8C1F25] dark:text-[#FF8A91]">
                Vino Tinto Orión (#8C1F25)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tarjeta de Matriz de Módulos & Roles */}
      <div className="p-6 rounded-[22px] bg-white dark:bg-[#16100E] border border-stone-200/80 dark:border-[#35251F] shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#8C1F25]/10 dark:bg-[#8C1F25]/25 text-[#8C1F25] dark:text-[#E8A598] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-stone-900 dark:text-stone-100">
              Control de Acceso Basado en Roles (RBAC)
            </h3>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Permisos y capacidades de cada perfil en Pastelería Orión
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          {/* Rol: Admin */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#8C1F25] dark:text-[#E25C64]" />
              <span className="font-bold text-xs text-[#8C1F25] dark:text-[#E25C64]">
                Administrador (admin)
              </span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
              Acceso irrestricto a los 3 módulos: Inventario completo, Punto de Venta, Contabilidad,
              Compras, Directorio de Proveedores y Ajustes del Sistema.
            </p>
          </div>

          {/* Rol: Baker */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] space-y-2">
            <div className="flex items-center gap-2">
              <Wheat className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span className="font-bold text-xs text-amber-700 dark:text-amber-400">
                Maestro Pastelero (baker)
              </span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
              Acceso operativo al Módulo de Inventario: Despensa de materias primas, fichas técnicas
              del recetario y catálogo de productos comerciales.
            </p>
          </div>

          {/* Rol: Cashier */}
          <div className="p-4 rounded-xl bg-stone-50 dark:bg-[#201612] border border-stone-200 dark:border-[#35251F] space-y-2">
            <div className="flex items-center gap-2">
              <Store className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="font-bold text-xs text-emerald-700 dark:text-emerald-400">
                Cajero / Ventas (cashier)
              </span>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-400 leading-relaxed">
              Acceso enfocado a la atención a público: Cobro rápido en caja de mostrador, tickets del
              día y arqueo de cierre de turno.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
