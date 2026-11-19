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
 * Regla comercial/legal (Ley de Bolsas y Precio de Venta):
 * Si el empaque tiene salePrice configurado >= 0 se respeta dicho valor;
 * de lo contrario, las bolsas secundarias de despacho se cobran a $100 CLP y otros empaques a $0.
 */
export function resolveSecondaryPackagingPrice(
  packagingName: string,
  salePrice?: number | null,
): number {
  if (typeof salePrice === 'number' && Number.isFinite(salePrice) && salePrice >= 0) {
    return Math.round(salePrice);
  }
  return packagingName.toLowerCase().includes('bolsa') ? 100 : 0;
}
