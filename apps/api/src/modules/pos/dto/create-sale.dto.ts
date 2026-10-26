
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateSaleItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  productName: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  quantity: number;

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  unitPrice: number;

  @IsOptional()
  @IsUUID('4')
  productId?: string;
}

export class CreateSaleDto {
  @IsIn(['efectivo', 'debito', 'credito', 'transferencia'])
  paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  subtotal: number;

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  taxAmount: number;

  @Type(() => Number)
  @IsNumber({
    maxDecimalPlaces: 2,
    allowNaN: false,
    allowInfinity: false,
  })
  @Min(0)
  @Max(9999999999.99)
  total: number;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items: CreateSaleItemDto[];
}
