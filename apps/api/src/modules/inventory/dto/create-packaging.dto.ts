import { IsNotEmpty, IsString, IsNumber, Min, IsOptional, IsIn, IsUUID } from 'class-validator';

export class CreatePackagingDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del empaque es obligatorio.' })
  name: string;

  @IsString()
  @IsIn(['primario', 'secundario'], {
    message: 'El tipo debe ser primario (base/contacto) o secundario (despacho/entrega).',
  })
  packageType: 'primario' | 'secundario';

  @IsString()
  @IsNotEmpty({ message: 'La categoría del empaque es obligatoria.' })
  category: string;

  @IsNumber({}, { message: 'El stock actual debe ser numérico.' })
  @Min(0, { message: 'El stock no puede ser negativo.' })
  stock: number;

  @IsNumber({}, { message: 'El stock mínimo debe ser numérico.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  minStock: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El costo referencial debe ser numérico.' })
  @Min(0, { message: 'El costo no puede ser negativo.' })
  costPrice?: number;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del proveedor debe ser un UUID válido.' })
  supplierId?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsString()
  description?: string;
}