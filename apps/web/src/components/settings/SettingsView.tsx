import React, { useState } from 'react';
import { Sliders, Users } from 'lucide-react';
import type { User, ToastMessage } from '../../types';
import { UsersManagementTab } from './users/UsersManagementTab';
import { GeneralSettingsTab } from './GeneralSettingsTab';

interface SettingsViewProps {
  currentUser: User;
  addToast: (toast: Omit<ToastMessage, 'id'>) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentUser, addToast }) => {
  const [activeTab, setActiveTab] = useState<'users' | 'general'>('users');

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Selector de Pestañas en Configuración */}
      <div className="flex border-b border-stone-200 dark:border-[#35251F] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'border-[#8C1F25] text-[#8C1F25] dark:text-[#E25C64]'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Gestión de Usuarios & Accesos</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 pb-3 px-4 font-semibold text-sm border-b-2 transition-all cursor-pointer ${
            activeTab === 'general'
              ? 'border-[#8C1F25] text-[#8C1F25] dark:text-[#E25C64]'
              : 'border-transparent text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
          }`}
        >
          <Sliders className="w-4 h-4" />
          <span>Sistema & Parámetros</span>
        </button>
      </div>

      {/* Contenido según pestaña activa */}
      {activeTab === 'users' ? (
        <UsersManagementTab currentUser={currentUser} addToast={addToast} />
      ) : (
        <GeneralSettingsTab />
      )}
    </div>
  );
};
