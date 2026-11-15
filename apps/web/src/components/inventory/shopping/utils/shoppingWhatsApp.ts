import type { ShoppingItem } from '../../../../types';

export function formatShoppingListForWhatsApp(
  items: ShoppingItem[],
  timezone: string,
): string {
  const today = new Date().toLocaleDateString('es-CL', {
    timeZone: timezone,
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const ingItems = items.filter((p) => p.kind === 'ingredient');
  const resItems = items.filter((p) => p.kind === 'resale');
  const packItems = items.filter((p) => p.kind === 'packaging');
  const supplyItems = items.filter((p) => p.kind === 'general_supply');

  let text = `🛒 *LISTA DE COMPRAS - PASTELERÍA ORIÓN*\n`;
  text += `📅 Fecha: ${today}\n`;
  text += `📦 Total de ítems a reponer: *${items.length}*\n\n`;

  if (ingItems.length > 0) {
    text += `🌾 *MATERIAS PRIMAS / INSUMOS (${ingItems.length}):*\n`;
    ingItems.forEach((item) => {
      const deficit = Math.max(0, item.minStock - item.stock);
      const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
      text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
    });
    text += `\n`;
  }

  if (resItems.length > 0) {
    text += `🥤 *PRODUCTOS DE REVENTA (${resItems.length}):*\n`;
    resItems.forEach((item) => {
      const deficit = Math.max(0, item.minStock - item.stock);
      const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
      text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
    });
    text += `\n`;
  }

  if (packItems.length > 0) {
    text += `📦 *EMPAQUES Y ENVASES (${packItems.length}):*\n`;
    packItems.forEach((item) => {
      const deficit = Math.max(0, item.minStock - item.stock);
      const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
      text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
    });
    text += `\n`;
  }

  if (supplyItems.length > 0) {
    text += `🧤 *INSUMOS GENERALES (${supplyItems.length}):*\n`;
    supplyItems.forEach((item) => {
      const deficit = Math.max(0, item.minStock - item.stock);
      const status = item.stock <= 0 ? '🚨 AGOTADO' : `quedan ${item.stock} ${item.unit}`;
      text += `• ${item.name}: Comprar *${deficit} ${item.unit}* (${status})\n`;
    });
    text += `\n`;
  }

  text += `🍰 _Pastelería Orión ERP_`;
  return text;
}
