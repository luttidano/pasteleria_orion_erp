import { Injectable } from '@nestjs/common';
import { roundMoney } from '../../../common/utils/money.util';

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
 * Función pura reutilizable para desglosar monto bruto (IVA incluido) en neto + impuesto.
 * Permite compartir el algoritmo exacto con helpers sin inyección de dependencias.
 */
export function calculateTaxBreakdownFromGross(
  grossAmount: number,
  options?: TaxCalculationOptions,
): TaxBreakdown {
  const totalAmount = roundMoney(Math.max(0, Number(grossAmount) || 0));
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

  const netAmount = roundMoney(totalAmount / (1 + rate));
  const vatAmount = roundMoney(totalAmount - netAmount);

  return {
    netAmount,
    vatAmount,
    totalAmount,
    rate,
    isExempt: false,
  };
}

/**
 * Servicio extensible para cálculos impositivos (Principio Open/Closed).
 * Centraliza tasas, desgloses de IVA y exenciones tributarias en todo el backend.
 */
@Injectable()
export class TaxCalculatorService {
  getDefaultVatRate(): number {
    return DEFAULT_VAT_RATE;
  }

  breakdownFromGross(
    grossAmount: number,
    options?: TaxCalculationOptions,
  ): TaxBreakdown {
    return calculateTaxBreakdownFromGross(grossAmount, options);
  }

  grossFromNet(
    netAmount: number,
    options?: TaxCalculationOptions,
  ): TaxBreakdown {
    const net = roundMoney(Math.max(0, Number(netAmount) || 0));
    if (options?.isExempt) {
      return {
        netAmount: net,
        vatAmount: 0,
        totalAmount: net,
        rate: 0,
        isExempt: true,
      };
    }

    const rate = normalizeRate(options?.rate);
    const vatAmount = roundMoney(net * rate);
    const totalAmount = roundMoney(net + vatAmount);

    return {
      netAmount: net,
      vatAmount,
      totalAmount,
      rate,
      isExempt: rate === 0,
    };
  }

  netFromVat(vatAmount: number, rate?: number): number {
    const normalizedVat = roundMoney(Math.max(0, Number(vatAmount) || 0));
    const activeRate = normalizeRate(rate);
    if (activeRate <= 0 || normalizedVat <= 0) {
      return 0;
    }
    return roundMoney(normalizedVat / activeRate);
  }
}
