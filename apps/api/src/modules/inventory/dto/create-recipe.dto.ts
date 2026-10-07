import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  IsNumber,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeIngredientDto {
  @IsUUID()
  @IsNotEmpty()
  ingredientId: string;

  @IsNumber()
  @Min(0.001)
  quantity: number;

  @IsString()
  @IsNotEmpty()
  unit: string; // 'g', 'kg', 'ml', 'L', 'un'
}

export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsInt()
  @Min(1)
  @IsOptional()
  yieldServings?: number;

  @IsString()
  @IsOptional()
  categoryId?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  imageUrl?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeIngredientDto)
  ingredients: RecipeIngredientDto[];
}
