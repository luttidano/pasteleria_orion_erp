import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecordSupplierPaymentDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'amount debe ser un número válido.' })
  @IsPositive({ message: 'amount debe ser mayor a 0.' })
  @Max(100_000_000, { message: 'amount excede el monto máximo permitido.' })
  amount!: number;

  @IsString({ message: 'paymentMethod debe ser texto.' })
  @IsNotEmpty({ message: 'paymentMethod es requerido.' })
  @IsIn(['transferencia', 'efectivo', 'banco'], {
    message: 'paymentMethod debe ser "transferencia", "efectivo" o "banco".',
  })
  paymentMethod!: 'transferencia' | 'efectivo' | 'banco';

  @IsOptional()
  @IsString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'reference no puede exceder 150 caracteres.' })
  reference?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'notes no puede exceder 500 caracteres.' })
  notes?: string;
}
