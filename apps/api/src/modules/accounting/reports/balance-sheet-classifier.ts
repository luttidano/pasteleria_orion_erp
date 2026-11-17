import {
  AccountClassificationRule,
  AssetBalanceBucket,
  DEFAULT_ASSET_CLASSIFICATION_RULES,
  DEFAULT_LIABILITY_CLASSIFICATION_RULES,
  LiabilityBalanceBucket,
} from './balance-sheet-rules.config';

export type { AssetBalanceBucket, LiabilityBalanceBucket, AccountClassificationRule };

/**
 * Evalúa si una cuenta coincide con una regla de clasificación.
 * Admite códigos explícitos, prefijos de código, expresiones regulares o matchers personalizados.
 */
export function matchesClassificationRule<TBucket extends string>(
  code: string,
  name: string,
  rule: AccountClassificationRule<TBucket>,
): boolean {
  if (rule.matcher && rule.matcher(code, name)) {
    return true;
  }

  if (rule.codes) {
    if (rule.codes instanceof Set && rule.codes.has(code)) {
      return true;
    }
    if (Array.isArray(rule.codes) && rule.codes.includes(code)) {
      return true;
    }
  }

  if (rule.codePrefixes && rule.codePrefixes.some((prefix) => code.startsWith(prefix))) {
    return true;
  }

  if (rule.namePattern) {
    const pattern =
      typeof rule.namePattern === 'string'
        ? new RegExp(rule.namePattern, 'i')
        : rule.namePattern;
    if (pattern.test(name)) {
      return true;
    }
  }

  return false;
}

/**
 * Clasifica una cuenta iterando un conjunto de reglas ordenadas por precedencia.
 * Cumple OCP: permite inyectar reglas adicionales sin modificar la lógica interna.
 */
export function classifyByRules<TBucket extends string>(
  code: string,
  name: string,
  rules: ReadonlyArray<AccountClassificationRule<TBucket>>,
  fallback: TBucket,
): TBucket {
  const matched = rules.find((rule) => matchesClassificationRule(code, name, rule));
  return matched ? matched.bucket : fallback;
}

export function classifyAssetBucket(
  code: string,
  name: string,
  customRules?: ReadonlyArray<AccountClassificationRule<AssetBalanceBucket>>,
): AssetBalanceBucket {
  return classifyByRules(
    code,
    name,
    customRules ?? DEFAULT_ASSET_CLASSIFICATION_RULES,
    'otrosActivos',
  );
}

export function classifyLiabilityBucket(
  code: string,
  name: string,
  customRules?: ReadonlyArray<AccountClassificationRule<LiabilityBalanceBucket>>,
): LiabilityBalanceBucket {
  return classifyByRules(
    code,
    name,
    customRules ?? DEFAULT_LIABILITY_CLASSIFICATION_RULES,
    'otrosPasivos',
  );
}
