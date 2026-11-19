import { BadRequestException } from '@nestjs/common';
import {
  extractYearMonth,
  getChileMonthDateRangeUtc,
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

  it('debe calcular rango mensual alineado a la medianoche de Chile cubriendo ventas nocturnas', () => {
    const range = getChileMonthDateRangeUtc(2026, 11);
    // 2026-11-01 00:00 CLT -> 2026-11-01 03:00 UTC
    expect(range.start.toISOString()).toBe('2026-11-01T03:00:00.000Z');
    // 2026-11-30 23:59:59.999 CLT -> 2026-12-01 02:59:59.999 UTC
    expect(range.end.toISOString()).toBe('2026-12-01T02:59:59.999Z');

    // Venta nocturna del 30 de noviembre a las 22:30 CLT (2026-12-01 01:30 UTC)
    const lateNightSaleUtc = new Date('2026-12-01T01:30:00.000Z');
    expect(lateNightSaleUtc.getTime()).toBeGreaterThanOrEqual(range.start.getTime());
    expect(lateNightSaleUtc.getTime()).toBeLessThanOrEqual(range.end.getTime());
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
