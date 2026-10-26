import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateAccountingMovementDto {
  @IsDateString()
  movementDate: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  concept: string;

  @IsIn(['ingreso', 'egreso'])
  movementType: 'ingreso' | 'egreso';

  @IsUUID()
  accountId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0.01)
  @Max(9999999999.99)
  amount: number;

  @IsIn(['efectivo', 'debito', 'credito', 'transferencia'])
  paymentMethod: 'efectivo' | 'debito' | 'credito' | 'transferencia';
}
