import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateIngredientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  category?: string;

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
  @IsOptional()
  @Min(0)
  @Max(100_000_000)
  price?: number;

  @IsString()
  @IsOptional()
  @MaxLength(30)
  icon?: string;

  @IsString()
  @IsOptional()
  @MaxLength(1000)
  imageUrl?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;
}
