export const STORE_TIMEZONE = 'America/Santiago';

const chileDatePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: STORE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const chileDateFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: STORE_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const chileShortDateFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: STORE_TIMEZONE,
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

const chileTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: STORE_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const chileDateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  timeZone: STORE_TIMEZONE,
  dateStyle: 'short',
  timeStyle: 'short',
});

function parseDateSafe(value: Date | string): Date {
  if (value instanceof Date) return value;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T12:00:00Z`);
  }
  return new Date(value);
}

function getChileCalendarParts(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
} {
  const parts = chileDatePartsFormatter.formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  return { year, month, day };
}

function formatUtcDateIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatAmount(value: number | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '0';
  return Math.round(numeric).toLocaleString('es-CL');
}

export function formatMoney(value: number | null | undefined): string {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return '$0';
  const rounded = Math.round(numeric);
  if (rounded < 0) {
    return `-$${Math.abs(rounded).toLocaleString('es-CL')}`;
  }
  return `$${rounded.toLocaleString('es-CL')}`;
}

export function formatChileDate(
  value: Date | string | null | undefined,
  fallback = '-',
): string {
  if (!value) return fallback;
  const parsed = parseDateSafe(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return chileDateFormatter.format(parsed);
}

export function formatChileShortDate(
  value: Date | string | null | undefined,
  fallback = 'Reciente',
): string {
  if (!value) return fallback;
  const parsed = parseDateSafe(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return chileShortDateFormatter.format(parsed);
}

export function formatChileTime(
  value: Date | string | null | undefined,
  fallback = '-',
): string {
  if (!value) return fallback;
  const parsed = parseDateSafe(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return chileTimeFormatter.format(parsed);
}

export function formatChileDateTime(
  value: Date | string | null | undefined,
  fallback = '-',
): string {
  if (!value) return fallback;
  const parsed = parseDateSafe(value);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return chileDateTimeFormatter.format(parsed);
}

export function getChileTodayIso(now: Date = new Date()): string {
  const { year, month, day } = getChileCalendarParts(now);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getChileMonthRange(
  monthsAgo = 0,
  now: Date = new Date(),
): { start: string; end: string } {
  const { year, month } = getChileCalendarParts(now);
  const startDate = new Date(Date.UTC(year, month - 1 - monthsAgo, 1));
  const endDate = new Date(Date.UTC(year, month - monthsAgo, 0));
  return {
    start: formatUtcDateIso(startDate),
    end: formatUtcDateIso(endDate),
  };
}

export function getChileQuarterRange(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const { year, month } = getChileCalendarParts(now);
  const quarterStartMonth = Math.floor((month - 1) / 3) * 3;
  const startDate = new Date(Date.UTC(year, quarterStartMonth, 1));
  const endDate = new Date(Date.UTC(year, quarterStartMonth + 3, 0));
  return {
    start: formatUtcDateIso(startDate),
    end: formatUtcDateIso(endDate),
  };
}

export function getChileYearRange(now: Date = new Date()): {
  start: string;
  end: string;
} {
  const { year } = getChileCalendarParts(now);
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

