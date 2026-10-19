import type { Supplier, SupplyModality } from '../types';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'pasteleria_orion_suppliers';

interface SupabaseSupplierRow {
  id: string;
  name: string;
  phone: string;
  delivery_schedule: string;
  category: string;
  approximate_prices: string;
  contact_person?: string | null;
  icon?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

function mapRowToSupplier(row: SupabaseSupplierRow): Supplier {
  const s: Supplier = {
    id: row.id,
    name: row.name,
    phone: row.phone,
    deliverySchedule: row.delivery_schedule,
    category: row.category,
    approximatePrices: row.approximate_prices,
    contactPerson: row.contact_person || undefined,
    icon: row.icon || '🚚',
    email: row.email || undefined,
    address: row.address || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  s.supplyModality = getSupplyModality(s);
  return s;
}

/* Genera enlace a Google Maps */
export function getGoogleMapsUrl(address: string): string {
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/* Detecta modo de abastecimiento */
export function getSupplyModality(supplier: Supplier): SupplyModality {
  if (supplier.supplyModality) return supplier.supplyModality;
  const schedule = (supplier.deliverySchedule || '').toLowerCase();
  const notes = (supplier.notes || '').toLowerCase();
  const name = (supplier.name || '').toLowerCase();
  if (
    schedule.includes('presencial') ||
    schedule.includes('retiro') ||
    schedule.includes('local') ||
    schedule.includes('mayorista') ||
    notes.includes('presencial') ||
    notes.includes('local') ||
    notes.includes('mayorista') ||
    name.includes('mayorista') ||
    name.includes('vega') ||
    supplier.icon === '🏬' ||
    supplier.icon === '🏪' ||
    supplier.icon === '🛒'
  ) {
    return 'presencial';
  }
  return 'despacho';
}

/**
 * Limpia y normaliza el número de teléfono para enlaces de WhatsApp (wa.me)
 */
export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');

  if (digits.startsWith('56') && digits.length >= 11) {
    return digits;
  }
  if (digits.length === 9 && digits.startsWith('9')) {
    return `56${digits}`;
  }
  if (digits.length === 8) {
    return `569${digits}`;
  }
  if (digits.length >= 10) {
    return digits;
  }
  return digits;
}

/**
 * Limpia el número para llamadas telefónicas (tel:)
 */
export function formatPhoneForCall(phone: string): string {
  if (!phone) return '';
  return phone.replace(/[^\d+]/g, '');
}

/**
 * Genera la URL directa a WhatsApp con un mensaje pre-armado
 */
export function getWhatsAppUrl(
  phone: string,
  supplierName?: string,
  customMessage?: string
): string {
  const cleanPhone = formatPhoneForWhatsApp(phone);
  if (!cleanPhone) return '#';

  const defaultMsg = supplierName
    ? `Hola ${supplierName}, te escribo desde Pastelería Orión. Quisiera cotizar / consultar disponibilidad de materias primas.`
    : `Hola, te escribo desde Pastelería Orión. Quisiera cotizar / consultar disponibilidad de materias primas.`;

  const msg = encodeURIComponent(customMessage?.trim() || defaultMsg);
  return `https://wa.me/${cleanPhone}?text=${msg}`;
}

/**
 * Genera el enlace telefónico para llamar
 */
export function getCallUrl(phone: string): string {
  const cleanPhone = formatPhoneForCall(phone);
  if (!cleanPhone) return '#';
  return `tel:${cleanPhone}`;
}

export const supplierService = {
  /**
   * Obtiene la lista desde localStorage (sin ejemplos por defecto)
   */
  getFromLocalStorage(): Supplier[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          // Filtrar cualquier ejemplo de prueba anterior que empiece por supp-1, supp-2...
          const cleaned = parsed.filter(
            (s: Supplier) => !['supp-1', 'supp-2', 'supp-3', 'supp-4', 'supp-5'].includes(s.id)
          );
          if (cleaned.length !== parsed.length) {
            this.saveAll(cleaned);
          }
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('Error leyendo proveedores de localStorage:', e);
    }
    return [];
  },

  /**
   * Guarda la lista completa en localStorage
   */
  saveAll(suppliers: Supplier[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(suppliers));
    } catch (e) {
      console.error('Error guardando proveedores en localStorage:', e);
    }
  },

