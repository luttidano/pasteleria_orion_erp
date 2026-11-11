import { IsDateString, IsOptional } from 'class-validator';

export class PosSummaryQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}