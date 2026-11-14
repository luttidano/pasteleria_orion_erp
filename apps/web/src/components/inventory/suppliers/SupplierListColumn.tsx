import React from 'react';
import { ChevronRight, MapPin, MessageSquare, Phone, Store, Truck } from 'lucide-react';
import type { Supplier } from '../../../types';
import {
  getGoogleMapsUrl,
  getSupplyModality,
  isPhoneRegistered,
} from '../../../services/supplierService';

interface SupplierListColumnProps {
  suppliers: Supplier[];
  selectedSupplierId?: string;
  isHiddenOnMobile: boolean;
  onSelectSupplier: (supplierId: string) => void;
  onWhatsApp: (supplier: Supplier, e: React.MouseEvent) => void;
  onCall: (supplier: Supplier, e: React.MouseEvent) => void;
}

export const SupplierListColumn: React.FC<SupplierListColumnProps> = ({
  suppliers,
  selectedSupplierId,
  isHiddenOnMobile,
  onSelectSupplier,
  onWhatsApp,
  onCall,
}) => {
  return (
    <div className={`lg:col-span-5 space-y-2.5 ${isHiddenOnMobile ? 'hidden lg:block' : 'block'}`}>
      <div className="flex items-center justify-between px-2 text-xs text-stone-500 dark:text-stone-400 font-medium">
        <span>Contactos ({suppliers.length})</span>
        <span className="text-[11px] text-stone-400">Haz clic para ver ficha y pedir</span>
      </div>

      <div className="space-y-2">
        {suppliers.map((supplier) => {
          const isSelected = selectedSupplierId === supplier.id;
          const isPresencial = getSupplyModality(supplier) === 'presencial';

          return (
            <div
              key={supplier.id}
              onClick={() => onSelectSupplier(supplier.id)}
              className={`p-3.5 sm:p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden group ${
                isSelected
                  ? 'bg-white dark:bg-[#1E1410] border-[#8C1F25] dark:border-[#B83238] shadow-md ring-2 ring-[#8C1F25]/15'
                  : 'bg-white/80 dark:bg-[#16100E] border-stone-200/80 dark:border-[#35251F] hover:bg-white dark:hover:bg-[#1C1310] hover:border-stone-300'
              }`}
            >
              {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-[#8C1F25] dark:bg-[#E25C64]" />
              )}

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 transition-transform ${
                      isSelected
                        ? 'bg-[#FAF5ED] dark:bg-[#2A1D18] border border-[#DFCAA9] dark:border-[#3D2C24] scale-105 shadow-xs'
                        : 'bg-stone-100 dark:bg-[#201612]'
                    }`}
                  >
                    {supplier.icon || (isPresencial ? '🏬' : '🚚')}
                  </div>

                  <div className="min-w-0">
                    <h4 className="font-bold text-stone-900 dark:text-[#FDF5EE] text-sm font-serif truncate leading-tight">
                      {supplier.name}
                    </h4>
                    <p className="text-[11px] text-stone-500 dark:text-stone-400 mt-0.5 truncate">
                      {supplier.category}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      {isPresencial ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-200/60 dark:border-blue-900/40 truncate max-w-[170px]">
                          <Store className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{supplier.deliverySchedule || 'Local / Mayorista'}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-2 py-0.5 rounded-md border border-amber-200/60 dark:border-amber-900/40 truncate max-w-[170px]">
                          <Truck className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{supplier.deliverySchedule}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones directos de WhatsApp, Llamar y Google Maps */}
                <div
                  className="flex items-center gap-1 shrink-0 pt-0.5"
                  onClick={(e) => e.stopPropagation()}
                >
                  {supplier.address && (
                    <a
                      href={getGoogleMapsUrl(supplier.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Abrir ubicación de ${supplier.name} en Google Maps`}
                      className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                    >
                      <MapPin className="w-3.5 h-3.5" />
                    </a>
                  )}
                  {isPhoneRegistered(supplier.phone) && (
                    <>
                      <button
                        type="button"
                        onClick={(e) => onWhatsApp(supplier, e)}
                        title="Enviar WhatsApp directo"
                        className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 hover:bg-emerald-600 hover:text-white dark:hover:bg-emerald-600 transition-colors flex items-center justify-center cursor-pointer shadow-2xs"
                      >
                        <MessageSquare className="w-3.5 h-3.5 fill-current" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => onCall(supplier, e)}
                        title="Llamar directo"
                        className="w-8 h-8 rounded-lg bg-stone-100 dark:bg-[#201612] text-stone-600 dark:text-stone-300 hover:bg-[#8C1F25] hover:text-white dark:hover:bg-[#8C1F25] transition-colors flex items-center justify-center cursor-pointer"
                      >
                        <Phone className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 text-stone-300 transition-transform hidden sm:block ${
                      isSelected ? 'text-[#8C1F25] translate-x-0.5' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

