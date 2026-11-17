export type AssetBalanceBucket = 'disponible' | 'inventarios' | 'otrosActivos';
export type LiabilityBalanceBucket =
  | 'obligaciones'
  | 'impuestos'
  | 'otrosPasivos';

export interface AccountClassificationRule<TBucket extends string> {
  bucket: TBucket;
  codes?: ReadonlySet<string> | readonly string[];
  codePrefixes?: readonly string[];
  namePattern?: RegExp | string;
  matcher?: (code: string, name: string) => boolean;
}

/**
 * Reglas por defecto para clasificar cuentas de Activo en el Balance General.
 * Abiertas a extensión o reemplazo mediante inyección de reglas personalizadas.
 */
export const DEFAULT_ASSET_CLASSIFICATION_RULES: ReadonlyArray<
  AccountClassificationRule<AssetBalanceBucket>
> = [
  {
    bucket: 'disponible',
    codes: new Set(['1101', '1102', '1103', '1104']),
    namePattern: /caja|banco|transbank|transferencia/i,
  },
  {
    bucket: 'inventarios',
    codes: new Set(['1105', '1106']),
    namePattern: /inventario|materia|terminado/i,
  },
];

/**
 * Reglas por defecto para clasificar cuentas de Pasivo en el Balance General.
 * Ordenadas por precedencia tributaria (los impuestos tienen prioridad sobre 'por pagar').
 */
export const DEFAULT_LIABILITY_CLASSIFICATION_RULES: ReadonlyArray<
  AccountClassificationRule<LiabilityBalanceBucket>
> = [
  {
    bucket: 'impuestos',
    codes: new Set(['2102', '2105']),
    namePattern: /iva|impuesto|retenc|ppm|f29/i,
  },
  {
    bucket: 'obligaciones',
    codes: new Set(['2101']),
    namePattern: /proveedor|por pagar|acreedor/i,
  },
];
