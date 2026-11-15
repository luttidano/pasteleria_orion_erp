import React from 'react';
import { Edit2, Trash2 } from 'lucide-react';
import type { CatalogProduct } from '../../../../types';
import { formatMoney } from '../../../../utils/formatters';

interface ProductsTableProps {
  products: CatalogProduct[];
  isAdmin: boolean;
  onEdit: (product: CatalogProduct) => void;
  onDelete: (product: CatalogProduct) => void;
}

export const ProductsTable: React.FC<ProductsTableProps> = ({
  products,
  isAdmin,
  onEdit,
  onDelete,
}) => {
  return (
    <div className="rounded-2xl border border-[#E8D7BE] dark:border-[#2C1D18] bg-white dark:bg-[#16100E] overflow-hidden">
      <table className="w-full text-left border-collapse text-xs">
        <thead>
          <tr className="border-b border-[#E8D7BE] dark:border-[#2C1D18] bg-[#F7EFE4]/60 dark:bg-[#1D1410] text-[#7A685D] dark:text-[#A8968A] font-bold">
            <th className="py-3 px-4">Producto</th>
            <th className="py-3 px-3">Tipo</th>
            <th className="py-3 px-3">Stock</th>
            <th className="py-3 px-3">Precio Venta</th>
            <th className="py-3 px-3">Costo</th>
            <th className="py-3 px-3">Origen</th>
            {isAdmin && <th className="py-3 px-4 text-right">Acciones</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-[#221814]">
          {products.map((p) => (
            <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-[#1C1410] transition-colors">
              <td className="py-3 px-4 flex items-center gap-2.5">
                <span className="text-xl">{p.icon || '🧁'}</span>
                <div>
                  <p className="font-bold text-[#1C120D] dark:text-[#FBF4EB]">{p.name}</p>
                  {p.description && <p className="text-[10px] text-stone-500">{p.description}</p>}
                </div>
              </td>
              <td className="py-3 px-3">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    p.productType === 'manufactured'
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                      : 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  }`}
                >
                  {p.productType === 'manufactured' ? 'Elaborado' : 'Reventa'}
                </span>
              </td>
              <td className="py-3 px-3 font-bold">
                {p.stock} {p.unit}
              </td>
              <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-400">
                {formatMoney(p.salePrice)}
              </td>
              <td className="py-3 px-3 text-stone-600 dark:text-stone-400">
                {p.costPrice ? formatMoney(p.costPrice) : '-'}
              </td>
              <td className="py-3 px-3 text-stone-600 dark:text-stone-400">
                {p.recipeName || p.supplierName || '-'}
              </td>
              {isAdmin && (
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="p-1 rounded text-stone-500 hover:text-stone-800 cursor-pointer"
                      title="Modificar"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      className="p-1 rounded text-rose-500 hover:text-rose-700 cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
