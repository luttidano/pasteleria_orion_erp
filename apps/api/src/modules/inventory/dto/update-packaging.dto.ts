import { PartialType } from '@nestjs/swagger';
import { CreatePackagingDto } from './create-packaging.dto';

export class UpdatePackagingDto extends PartialType(CreatePackagingDto) {}