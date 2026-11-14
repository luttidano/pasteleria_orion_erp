import { describe, it, expect } from '@jest/globals';
import { convertToTargetUnit, toBaseUnits } from './unit-converter';

describe('unit-converter (strict unit normalization)', () => {
  describe('toBaseUnits', () => {
    it('debe normalizar unidades de masa a gramos', () => {
      expect(toBaseUnits(2.5, 'kg')).toEqual({ value: 2500, type: 'mass' });
      expect(toBaseUnits(1, 'kilogramos')).toEqual({ value: 1000, type: 'mass' });
      expect(toBaseUnits(350, 'g')).toEqual({ value: 350, type: 'mass' });
      expect(toBaseUnits(350, ' gr ')).toEqual({ value: 350, type: 'mass' });
    });

    it('debe normalizar unidades de volumen a mililitros', () => {
      expect(toBaseUnits(1.5, 'L')).toEqual({ value: 1500, type: 'volume' });
      expect(toBaseUnits(2, 'lt')).toEqual({ value: 2000, type: 'volume' });
      expect(toBaseUnits(250, 'ml')).toEqual({ value: 250, type: 'volume' });
      expect(toBaseUnits(100, 'cc')).toEqual({ value: 100, type: 'volume' });
    });

    it('debe normalizar unidades de conteo conocidas', () => {
      expect(toBaseUnits(12, 'un')).toEqual({ value: 12, type: 'count' });
      expect(toBaseUnits(6, 'unidades')).toEqual({ value: 6, type: 'count' });
      expect(toBaseUnits(3, 'piezas')).toEqual({ value: 3, type: 'count' });
    });

    it('debe retornar null ante unidades desconocidas, ambiguas o cantidades no finitas', () => {
      expect(toBaseUnits(1, 'caja')).toBeNull();
      expect(toBaseUnits(1, 'oz')).toBeNull();
      expect(toBaseUnits(1, 'bandeja')).toBeNull();
      expect(toBaseUnits(1, 'taza')).toBeNull();
      expect(toBaseUnits(1, '')).toBeNull();
      expect(toBaseUnits(Number.NaN, 'kg')).toBeNull();
      expect(toBaseUnits(Number.POSITIVE_INFINITY, 'kg')).toBeNull();
    });
  });

  describe('convertToTargetUnit', () => {
    it('debe convertir correctamente dentro de la misma familia dimensional', () => {
      expect(convertToTargetUnit(500, 'g', 'kg')).toBe(0.5);
      expect(convertToTargetUnit(1.5, 'l', 'ml')).toBe(1500);
      expect(convertToTargetUnit(12, 'unidades', 'un')).toBe(12);
    });

    it('debe retornar null ante familias incompatibles o unidades desconocidas', () => {
      expect(convertToTargetUnit(2, 'un', 'kg')).toBeNull();
      expect(convertToTargetUnit(500, 'g', 'ml')).toBeNull();
      expect(convertToTargetUnit(1, 'caja', 'un')).toBeNull();
      expect(convertToTargetUnit(1, 'kg', 'saco')).toBeNull();
    });
  });
});

