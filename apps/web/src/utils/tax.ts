export const DEFAULT_VAT_RATE = 0.19;

export interface TaxCalculationOptions {
  isExempt?: boolean;
  rate?: number;
}

export interface TaxBreakdown {
  netAmount: number;
  vatAmount: number;
  totalAmount: number;
  rate: number;
  isExempt: boolean;
}

function normalizeRate(rate?: number): number {
  if (rate === undefined || rate === null || !Number.isFinite(rate) || rate < 0) {
    return DEFAULT_VAT_RATE;
  }
  return rate;
}

/**
 * Desglosa un monto bruto (IVA incluido) en neto + IVA usando la misma lógica
 * autoritativa que TaxCalculatorService del backend.
 */
export function calculateGrossTaxBreakdown(
  grossAmount: number,
  options?: TaxCalculationOptions,
): TaxBreakdown {
  const totalAmount = Math.round(Math.max(0, Number(grossAmount) || 0));
  if (options?.isExempt) {
    return {
      netAmount: totalAmount,
      vatAmount: 0,
      totalAmount,
      rate: 0,
      isExempt: true,
    };
  }

  const rate = normalizeRate(options?.rate);
  if (rate === 0) {
    return {
      netAmount: totalAmount,
      vatAmount: 0,
      totalAmount,
      rate: 0,
      isExempt: true,
    };
  }

  const netAmount = Math.round(totalAmount / (1 + rate));
  const vatAmount = Math.max(0, totalAmount - netAmount);

  return {
    netAmount,
    vatAmount,
    totalAmount,
    rate,
    isExempt: false,
  };
}

/**
 * Calcula el monto bruto (IVA incluido) a partir de una base neta.
 */
export function calculateGrossFromNet(
  netAmount: number,
  options?: TaxCalculationOptions,
): number {
  const net = Math.max(0, Number(netAmount) || 0);
  if (options?.isExempt) {
    return Math.round(net);
  }
  const rate = normalizeRate(options?.rate);
  return Math.round(net * (1 + rate));
}
