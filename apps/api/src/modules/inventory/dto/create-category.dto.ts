import { IsString, IsNotEmpty, IsOptional, IsEnum } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(CategoryType)
  @IsNotEmpty()
  type: CategoryType; // 'ingredient' | 'recipe' | 'pos'

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
