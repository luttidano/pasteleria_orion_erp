/**
 * Utilidades de redondeo financiero/stock y reglas monetarias del dominio.
 */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export function roundPercentage(value: number): number {
  return Math.round((value + Number.EPSILON) * 10) / 10;
}

/**
 * Regla comercial/legal (Ley de Bolsas):
 * bolsas secundarias de despacho se cobran a $100 CLP; otros empaques secundarios son cortesía ($0).
 */
export function resolveSecondaryPackagingPrice(packagingName: string): number {
  return packagingName.toLowerCase().includes('bolsa') ? 100 : 0;
}
