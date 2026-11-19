import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateGeneralSupplyDto } from './create-general-supply.dto';

export class UpdateGeneralSupplyDto extends PartialType(
  OmitType(CreateGeneralSupplyDto, ['stock'] as const),
) {}
