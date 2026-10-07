import { IsString, IsOptional, IsEnum } from 'class-validator';
import { CategoryType } from '@prisma/client';

export class UpdateCategoryDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsEnum(CategoryType)
  @IsOptional()
  type?: CategoryType;

  @IsString()
  @IsOptional()
  icon?: string;

  @IsString()
  @IsOptional()
  description?: string;
}
