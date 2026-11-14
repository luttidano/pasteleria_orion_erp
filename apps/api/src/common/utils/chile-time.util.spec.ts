import { BadRequestException } from '@nestjs/common';
import {
  extractYearMonth,
  getTimeZoneDayBounds,
  parseStrictUtcBounds,
  toChileBusinessDateString,
} from './chile-time.util';

describe('chile-time.util', () => {
  it('debe convertir instantes UTC nocturnos a la fecha comercial de America/Santiago', () => {
    // 2026-11-12 01:30 UTC corresponde a 2026-11-11 22:30 CLT (-03:00)
    expect(toChileBusinessDateString('2026-11-12T01:30:00.000Z')).toBe(
      '2026-11-11',
    );
    // 2026-07-15 02:00 UTC corresponde a 2026-07-14 22:00 CLT (-04:00 invierno)
    expect(toChileBusinessDateString('2026-07-15T02:00:00.000Z')).toBe(
      '2026-07-14',
    );
    expect(toChileBusinessDateString('2026-11-11')).toBe('2026-11-11');
  });

  it('debe extraer año y mes sin desplazamiento horario y rechazar fechas inválidas', () => {
    expect(extractYearMonth('2026-01-01')).toEqual({ year: 2026, month: 1 });
    expect(extractYearMonth('2026-12-31')).toEqual({ year: 2026, month: 12 });
    expect(() => extractYearMonth('2026-02-30')).toThrow(BadRequestException);
    expect(() => parseStrictUtcBounds('2026-02-30', 'startDate')).toThrow(
      BadRequestException,
    );
  });

  it('debe calcular límites diarios válidos en timezone America/Santiago', () => {
    const ref = new Date('2026-11-11T15:00:00.000Z');
    const bounds = getTimeZoneDayBounds('America/Santiago', ref);
    expect(bounds.businessDate).toBe('2026-11-11');
    expect(bounds.startDate.getTime()).toBeLessThan(bounds.endDate.getTime());
  });
});
