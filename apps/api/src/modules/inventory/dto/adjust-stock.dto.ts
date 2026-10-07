import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class AdjustStockDto {
  @IsNumber()
  @IsNotEmpty()
  delta: number; // Positivo para compras/ingreso, negativo para consumo/merma

  @IsString()
  @IsOptional()
  reason?: string;
}
