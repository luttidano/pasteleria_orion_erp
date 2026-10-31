import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateEntryItemDto {
  @IsUUID()
  accountId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  debit: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  credit: number;

  @IsString()
  @IsOptional()
  description?: string;
}

export class CreateAccountingEntryDto {
  @IsDateString()
  entryDate: string;

  @IsString()
  @IsNotEmpty()
  concept: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateEntryItemDto)
  items: CreateEntryItemDto[];
}