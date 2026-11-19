import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsEnum(['manufactured', 'resale'])
  productType: 'manufactured' | 'resale';

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  stock: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  minStock: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  unit: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100_000_000)
  salePrice: number;

  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(100_000_000)
  costPrice?: number;

  @IsString()
  @IsOptional()
  recipeId?: string;

  @IsString()
  @IsOptional()
  supplierId?: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  imageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  icon?: string;
}
