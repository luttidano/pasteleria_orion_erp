import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PackagingService } from './packaging.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';

@Controller('packaging')
@UseGuards(AuthGuard, RolesGuard)
export class PackagingController {
  constructor(private readonly packagingService: PackagingService) {}

  @Get()
  @Roles(Role.admin, Role.baker)
  findAll(@Query('type') type?: string) {
    return this.packagingService.findAll(type);
  }

  @Get(':id')
  @Roles(Role.admin, Role.baker)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagingService.findOne(id);
  }

  @Post()
  @Roles(Role.admin)
  create(@Body() createDto: CreatePackagingDto) {
    return this.packagingService.create(createDto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePackagingDto,
  ) {
    return this.packagingService.update(id, updateDto);
  }

  @Post(':id/adjust-stock')
  @Roles(Role.admin, Role.baker)
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('delta') delta: number,
  ) {
    return this.packagingService.adjustStock(id, Number(delta) || 0);
  }

  @Delete(':id')
  @Roles(Role.admin)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagingService.remove(id);
  }
}