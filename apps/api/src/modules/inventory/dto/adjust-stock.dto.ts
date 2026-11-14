import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import type {
  InventoryAdjustmentReasonType,
  InventoryPurchasePaymentMethod,
} from '@repo/types';

export const ADJUSTMENT_REASON_TYPES: readonly InventoryAdjustmentReasonType[] =
  ['purchase', 'waste', 'internal_use', 'recount_surplus', 'recount_shortage'];

export const PURCHASE_PAYMENT_METHODS: readonly InventoryPurchasePaymentMethod[] =
  ['efectivo', 'banco', 'transferencia', 'credito_proveedor'];

export class AdjustStockDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false },
    { message: 'El ajuste delta debe ser un número finito válido.' },
  )
  @IsNotEmpty({ message: 'El ajuste delta es obligatorio.' })
  @Min(-999999999, { message: 'El ajuste delta está fuera de rango.' })
  @Max(999999999, { message: 'El ajuste delta está fuera de rango.' })
  delta: number;

  @IsOptional()
  @IsIn(ADJUSTMENT_REASON_TYPES, {
    message:
      'El tipo de motivo debe ser purchase, waste, internal_use, recount_surplus o recount_shortage.',
  })
  reasonType?: InventoryAdjustmentReasonType;

  @IsString({ message: 'La razón debe ser texto válido.' })
  @IsOptional()
  @MaxLength(250, {
    message: 'La razón del ajuste no puede superar 250 caracteres.',
  })
  reason?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El costo total debe ser un monto finito válido.' },
  )
  @Min(0, { message: 'El costo total no puede ser negativo.' })
  @Max(999999999, { message: 'El costo total está fuera de rango.' })
  totalCost?: number;

  @IsOptional()
  @IsBoolean({ message: 'El indicador hasInvoice debe ser booleano.' })
  hasInvoice?: boolean;

  @IsOptional()
  @IsIn(PURCHASE_PAYMENT_METHODS, {
    message:
      'El medio de pago de compra debe ser efectivo, banco, transferencia o credito_proveedor.',
  })
  paymentMethod?: InventoryPurchasePaymentMethod;
}
