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
    codes: new Set(['1.1.01.01', '1.1.01.02', '1.1.01.03', '1.1.01.04']),
    codePrefixes: ['1.1.01'],
    namePattern: /caja|banco|transbank|transferencia/i,
  },
  {
    bucket: 'inventarios',
    codes: new Set(['1.1.02.01', '1.1.02.02', '1.1.02.03']),
    codePrefixes: ['1.1.02'],
    namePattern: /inventario|materia|terminado|empaque/i,
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
    codes: new Set(['2.1.02.01', '2.1.02.02']),
    codePrefixes: ['2.1.02'],
    namePattern: /iva|impuesto|retenc|ppm|f29/i,
  },
  {
    bucket: 'obligaciones',
    codes: new Set(['2.1.01.01']),
    codePrefixes: ['2.1.01'],
    namePattern: /proveedor|por pagar|acreedor/i,
  },
];
