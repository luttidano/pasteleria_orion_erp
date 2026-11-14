import { Type } from 'class-transformer';
import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class ProduceRecipeDto {
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false },
    { message: 'La cantidad de tandas debe ser un número.' },
  )
  @Min(0.01, { message: 'La cantidad a producir debe ser mayor a 0.' })
  @Max(100000, { message: 'La cantidad de tandas excede el límite permitido.' })
  quantity: number;

  @IsOptional()
  @IsUUID(undefined, {
    message: 'El ID del producto comercial debe ser un UUID válido.',
  })
  productId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 3, allowNaN: false, allowInfinity: false },
    { message: 'Las unidades producidas deben ser numéricas.' },
  )
  @Min(0.01, { message: 'Las unidades producidas deben ser mayores a 0.' })
  @Max(1000000, {
    message: 'Las unidades producidas exceden el límite permitido.',
  })
  producedUnits?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500, {
    message: 'Las notas de producción no pueden superar 500 caracteres.',
  })
  notes?: string;
}
