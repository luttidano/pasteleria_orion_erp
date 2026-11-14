import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateEntryItemDto {
  @IsUUID(undefined, { message: 'El ID de cuenta contable debe ser un UUID válido.' })
  accountId: string;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El monto Debe debe ser numérico válido.' },
  )
  @Min(0, { message: 'El monto Debe no puede ser negativo.' })
  @Max(9999999999.99)
  debit: number;

  @Type(() => Number)
  @IsNumber(
    { maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false },
    { message: 'El monto Haber debe ser numérico válido.' },
  )
  @Min(0, { message: 'El monto Haber no puede ser negativo.' })
  @Max(9999999999.99)
  credit: number;

  @IsString()
  @IsOptional()
  @MaxLength(300)
  description?: string;
}

export class CreateAccountingEntryDto {
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'La fecha del asiento (entryDate) debe tener formato estricto YYYY-MM-DD.',
  })
  entryDate: string;

  @IsString()
  @IsNotEmpty({ message: 'La glosa o concepto del asiento es obligatoria.' })
  @MaxLength(300, {
    message: 'El concepto no puede superar los 300 caracteres.',
  })
  concept: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Un asiento contable requiere al menos 2 líneas.' })
  @ArrayMaxSize(100, { message: 'Un asiento contable admite hasta 100 líneas.' })
  @ValidateNested({ each: true })
  @Type(() => CreateEntryItemDto)
  items: CreateEntryItemDto[];
}
