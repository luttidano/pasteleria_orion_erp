import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class TaxPeriodQueryDto {
  @Type(() => Number)
  @IsInt({ message: 'El año debe ser un número entero.' })
  @Min(2020, { message: 'El año debe ser igual o superior a 2020.' })
  @Max(2100, { message: 'El año no puede ser superior a 2100.' })
  year: number;

  @Type(() => Number)
  @IsInt({ message: 'El mes debe ser un número entero entre 1 y 12.' })
  @Min(1, { message: 'El mes debe estar entre 1 y 12.' })
  @Max(12, { message: 'El mes debe estar entre 1 y 12.' })
  month: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'El remanente anterior debe ser numérico.' })
  @Min(0, { message: 'El remanente anterior no puede ser negativo.' })
  previousRemanent?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'La tasa de PPM debe ser numérica.' })
  @Min(0, { message: 'La tasa de PPM no puede ser negativa.' })
  @Max(100, { message: 'La tasa de PPM no puede superar el 100%.' })
  ppmRate?: number;
}
