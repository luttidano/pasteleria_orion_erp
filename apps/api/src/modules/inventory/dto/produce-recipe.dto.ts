import { IsNumber, Min, IsOptional, IsUUID, IsString } from 'class-validator';

export class ProduceRecipeDto {
  @IsNumber({}, { message: 'La cantidad de tandas debe ser un número.' })
  @Min(0.01, { message: 'La cantidad a producir debe ser mayor a 0.' })
  quantity: number;

  @IsOptional()
  @IsUUID('4', { message: 'El ID del producto comercial debe ser un UUID válido.' })
  productId?: string;

  @IsOptional()
  @IsNumber({}, { message: 'Las unidades producidas deben ser numéricas.' })
  @Min(0.01, { message: 'Las unidades producidas deben ser mayores a 0.' })
  producedUnits?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

