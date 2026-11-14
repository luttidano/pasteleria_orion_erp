import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'exclusiveProductOrPackaging', async: false })
export class ExclusiveProductOrPackagingConstraint
  implements ValidatorConstraintInterface
{
  validate(_value: unknown, args: ValidationArguments): boolean {
    const dto = args.object as CreateSaleItemDto;
    const hasProduct =
      dto.productId !== undefined &&
      dto.productId !== null &&
      String(dto.productId).trim() !== '';
    const hasPackaging =
      dto.packagingId !== undefined &&
      dto.packagingId !== null &&
      String(dto.packagingId).trim() !== '';

    return hasProduct !== hasPackaging;
  }

  defaultMessage(): string {
    return 'Cada ítem debe especificar exactamente productId o packagingId, pero no ambos ni ninguno.';
  }
}

export class CreateSaleItemDto {
  @IsOptional()
  @IsString()
  @MaxLength(150)
  productName?: string;

  @Validate(ExclusiveProductOrPackagingConstraint)
  @Type(() => Number)
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad mínima es 1.' })
  @Max(10000, { message: 'La cantidad máxima por línea es 10000.' })
  quantity: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  unitPrice?: number;

  @ValidateIf(
    (o: CreateSaleItemDto) =>
      o.productId !== undefined && o.productId !== null && o.productId !== '',
  )
  @IsUUID(undefined, { message: 'El campo productId debe ser un UUID válido.' })
  productId?: string;

  @ValidateIf(
    (o: CreateSaleItemDto) =>
      o.packagingId !== undefined &&
      o.packagingId !== null &&
      o.packagingId !== '',
  )
  @IsUUID(undefined, {
    message: 'El campo packagingId debe ser un UUID válido.',
  })
  packagingId?: string;
}

export class CreateSaleDto {
  @IsIn(['efectivo', 'debito', 'credito', 'transferencia'])
  paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  subtotal?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  taxAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  total?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
