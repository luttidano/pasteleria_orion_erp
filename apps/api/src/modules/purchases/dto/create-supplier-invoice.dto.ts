import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Max,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSupplierInvoiceDto {
  @IsUUID('4', { message: 'supplierId debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'supplierId es requerido.' })
  supplierId!: string;

  @IsString({ message: 'invoiceNumber debe ser una cadena.' })
  @IsNotEmpty({ message: 'invoiceNumber es requerido.' })
  @MaxLength(100, { message: 'invoiceNumber no puede exceder 100 caracteres.' })
  invoiceNumber!: string;

  @IsOptional()
  @IsString()
  issueDate?: string;

  @IsString({ message: 'dueDate es requerida (formato YYYY-MM-DD).' })
  @IsNotEmpty({ message: 'dueDate no puede estar vacía.' })
  dueDate!: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'totalAmount debe ser un número válido.' })
  @IsPositive({ message: 'totalAmount debe ser mayor a 0.' })
  @Max(100_000_000, { message: 'totalAmount excede el monto máximo permitido.' })
  totalAmount!: number;

  @IsOptional()
  @IsBoolean({ message: 'hasInvoice debe ser booleano.' })
  hasInvoice?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'notes no puede exceder 500 caracteres.' })
  notes?: string;
}
