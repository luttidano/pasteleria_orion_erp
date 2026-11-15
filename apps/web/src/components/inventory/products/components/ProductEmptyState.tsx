import React from 'react';
import { Package } from 'lucide-react';

export const ProductEmptyState: React.FC = () => {
  return (
    <div className="py-16 text-center rounded-2xl bg-white dark:bg-[#16100E] border border-[#E8D7BE] dark:border-[#2C1D18]">
      <Package className="w-12 h-12 mx-auto text-stone-400 dark:text-stone-600 mb-3" />
      <h3 className="text-base font-bold text-stone-800 dark:text-stone-200">
        No se encontraron productos
      </h3>
      <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
        Intenta cambiar los filtros o agrega un nuevo producto al catálogo.
      </p>
    </div>
  );
};
