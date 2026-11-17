import {
  classifyAssetBucket,
  classifyLiabilityBucket,
  matchesClassificationRule,
  classifyByRules,
} from './balance-sheet-classifier';
import {
  AccountClassificationRule,
  AssetBalanceBucket,
  LiabilityBalanceBucket,
  DEFAULT_ASSET_CLASSIFICATION_RULES,
} from './balance-sheet-rules.config';

describe('BalanceSheetClassifier (OCP)', () => {
  describe('classifyAssetBucket (reglas por defecto)', () => {
    it('debe clasificar códigos 1101 a 1104 como disponible', () => {
      expect(classifyAssetBucket('1101', 'Caja')).toBe('disponible');
      expect(classifyAssetBucket('1102', 'Banco Santander')).toBe('disponible');
      expect(classifyAssetBucket('1103', 'Transbank')).toBe('disponible');
      expect(classifyAssetBucket('1104', 'Transferencias')).toBe('disponible');
    });

    it('debe clasificar nombres con banco/caja/transbank como disponible por regex', () => {
      expect(classifyAssetBucket('9999', 'Cuenta de Banco Especial')).toBe('disponible');
      expect(classifyAssetBucket('9998', 'Caja Chica Sucursal')).toBe('disponible');
    });

    it('debe clasificar códigos 1105 y 1106 como inventarios', () => {
      expect(classifyAssetBucket('1105', 'Materias Primas')).toBe('inventarios');
      expect(classifyAssetBucket('1106', 'Productos Terminados')).toBe('inventarios');
    });

    it('debe clasificar nombres de inventario/materia prima como inventarios por regex', () => {
      expect(classifyAssetBucket('9997', 'Inventario Empaques')).toBe('inventarios');
      expect(classifyAssetBucket('9996', 'Materia Prima Harina')).toBe('inventarios');
    });

    it('debe clasificar como otrosActivos ante cualquier cuenta no contemplada', () => {
      expect(classifyAssetBucket('1201', 'Maquinaria y Equipos')).toBe('otrosActivos');
      expect(classifyAssetBucket('1301', 'Garantías de Arriendo')).toBe('otrosActivos');
    });
  });

  describe('classifyLiabilityBucket (reglas por defecto)', () => {
    it('debe clasificar códigos 2102 y 2105 como impuestos', () => {
      expect(classifyLiabilityBucket('2102', 'IVA Débito Fiscal')).toBe('impuestos');
      expect(classifyLiabilityBucket('2105', 'PPM por Pagar')).toBe('impuestos');
    });

    it('debe clasificar código 2101 como obligaciones', () => {
      expect(classifyLiabilityBucket('2101', 'Proveedores')).toBe('obligaciones');
    });

    it('debe priorizar impuestos sobre obligaciones ante nombres como "IVA por Pagar"', () => {
      expect(classifyLiabilityBucket('2199', 'IVA por Pagar')).toBe('impuestos');
      expect(classifyLiabilityBucket('2198', 'Retención F29 por Pagar')).toBe('impuestos');
    });

    it('debe clasificar obligaciones por pagar generales como obligaciones', () => {
      expect(classifyLiabilityBucket('2108', 'Cuentas Comerciales por Pagar')).toBe('obligaciones');
      expect(classifyLiabilityBucket('2109', 'Acreedores Varios')).toBe('obligaciones');
    });

    it('debe clasificar como otrosPasivos ante pasivos no cubiertos', () => {
      expect(classifyLiabilityBucket('2201', 'Préstamos Bancarios LP')).toBe('otrosPasivos');
      expect(classifyLiabilityBucket('2301', 'Provisiones Varias')).toBe('otrosPasivos');
    });
  });

  describe('Extensibilidad OCP (Reglas personalizadas)', () => {
    it('debe permitir extender reglas con prefijos de código sin modificar el código fuente', () => {
      const extendedRules: ReadonlyArray<AccountClassificationRule<AssetBalanceBucket>> = [
        {
          bucket: 'inventarios',
          codePrefixes: ['1107', '1108'],
        },
        ...DEFAULT_ASSET_CLASSIFICATION_RULES,
      ];

      expect(classifyAssetBucket('1108-01', 'Insumos Varios', extendedRules)).toBe('inventarios');
      expect(classifyAssetBucket('1107-99', 'Empaques Especiales', extendedRules)).toBe('inventarios');
    });

    it('debe admitir matchers personalizados con lógica arbitraria', () => {
      const customRules: ReadonlyArray<AccountClassificationRule<LiabilityBalanceBucket>> = [
        {
          bucket: 'obligaciones',
          matcher: (code, name) => code.startsWith('25') && name.includes('Leasing'),
        },
      ];

      const bucket = classifyByRules('2501', 'Contrato de Leasing Operativo', customRules, 'otrosPasivos');
      expect(bucket).toBe('obligaciones');

      const nonMatched = classifyByRules('2502', 'Otro concepto', customRules, 'otrosPasivos');
      expect(nonMatched).toBe('otrosPasivos');
    });

    it('matchesClassificationRule debe evaluar correctamente arrays de códigos y strings regex', () => {
      const rule: AccountClassificationRule<AssetBalanceBucket> = {
        bucket: 'disponible',
        codes: ['1000', '1001'],
        namePattern: 'caja central',
      };

      expect(matchesClassificationRule('1000', 'Cualquiera', rule)).toBe(true);
      expect(matchesClassificationRule('1001', 'Cualquiera', rule)).toBe(true);
      expect(matchesClassificationRule('1999', 'Caja Central Principal', rule)).toBe(true);
      expect(matchesClassificationRule('1999', 'Otra cuenta', rule)).toBe(false);
    });
  });
});
