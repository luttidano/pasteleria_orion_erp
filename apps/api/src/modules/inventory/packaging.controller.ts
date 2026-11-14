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
  UseInterceptors,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PackagingService } from './packaging.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { PackagingQueryDto } from './dto/inventory-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Controller('packaging')
@UseGuards(AuthGuard, RolesGuard)
export class PackagingController {
  constructor(private readonly packagingService: PackagingService) {}

  @Get()
  @Roles(Role.admin, Role.baker, Role.cashier)
  findAll(@Query() query: PackagingQueryDto) {
    return this.packagingService.findAll(query.type);
  }

  @Get(':id')
  @Roles(Role.admin, Role.baker, Role.cashier)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagingService.findOne(id);
  }

  @Post()
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
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
  @Roles(Role.admin, Role.baker, Role.cashier)
  @UseInterceptors(IdempotencyInterceptor)
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.packagingService.adjustStock(id, adjustStockDto, userId);
  }

  @Delete(':id')
  @Roles(Role.admin)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.packagingService.remove(id);
  }
}
