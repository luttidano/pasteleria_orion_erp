import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { GeneralSupplyService } from './general-supply.service';
import { CreateGeneralSupplyDto } from '../dto/create-general-supply.dto';
import { UpdateGeneralSupplyDto } from '../dto/update-general-supply.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { GeneralSupplyQueryDto } from '../dto/inventory-query.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Role } from '../../../common/enums';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';

@Controller('general-supplies')
@UseGuards(AuthGuard, RolesGuard)
export class GeneralSupplyController {
  constructor(private readonly generalSupplyService: GeneralSupplyService) {}

  @Get()
  @Roles(Role.admin, Role.baker, Role.cashier)
  findAll(@Query() query: GeneralSupplyQueryDto) {
    return this.generalSupplyService.findAll(query.category);
  }

  @Get(':id')
  @Roles(Role.admin, Role.baker, Role.cashier)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.generalSupplyService.findOne(id);
  }

  @Post()
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  create(@Body() createDto: CreateGeneralSupplyDto) {
    return this.generalSupplyService.create(createDto);
  }

  @Patch(':id')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateGeneralSupplyDto,
  ) {
    return this.generalSupplyService.update(id, updateDto);
  }

  @Post(':id/adjust-stock')
  @Roles(Role.admin, Role.baker)
  @UseInterceptors(IdempotencyInterceptor)
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.generalSupplyService.adjustStock(id, adjustStockDto, userId);
  }

  @Delete(':id')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.generalSupplyService.remove(id);
  }
}
