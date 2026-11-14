import {
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { CategoryType, ProductType, SupplierType } from '../../../common/enums';

export class CategoryQueryDto {
  @IsOptional()
  @IsEnum(CategoryType, {
    message: 'El tipo de categoría debe ser ingredient, recipe o pos.',
  })
  type?: CategoryType;
}

export class ProductQueryDto {
  @IsOptional()
  @IsEnum(ProductType, {
    message: 'El tipo de producto debe ser manufactured o resale.',
  })
  type?: ProductType;
}

export class PackagingQueryDto {
  @IsOptional()
  @IsIn(['primario', 'secundario'], {
    message: 'El tipo de empaque debe ser primario o secundario.',
  })
  type?: 'primario' | 'secundario';
}

export class SupplierQueryDto {
  @IsOptional()
  @IsEnum(SupplierType, {
    message:
      'El tipo de proveedor debe ser materia_prima, empaque, reventa o insumo_general.',
  })
  type?: SupplierType;
}

export class GeneralSupplyQueryDto {
  @IsOptional()
  @IsString({ message: 'La categoría debe ser texto válido.' })
  @MaxLength(80, {
    message: 'El filtro de categoría no puede superar 80 caracteres.',
  })
  category?: string;
}

