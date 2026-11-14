import React from 'react';

interface LoadingScreenProps {
  message?: string;
}

export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Cargando sistema ERP...',
}) => (
  <div className="min-h-screen bg-[#FAF5ED] dark:bg-[#0F0B09] flex flex-col items-center justify-center p-4">
    <div className="flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-[#8C1F25]/20 border-t-[#8C1F25] rounded-full animate-spin" />
      <div className="font-serif text-2xl font-bold text-[#8C1F25] dark:text-[#E25C64]">
        Pastelería Orión
      </div>
      <p className="text-xs text-[#7B685C] dark:text-[#B39F93] font-medium tracking-wide">
        {message}
      </p>
    </div>
  </div>
);

