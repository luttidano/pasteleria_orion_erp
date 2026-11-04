import { apiFetch } from '../lib/api';
import { supabase } from '../lib/supabase';
import type { Packaging, StockStatus } from '../types';

const CACHE_KEY = 'pasteleria_orion_packaging_cache';

function mapRowToPackaging(row: any): Packaging {
  const stock = Number(row.stock || 0);
  const minStock = Number(row.min_stock ?? row.minStock ?? 0);
  let status: StockStatus = 'suficiente';
  if (stock <= 0) status = 'agotado';
  else if (stock <= minStock) status = 'bajo';

  return {
    id: row.id,
    name: row.name,
    packageType: row.package_type || row.packageType,
    category: row.category,
    stock,
    minStock,
    unit: row.unit || 'un',
    costPrice:
      row.cost_price !== null && row.cost_price !== undefined
        ? Number(row.cost_price)
        : row.costPrice !== null && row.costPrice !== undefined
          ? Number(row.costPrice)
          : 0,
    supplierId: row.supplier_id || row.supplierId || undefined,
    supplier: row.supplier
      ? {
          id: row.supplier.id,
          name: row.supplier.name,
          phone: row.supplier.phone || '',
          deliverySchedule: row.supplier.delivery_schedule || row.supplier.deliverySchedule || '',
          category: row.supplier.category || '',
          approximatePrices: row.supplier.approximate_prices || row.supplier.approximatePrices || '',
          supplierTypes: row.supplier.supplier_types || row.supplier.supplierTypes || ['empaque'],
          contactPerson: row.supplier.contact_person || row.supplier.contactPerson,
          icon: row.supplier.icon || '📦',
          email: row.supplier.email,
          address: row.supplier.address,
          notes: row.supplier.notes,
        }
      : undefined,
    icon: row.icon || '📦',
    description: row.description || '',
    status,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export const packagingService = {
  /**
   * Obtiene la caché local de empaques
   */
  getCached(): Packaging[] {
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
   * Guarda los empaques en caché local
   */
  setCached(items: Packaging[]): void {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(items));
    } catch {
      // Ignorar fallo de escritura de caché
    }
  },

  /**
   * Obtiene todos los empaques y envases (filtro opcional por tipo)
   * con recuperación transparente vía Supabase REST directo y caché local ante desconexión
   */
  async getAll(type?: string): Promise<Packaging[]> {
    // 1. Intentar backend NestJS
    try {
      const query = type ? `?type=${encodeURIComponent(type)}` : '';
      const items = await apiFetch<Packaging[]>(`/packaging${query}`);
      const mapped = items.map(mapRowToPackaging);
      this.setCached(mapped);
      return mapped;
    } catch (err) {
      console.warn('[packagingService] API backend demoró o falló. Intentando fallback Supabase:', err);

      // 2. Fallback resiliente directo a Supabase
      if (supabase) {
        try {
          let query = supabase
            .from('packaging')
            .select('*, supplier:supplier(*)')
            .order('package_type', { ascending: true })
            .order('name', { ascending: true });

          if (type && (type === 'primario' || type === 'secundario')) {
            query = query.eq('package_type', type);
          }

          const { data, error } = await query;
          if (!error && Array.isArray(data)) {
            const mapped = data.map(mapRowToPackaging);
            if (!type) this.setCached(mapped);
            return mapped;
          }
        } catch (sbErr) {
          console.warn('[packagingService] Fallback Supabase falló:', sbErr);
        }
      }

      // 3. Fallback a caché local si la red está completamente caída
      const cached = this.getCached();
      if (cached.length > 0) {
        if (type && (type === 'primario' || type === 'secundario')) {
          return cached.filter((i) => i.packageType === type);
        }
        return cached;
      }

      // Retorno resiliente de lista vacía en lugar de romper la interfaz de usuario
      return [];
    }
  },

  /**
   * Obtiene un empaque específico por ID
   */
  async getById(id: string): Promise<Packaging> {
    try {
      const item = await apiFetch<Packaging>(`/packaging/${id}`);
      return mapRowToPackaging(item);
    } catch (err) {
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('packaging')
            .select('*, supplier:supplier(*)')
            .eq('id', id)
            .maybeSingle();

          if (!error && data) {
            return mapRowToPackaging(data);
          }
        } catch {
          // Ignorar fallo de Supabase
        }
      }
      const cached = this.getCached().find((p) => p.id === id);
      if (cached) return cached;
      throw err;
    }
  },

  /**
   * Registra un nuevo empaque o envase
   */
  async create(data: Partial<Packaging>): Promise<Packaging> {
    try {
      const created = await apiFetch<Packaging>('/packaging', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      const mapped = mapRowToPackaging(created);
      const cached = this.getCached();
      this.setCached([...cached, mapped]);
      return mapped;
    } catch (err) {
      console.warn('[packagingService] API create falló, intentando Supabase directo:', err);
      if (supabase) {
        const payload: Record<string, any> = {
          name: data.name,
          package_type: data.packageType || 'primario',
          category: data.category || 'Cajas',
          stock: data.stock ?? 0,
          min_stock: data.minStock ?? 0,
          unit: data.unit || 'un',
          cost_price: data.costPrice ?? 0,
          supplier_id: data.supplierId || null,
          icon: data.icon || '📦',
          description: data.description || null,
        };

        const { data: created, error } = await supabase
          .from('packaging')
          .insert(payload)
          .select('*, supplier:supplier(*)')
          .single();

        if (!error && created) {
          const mapped = mapRowToPackaging(created);
          const cached = this.getCached();
          this.setCached([...cached, mapped]);
          return mapped;
        }
      }
      throw err;
    }
  },

  /**
   * Actualiza los datos de un empaque
   */
  async update(id: string, data: Partial<Packaging>): Promise<Packaging> {
    try {
      const updated = await apiFetch<Packaging>(`/packaging/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      const mapped = mapRowToPackaging(updated);
      const cached = this.getCached().map((p) => (p.id === id ? mapped : p));
      this.setCached(cached);
      return mapped;
    } catch (err) {
      console.warn('[packagingService] API update falló, intentando Supabase directo:', err);
      if (supabase) {
        const payload: Record<string, any> = { updated_at: new Date().toISOString() };
        if (data.name !== undefined) payload.name = data.name;
        if (data.packageType !== undefined) payload.package_type = data.packageType;
        if (data.category !== undefined) payload.category = data.category;
        if (data.stock !== undefined) payload.stock = data.stock;
        if (data.minStock !== undefined) payload.min_stock = data.minStock;
        if (data.unit !== undefined) payload.unit = data.unit;
        if (data.costPrice !== undefined) payload.cost_price = data.costPrice;
        if (data.supplierId !== undefined) payload.supplier_id = data.supplierId || null;
        if (data.icon !== undefined) payload.icon = data.icon;
        if (data.description !== undefined) payload.description = data.description;

        const { data: updated, error } = await supabase
          .from('packaging')
          .update(payload)
          .eq('id', id)
          .select('*, supplier:supplier(*)')
          .single();

        if (!error && updated) {
          const mapped = mapRowToPackaging(updated);
          const cached = this.getCached().map((p) => (p.id === id ? mapped : p));
          this.setCached(cached);
          return mapped;
        }
      }
      throw err;
    }
  },

  /**
   * Ajuste de stock rápido (+ / -)
   */
  async adjustStock(id: string, delta: number): Promise<Packaging> {
    try {
      const result = await apiFetch<Packaging>(`/packaging/${id}/adjust-stock`, {
        method: 'POST',
        body: JSON.stringify({ delta }),
      });
      const mapped = mapRowToPackaging(result);
      const cached = this.getCached().map((p) => (p.id === id ? mapped : p));
      this.setCached(cached);
      return mapped;
    } catch (err) {
      console.warn('[packagingService] API adjustStock falló, intentando Supabase directo:', err);
      if (supabase) {
        const { data: current, error: getErr } = await supabase
          .from('packaging')
          .select('stock')
          .eq('id', id)
          .single();

        if (!getErr && current) {
          const newStock = Math.max(0, Number(current.stock) + delta);
          const { data: updated, error: updErr } = await supabase
            .from('packaging')
            .update({ stock: newStock, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select('*, supplier:supplier(*)')
            .single();

          if (!updErr && updated) {
            const mapped = mapRowToPackaging(updated);
            const cached = this.getCached().map((p) => (p.id === id ? mapped : p));
            this.setCached(cached);
            return mapped;
          }
        }
      }
      throw err;
    }
  },

  /**
   * Elimina un empaque del catálogo
   */
  async delete(id: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await apiFetch<{ success: boolean; message: string }>(`/packaging/${id}`, {
        method: 'DELETE',
      });
      const cached = this.getCached().filter((p) => p.id !== id);
      this.setCached(cached);
      return res;
    } catch (err) {
      console.warn('[packagingService] API delete falló, intentando Supabase directo:', err);
      if (supabase) {
        const { error } = await supabase.from('packaging').delete().eq('id', id);
        if (!error) {
          const cached = this.getCached().filter((p) => p.id !== id);
          this.setCached(cached);
          return { success: true, message: 'Empaque eliminado correctamente.' };
        }
      }
      throw err;
    }
  },
};
