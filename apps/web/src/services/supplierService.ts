import type { Supplier, SupplyModality } from '../types';
import { apiFetch } from '../lib/api';

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

export const supplierService = {
  async getAll(type?: string): Promise<Supplier[]> {
    const query = type ? `?type=${encodeURIComponent(type)}` : '';
    const items = await apiFetch<Supplier[]>(`/suppliers${query}`);
    return items.map((s) => ({
      ...s,
      supplyModality: s.supplyModality || getSupplyModality(s),
    }));
  },

  async getById(id: string): Promise<Supplier> {
    const s = await apiFetch<Supplier>(`/suppliers/${id}`);
    return {
      ...s,
      supplyModality: s.supplyModality || getSupplyModality(s),
    };
  },

  async create(data: Omit<Supplier, 'id' | 'createdAt' | 'updatedAt'>): Promise<Supplier> {
    const created = await apiFetch<Supplier>('/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return {
      ...created,
      supplyModality: created.supplyModality || getSupplyModality(created),
    };
  },

  async update(id: string, updates: Partial<Supplier>): Promise<Supplier> {
    const updated = await apiFetch<Supplier>(`/suppliers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    return {
      ...updated,
      supplyModality: updated.supplyModality || getSupplyModality(updated),
    };
  },

  async delete(id: string): Promise<boolean> {
    await apiFetch<{ success: boolean; id: string }>(`/suppliers/${id}`, {
      method: 'DELETE',
    });
    return true;
  },
};