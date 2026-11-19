import { OmitType, PartialType } from '@nestjs/swagger';
import { CreatePackagingDto } from './create-packaging.dto';

export class UpdatePackagingDto extends PartialType(
  OmitType(CreatePackagingDto, ['stock'] as const),
) {}
