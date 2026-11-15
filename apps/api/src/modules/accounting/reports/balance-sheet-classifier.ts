export type AssetBalanceBucket = 'disponible' | 'inventarios' | 'otrosActivos';
export type LiabilityBalanceBucket =
  | 'obligaciones'
  | 'impuestos'
  | 'otrosPasivos';

interface AccountClassificationRule<TBucket extends string> {
  bucket: TBucket;
  codes: ReadonlySet<string>;
  namePattern: RegExp;
}

const ASSET_CLASSIFICATION_RULES: ReadonlyArray<
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

const LIABILITY_CLASSIFICATION_RULES: ReadonlyArray<
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

function classifyByRules<TBucket extends string>(
  code: string,
  name: string,
  rules: ReadonlyArray<AccountClassificationRule<TBucket>>,
  fallback: TBucket,
): TBucket {
  const matched = rules.find(
    (rule) => rule.codes.has(code) || rule.namePattern.test(name),
  );
  return matched ? matched.bucket : fallback;
}

export function classifyAssetBucket(
  code: string,
  name: string,
): AssetBalanceBucket {
  return classifyByRules(code, name, ASSET_CLASSIFICATION_RULES, 'otrosActivos');
}

export function classifyLiabilityBucket(
  code: string,
  name: string,
): LiabilityBalanceBucket {
  return classifyByRules(
    code,
    name,
    LIABILITY_CLASSIFICATION_RULES,
    'otrosPasivos',
  );
}
