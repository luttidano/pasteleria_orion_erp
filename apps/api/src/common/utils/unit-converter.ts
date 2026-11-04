/**
 * Normalizador de unidades para comparar y descontar stock vs receta.
 * Convierte masas a gramos, volúmenes a mililitros y conteos a unidades.
 */
export function toBaseUnits(
  qty: number,
  unit: string,
): { value: number; type: 'mass' | 'volume' | 'count' } {
  const u = (unit || '').toLowerCase().trim();
  if (['kg', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) {
    return { value: qty * 1000, type: 'mass' };
  }
  if (['g', 'gr', 'gramo', 'gramos'].includes(u)) {
    return { value: qty, type: 'mass' };
  }
  if (['l', 'lt', 'litro', 'litros'].includes(u)) {
    return { value: qty * 1000, type: 'volume' };
  }
  if (['ml', 'cc', 'mililitro', 'mililitros'].includes(u)) {
    return { value: qty, type: 'volume' };
  }
  return { value: qty, type: 'count' };
}

