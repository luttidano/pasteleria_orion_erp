import {
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreatePackagingDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del empaque es obligatorio.' })
  @MaxLength(150, { message: 'El nombre no puede exceder 150 caracteres.' })
  name: string;

  @IsString()
  @IsIn(['primario', 'secundario'], {
    message: 'El tipo debe ser primario (base/contacto) o secundario (despacho/entrega).',
  })
  packageType: 'primario' | 'secundario';

  @IsString()
  @IsNotEmpty({ message: 'La categoría del empaque es obligatoria.' })
  @MaxLength(100, { message: 'La categoría no puede exceder 100 caracteres.' })
  category: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'El stock actual debe ser numérico.' })
  @Min(0, { message: 'El stock no puede ser negativo.' })
  @Max(100_000_000, { message: 'El stock excede el límite máximo permitido.' })
  stock: number;

  @Type(() => Number)
  @IsNumber({}, { message: 'El stock mínimo debe ser numérico.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  @Max(100_000_000, { message: 'El stock mínimo excede el límite máximo permitido.' })
  minStock: number;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'La unidad no puede exceder 30 caracteres.' })
  unit?: string;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'El costo referencial debe ser numérico.' })
  @Min(0, { message: 'El costo no puede ser negativo.' })
  @Max(100_000_000, { message: 'El costo excede el límite máximo permitido.' })
  costPrice?: number;

  @Type(() => Number)
  @IsOptional()
  @IsNumber({}, { message: 'El precio de venta debe ser numérico.' })
  @Min(0, { message: 'El precio de venta no puede ser negativo.' })
  @Max(100_000_000, { message: 'El precio de venta excede el límite máximo permitido.' })
  salePrice?: number;

  @IsOptional()
  @IsUUID(undefined, { message: 'El ID del proveedor debe ser un UUID válido.' })
  supplierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30, { message: 'El ícono no puede exceder 30 caracteres.' })
  icon?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'La descripción no puede exceder 500 caracteres.' })
  description?: string;
}
