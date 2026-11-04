import type { Supplier, SupplierType, SupplyModality } from '../types';
import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';

const CACHE_KEY = 'pasteleria_orion_suppliers_cache';

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

export function formatPhoneForWhatsApp(phone: string): string {
  if (!phone || phone === 'Sin registrar') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('56') && digits.length >= 11) return digits;
  if (digits.length === 9 && digits.startsWith('9')) return `56${digits}`;
  if (digits.length === 8) return `569${digits}`;
  if (digits.length >= 10) return digits;
  return digits;
}

export function formatPhoneForCall(phone: string): string {
  if (!phone || phone === 'Sin registrar') return '';
  return phone.replace(/[^\d+]/g, '');
}

export function getGoogleMapsUrl(address: string): string {
  if (!address) return '';
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

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

export function getCallUrl(phone: string): string {
  const cleanPhone = formatPhoneForCall(phone);
  if (!cleanPhone) return '#';
  return `tel:${cleanPhone}`;
}

function mapRowToSupplier(row: any): Supplier {
  const supplierTypes: SupplierType[] = Array.isArray(row.supplier_types)
    ? row.supplier_types
    : Array.isArray(row.supplierTypes)
      ? row.supplierTypes
      : [row.supplier_type || 'materia_prima'];

  const s: Supplier = {
    id: row.id,
    name: row.name,
    phone: row.phone || '',
    deliverySchedule: row.delivery_schedule || row.deliverySchedule || 'No especificado',
    category: row.category || 'Varios',
    approximatePrices: row.approximate_prices || row.approximatePrices || 'A convenir',
    supplierTypes,
    supplierType: supplierTypes[0] || 'materia_prima',
    contactPerson: row.contact_person || row.contactPerson || undefined,
    icon: row.icon || '🚚',
    email: row.email || undefined,
    address: row.address || undefined,
    notes: row.notes || undefined,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
    ingredientsCount: Array.isArray(row.supplierIngredients)
      ? row.supplierIngredients.length
      : (row.ingredientsCount ?? 0),
    resaleProductsCount: Array.isArray(row.resaleProducts)
      ? row.resaleProducts.length
      : (row.resaleProductsCount ?? 0),
  };

  return {
    ...s,
    supplyModality: row.supply_modality || row.supplyModality || getSupplyModality(s),
  };
}

export const supplierService = {
  /**
   * Obtiene la caché local de proveedores
   */
  getCached(): Supplier[] {
    try {
      const data = localStorage.getItem(CACHE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Ignorar fallo de lectura de caché
    }
    return [];
  },

  /**
   * Guarda los proveedores en caché local
   */
  setCached(items: Supplier[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch {
      // Ignorar fallo de escritura de caché
    }
  },

  /**
   * Obtiene todos los proveedores con recuperación transparente vía Supabase REST directo
   */
  async getAll(type?: string): Promise<Supplier[]> {
    // 1. Intentar backend NestJS
    try {
      const query = type ? `?type=${encodeURIComponent(type)}` : '';
      const items = await apiFetch<Supplier[]>(`/suppliers${query}`);
      const mapped = items.map((s) => ({
        ...s,
        supplyModality: s.supplyModality || getSupplyModality(s),
      }));
      this.setCached(mapped);
      return mapped;
    } catch (err) {
      console.warn('[supplierService] API backend demoró o falló. Intentando fallback Supabase:', err);

      // 2. Fallback resiliente directo a Supabase
      if (supabase) {
        try {
          let query = supabase
            .from('supplier')
            .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
            .order('name', { ascending: true });

          if (type) {
            query = query.contains('supplier_types', [type]);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            const mapped = data.map(mapRowToSupplier);
            if (!type) this.setCached(mapped);
            return mapped;
          }
        } catch (sbErr) {
          console.warn('[supplierService] Fallback Supabase falló:', sbErr);
        }
      }

      // 3. Fallback a caché local si la red está completamente caída
      const cached = this.getCached();
      if (cached.length > 0) {
        if (type) {
          return cached.filter((s) => s.supplierTypes?.includes(type as SupplierType));
        }
        return cached;
      }

      // Retorno resiliente de lista vacía en lugar de romper la interfaz de usuario
      return [];
    }
  },

  async getById(id: string): Promise<Supplier> {
    try {
      const s = await apiFetch<Supplier>(`/suppliers/${id}`);
      return {
        ...s,
        supplyModality: s.supplyModality || getSupplyModality(s),
      };
    } catch (err) {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('supplier')
            .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
            .eq('id', id)
            .maybeSingle();

          if (!error && data) {
            return mapRowToSupplier(data);
          }
        } catch {
          // Ignorar fallo de Supabase
        }
      }
      const cached = this.getCached().find((s) => s.id === id);
      if (cached) return cached;
      throw err;
    }
  },

  async create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    try {
      const created = await apiFetch<Supplier>('/suppliers', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const mapped = {
        ...created,
        supplyModality: created.supplyModality || getSupplyModality(created),
      };
      const cached = this.getCached();
      this.setCached([...cached, mapped]);
      return mapped;
    } catch (err) {
      console.warn('[supplierService] API create falló, intentando Supabase directo:', err);
      if (supabase) {
        const payload: Record<string, any> = {
          name: data.name,
          phone: data.phone,
          delivery_schedule: data.deliverySchedule || 'No especificado',
          category: data.category || 'General',
          approximate_prices: data.approximatePrices || 'A convenir',
          contact_person: data.contactPerson || null,
          icon: data.icon || '🚚',
          email: data.email || null,
          address: data.address || null,
          notes: data.notes || null,
          supplier_types:
            data.supplierTypes && data.supplierTypes.length > 0 ? data.supplierTypes : ['materia_prima'],
        };

        const { data: created, error } = await supabase
          .from('supplier')
          .insert(payload)
          .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
          .single();

        if (!error && created) {
          const mapped = mapRowToSupplier(created);
          const cached = this.getCached();
          this.setCached([...cached, mapped]);
          return mapped;
        }
      }
      throw err;
    }
  },

  async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    try {
      const updated = await apiFetch<Supplier>(`/suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      const mapped = {
        ...updated,
        supplyModality: updated.supplyModality || getSupplyModality(updated),
      };
      const cached = this.getCached().map((s) => (s.id === id ? mapped : s));
      this.setCached(cached);
      return mapped;
    } catch (err) {
      console.warn('[supplierService] API update falló, intentando Supabase directo:', err);
      if (supabase) {
        const payload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.phone !== undefined) payload.phone = updates.phone;
        if (updates.deliverySchedule !== undefined) payload.delivery_schedule = updates.deliverySchedule;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.approximatePrices !== undefined) payload.approximate_prices = updates.approximatePrices;
        if (updates.contactPerson !== undefined) payload.contact_person = updates.contactPerson;
        if (updates.icon !== undefined) payload.icon = updates.icon;
        if (updates.email !== undefined) payload.email = updates.email;
        if (updates.address !== undefined) payload.address = updates.address;
        if (updates.notes !== undefined) payload.notes = updates.notes;
        if (updates.supplierTypes !== undefined) payload.supplier_types = updates.supplierTypes;

        const { data: updated, error } = await supabase
          .from('supplier')
          .update(payload)
          .eq('id', id)
          .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
          .single();

        if (!error && updated) {
          const mapped = mapRowToSupplier(updated);
          const cached = this.getCached().map((s) => (s.id === id ? mapped : s));
          this.setCached(cached);
          return mapped;
        }
      }
      throw err;
    }
  },

  async delete(id: string): Promise<boolean> {
    try {
      await apiFetch<{ success: boolean; id: string }>(`/suppliers/${id}`, {
        method: 'DELETE',
      });
      const cached = this.getCached().filter((s) => s.id !== id);
      this.setCached(cached);
      return true;
    } catch (err) {
      console.warn('[supplierService] API delete falló, intentando Supabase directo:', err);
      if (supabase) {
        const { error } = await supabase.from('supplier').delete().eq('id', id);
        if (!error) {
          const cached = this.getCached().filter((s) => s.id !== id);
          this.setCached(cached);
          return true;
        }
      }
      throw err;
    }
  },
};