  /**
   * Obtiene todos los proveedores directamente de la base de datos (Supabase)
   */
  async getAll(): Promise<Supplier[]> {
    // 1. Si Supabase está disponible, extraer directamente de la base de datos
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          const mapped = (data as SupabaseSupplierRow[]).map(mapRowToSupplier);
          this.saveAll(mapped);
          return mapped;
        }
        if (error) {
          console.warn('[supplierService] Error al consultar Supabase:', error.message);
        }
      } catch (err) {
        console.warn('[supplierService] Fallo de conexión con Supabase:', err);
      }
    }

    // 2. Si no hay Supabase o no hay conexión, obtener de almacenamiento local (sin datos falsos)
    return this.getFromLocalStorage();
  },

  /**
   * Registra un nuevo proveedor en la base de datos
   */
  async create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const localList = this.getFromLocalStorage();

    // 1. Persistir en la base de datos Supabase
    if (supabase) {
      try {
        const { data: inserted, error } = await supabase
          .from('suppliers')
          .insert({
            name: data.name,
            phone: data.phone,
            delivery_schedule: data.deliverySchedule,
            category: data.category,
            approximate_prices: data.approximatePrices,
            contact_person: data.contactPerson || null,
            icon: data.icon || '🚚',
            email: data.email || null,
            address: data.address || null,
            notes: data.notes || null,
          })
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (inserted) {
          const cloudSupplier = mapRowToSupplier(inserted as SupabaseSupplierRow);
          this.saveAll([cloudSupplier, ...localList]);
          return cloudSupplier;
        }
      } catch (err) {
        console.error('[supplierService] Error insertando en Supabase:', err);
        // Si falló Supabase, lanzar el error para que el usuario esté informado
        if (supabase) {
          throw err;
        }
      }
    }

    // Fallback solo si Supabase no está configurado en el proyecto
    const fallbackId = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'prov-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);

    const localSupplier: Supplier = {
      ...data,
      id: fallbackId,
      icon: data.icon || '🚚',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.saveAll([localSupplier, ...localList]);
    return localSupplier;
  },

  /**
   * Actualiza un proveedor existente en la base de datos
   */
  async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const list = this.getFromLocalStorage();
    const index = list.findIndex((s) => s.id === id);

    if (supabase) {
      try {
        const { data: updatedRow, error } = await supabase
          .from('suppliers')
          .update({
            ...(updates.name !== undefined && { name: updates.name }),
            ...(updates.phone !== undefined && { phone: updates.phone }),
            ...(updates.deliverySchedule !== undefined && { delivery_schedule: updates.deliverySchedule }),
            ...(updates.category !== undefined && { category: updates.category }),
            ...(updates.approximatePrices !== undefined && { approximate_prices: updates.approximatePrices }),
            ...(updates.contactPerson !== undefined && { contact_person: updates.contactPerson || null }),
            ...(updates.icon !== undefined && { icon: updates.icon }),
            ...(updates.email !== undefined && { email: updates.email || null }),
            ...(updates.address !== undefined && { address: updates.address || null }),
            ...(updates.notes !== undefined && { notes: updates.notes || null }),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();

        if (error) {
          throw new Error(error.message);
        }

        if (updatedRow) {
          const cloudUpdated = mapRowToSupplier(updatedRow as SupabaseSupplierRow);
          if (index !== -1) {
            list[index] = cloudUpdated;
          } else {
            list.unshift(cloudUpdated);
          }
          this.saveAll(list);
          return cloudUpdated;
        }
      } catch (err) {
        console.error('[supplierService] Error actualizando en Supabase:', err);
        throw err;
      }
    }

    const updatedItem: Supplier = {
      ...(index !== -1 ? list[index] : (updates as Supplier)),
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    if (index !== -1) {
      list[index] = updatedItem;
      this.saveAll(list);
    }
    return updatedItem;
  },

  /**
   * Elimina permanentemente un proveedor de la base de datos
   */
  async delete(id: string): Promise<boolean> {
    if (supabase) {
      try {
        const { error } = await supabase.from('suppliers').delete().eq('id', id);
        if (error) {
          console.error('[supplierService] Error eliminando en Supabase:', error.message);
          throw new Error(error.message);
        }
      } catch (err) {
        console.error('[supplierService] Error en delete Supabase:', err);
        throw err;
      }
    }

    // Actualizar almacenamiento local
    const list = this.getFromLocalStorage();
    const filtered = list.filter((s) => s.id !== id);
    this.saveAll(filtered);

    return true;
  },
};
