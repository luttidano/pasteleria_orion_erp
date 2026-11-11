import { Transform, Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateGeneralSupplyDto {
  @IsString({ message: 'El nombre del insumo general debe ser texto válido.' })
  @IsNotEmpty({ message: 'El nombre del insumo general es obligatorio.' })
  @MaxLength(150, {
    message: 'El nombre del insumo general no puede superar 150 caracteres.',
  })
  name: string;

  @IsString({ message: 'La categoría debe ser texto válido.' })
  @IsNotEmpty({ message: 'La categoría del insumo general es obligatoria.' })
  @MaxLength(80, {
    message: 'La categoría no puede superar 80 caracteres.',
  })
  category: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false },
    { message: 'El stock actual debe ser numérico.' },
  )
  @Min(0, { message: 'El stock no puede ser negativo.' })
  @Max(999999999, { message: 'El stock ingresado excede el límite permitido.' })
  stock: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false },
    { message: 'El stock mínimo debe ser numérico.' },
  )
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  @Max(999999999, {
    message: 'El stock mínimo ingresado excede el límite permitido.',
  })
  minStock: number;

  @IsOptional()
  @IsString({ message: 'La unidad debe ser texto válido.' })
  @MaxLength(30, { message: 'La unidad no puede superar 30 caracteres.' })
  unit?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El costo referencial debe ser numérico.' },
  )
  @Min(0, { message: 'El costo no puede ser negativo.' })
  @Max(9999999999.99, {
    message: 'El costo ingresado excede el límite permitido.',
  })
  costPrice?: number;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsUUID(undefined, {
    message: 'El ID del proveedor debe ser un UUID válido.',
  })
  supplierId?: string | null;

  @IsOptional()
  @IsString({ message: 'El icono debe ser texto válido.' })
  @MaxLength(16, { message: 'El icono no puede superar 16 caracteres.' })
  icon?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? null : value))
  @IsString({ message: 'La descripción debe ser texto válido.' })
  @MaxLength(500, {
    message: 'La descripción no puede superar 500 caracteres.',
  })
  description?: string | null;
}

