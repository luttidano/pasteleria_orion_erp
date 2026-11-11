import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';

export class PeriodYearQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;
}

export class CheckPeriodDateQueryDto {
  @IsDateString()
  date: string;
}

export class PeriodIdentifierDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class ExecuteAnnualClosingDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  notes?: string;
}

export class ReverseAnnualClosingDto {
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year: number;

  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class VoidAccountingEntryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  reason: string;
}

export class UpdateAccountingSettingsDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'accountingStartDate debe tener formato YYYY-MM-DD.',
  })
  accountingStartDate?: string | null;
}