
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { Role } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';


import { PosService } from './pos.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PosSummaryQueryDto } from './dto/pos-summary-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('pos/sales')
@UseGuards(AuthGuard, RolesGuard)
export class PosController {
  constructor(private readonly posService: PosService) {}
 

  @Post()
  @Roles(Role.admin, Role.cashier)
  createSale(@Body() dto: CreateSaleDto, @CurrentUser('id') userId?: string) {
    return this.posService.createSale(dto, userId);
  }

  @Get()
  @Roles(Role.admin, Role.cashier)
  findAllSales() {
    return this.posService.findAllSales();
  }

  @Get('summary')
  @Roles(Role.admin, Role.cashier)
  getSalesSummary(@Query() query: PosSummaryQueryDto) {
    return this.posService.getSalesSummary(query.from, query.to);
  }

  @Get(':id')
  @Roles(Role.admin, Role.cashier)
  findSaleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.posService.findSaleById(id);
  }
}
