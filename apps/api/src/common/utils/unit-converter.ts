export type BaseUnitFamily = 'mass' | 'volume' | 'count';

export interface NormalizedUnit {
  value: number;
  type: BaseUnitFamily;
}

const MASS_UNITS_KG = new Set([
  'kg',
  'kilo',
  'kilos',
  'kilogramo',
  'kilogramos',
]);
const MASS_UNITS_G = new Set(['g', 'gr', 'gramo', 'gramos']);
const VOLUME_UNITS_L = new Set(['l', 'lt', 'lts', 'litro', 'litros']);
const VOLUME_UNITS_ML = new Set(['ml', 'cc', 'mililitro', 'mililitros']);
const COUNT_UNITS = new Set([
  'un',
  'u',
  'ud',
  'uds',
  'unidad',
  'unidades',
  'pieza',
  'piezas',
]);

/**
 * Normalizador estricto de unidades para comparar y descontar stock vs receta.
 * Convierte masas a gramos, volúmenes a mililitros y conteos conocidos a unidades.
 * Retorna `null` para cantidades no finitas o unidades desconocidas/ambiguas.
 */
export function toBaseUnits(
  qty: number,
  unit: string,
): NormalizedUnit | null {
  if (!Number.isFinite(qty) || typeof unit !== 'string') {
    return null;
  }

  const normalized = unit.toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  if (MASS_UNITS_KG.has(normalized)) {
    return { value: qty * 1000, type: 'mass' };
  }
  if (MASS_UNITS_G.has(normalized)) {
    return { value: qty, type: 'mass' };
  }
  if (VOLUME_UNITS_L.has(normalized)) {
    return { value: qty * 1000, type: 'volume' };
  }
  if (VOLUME_UNITS_ML.has(normalized)) {
    return { value: qty, type: 'volume' };
  }
  if (COUNT_UNITS.has(normalized)) {
    return { value: qty, type: 'count' };
  }

  return null;
}

/**
 * Convierte una cantidad desde `fromUnit` hacia `toUnit` dentro de la misma familia
 * dimensional (`mass`, `volume` o `count`). Retorna `null` si alguna unidad es
 * desconocida o si pertenecen a familias incompatibles.
 */
export function convertToTargetUnit(
  qty: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const fromNorm = toBaseUnits(qty, fromUnit);
  const toNorm = toBaseUnits(1, toUnit);

  if (!fromNorm || !toNorm || fromNorm.type !== toNorm.type || toNorm.value <= 0) {
    return null;
  }

  return fromNorm.value / toNorm.value;
}
