import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches } from 'class-validator';

const YYYY_MM_DD_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @Matches(YYYY_MM_DD_REGEX, {
    message: 'El parámetro startDate debe tener formato estricto YYYY-MM-DD.',
  })
  startDate?: string;

  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @Matches(YYYY_MM_DD_REGEX, {
    message: 'El parámetro endDate debe tener formato estricto YYYY-MM-DD.',
  })
  endDate?: string;
}

export class BalanceSheetQueryDto {
  @IsOptional()
  @Transform(({ value }) => (value === '' ? undefined : value))
  @IsString()
  @Matches(YYYY_MM_DD_REGEX, {
    message: 'El parámetro asOfDate debe tener formato estricto YYYY-MM-DD.',
  })
  asOfDate?: string;
}

