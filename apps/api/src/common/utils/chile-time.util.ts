import { BadRequestException } from '@nestjs/common';

export const STORE_TIMEZONE = 'America/Santiago';

export interface ZonedDateParts {
  year: number;
  month: number;
  day: number;
}

export function getZonedDateParts(
  refDate: Date = new Date(),
  timeZone = STORE_TIMEZONE,
): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(refDate);

  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== 'literal') {
      map[part.type] = Number(part.value);
    }
  }

  return {
    year: map.year,
    month: map.month,
    day: map.day,
  };
}

export function getZonedDateString(
  refDate: Date = new Date(),
  timeZone = STORE_TIMEZONE,
): string {
  const { year, month, day } = getZonedDateParts(refDate, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getZonedInstant(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  ms: number,
  timeZone = STORE_TIMEZONE,
): Date {
  const utcBaseline = Date.UTC(year, month - 1, day, hour, minute, second, ms);

  const getOffsetMs = (utcMs: number): number => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(new Date(utcMs));

    const map: Record<string, number> = {};
    for (const p of parts) {
      if (p.type !== 'literal') {
        map[p.type] = Number(p.value);
      }
    }

    const h = map.hour === 24 ? 0 : map.hour;
    const asUtc = Date.UTC(
      map.year,
      map.month - 1,
      map.day,
      h,
      map.minute,
      map.second,
      0,
    );
    return asUtc - (utcMs - (utcMs % 1000));
  };

  const firstPass = utcBaseline - getOffsetMs(utcBaseline);
  const secondPass = utcBaseline - getOffsetMs(firstPass);
  return new Date(secondPass);
}

export function getTimeZoneDayBounds(
  timeZone = STORE_TIMEZONE,
  refDate: Date = new Date(),
): { startDate: Date; endDate: Date; businessDate: string } {
  const { year, month, day } = getZonedDateParts(refDate, timeZone);
  return {
    startDate: getZonedInstant(year, month, day, 0, 0, 0, 0, timeZone),
    endDate: getZonedInstant(year, month, day, 23, 59, 59, 999, timeZone),
    businessDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  };
}

export function resolveStoreDateRange(
  from?: string,
  to?: string,
  timeZone = STORE_TIMEZONE,
): { startDate: Date; endDate: Date } {
  const bounds = getTimeZoneDayBounds(timeZone);
  const startDate = from ? new Date(from) : bounds.startDate;
  const endDate = to ? new Date(to) : bounds.endDate;

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(endDate.getTime()) ||
    startDate > endDate
  ) {
    throw new BadRequestException(
      'Rango de fechas inválido para el resumen de caja.',
    );
  }

  return { startDate, endDate };
}

export function parseStrictUtcBounds(
  dateStr: string,
  fieldName: string,
): { start: Date; end: Date; isoDate: string } {
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new BadRequestException(
      `El parámetro ${fieldName} debe tener formato estricto YYYY-MM-DD.`,
    );
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const check = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

  if (
    year < 2000 ||
    year > 2100 ||
    month < 1 ||
    month > 12 ||
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() + 1 !== month ||
    check.getUTCDate() !== day
  ) {
    throw new BadRequestException(
      `El parámetro ${fieldName} ("${dateStr}") no es una fecha válida.`,
    );
  }

  return {
    start: check,
    end: new Date(Date.UTC(year, month - 1, day, 23, 59, 59, 999)),
    isoDate: trimmed,
  };
}

/**
 * Extrae (year, month) en UTC sin desplazamiento por zona horaria local.
 */
export function extractYearMonth(dateInput: Date | string): {
  year: number;
  month: number;
} {
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    if (!trimmed) {
      throw new BadRequestException('Fecha contable inválida.');
    }

    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(trimmed);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      const day = Number(isoMatch[3]);
      const check = new Date(Date.UTC(year, month - 1, day));
      if (
        year < 2000 ||
        year > 2100 ||
        month < 1 ||
        month > 12 ||
        check.getUTCFullYear() !== year ||
        check.getUTCMonth() + 1 !== month ||
        check.getUTCDate() !== day
      ) {
        throw new BadRequestException(
          `Fecha contable inválida: "${dateInput}".`,
        );
      }
      return { year, month };
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Fecha contable inválida: "${dateInput}".`);
    }

    const year = parsed.getUTCFullYear();
    if (year < 2000 || year > 2100) {
      throw new BadRequestException(
        `Año contable fuera de rango (2000-2100): ${year}.`,
      );
    }

    return {
      year,
      month: parsed.getUTCMonth() + 1,
    };
  }

  if (!(dateInput instanceof Date) || Number.isNaN(dateInput.getTime())) {
    throw new BadRequestException('Fecha contable inválida.');
  }

  const year = dateInput.getUTCFullYear();
  if (year < 2000 || year > 2100) {
    throw new BadRequestException(
      `Año contable fuera de rango (2000-2100): ${year}.`,
    );
  }

  return {
    year,
    month: dateInput.getUTCMonth() + 1,
  };
}

export function extractUtcDate(dateInput: Date | string): {
  year: number;
  month: number;
  day: number;
  dateUtc: Date;
  isoDate: string;
} {
  const { year, month } = extractYearMonth(dateInput);

  let day: number;
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})(?:$|T|\s)/.exec(trimmed);
    day = isoMatch ? Number(isoMatch[3]) : new Date(trimmed).getUTCDate();
  } else {
    day = dateInput.getUTCDate();
  }

  const dateUtc = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
  return {
    year,
    month,
    day,
    dateUtc,
    isoDate: dateUtc.toISOString().slice(0, 10),
  };
}

export function getMonthDateRangeUtc(
  year: number,
  month: number,
): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
  };
}

export function toUtcDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      0,
      0,
      0,
      0,
    ),
  );
}

export function toChileBusinessDateString(dateInput: string): string {
  const trimmed = dateInput.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseStrictUtcBounds(trimmed, 'date').isoDate;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`Fecha contable inválida: "${dateInput}".`);
  }

  return getZonedDateString(parsed, STORE_TIMEZONE);
}
