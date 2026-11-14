import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../common/enums';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PosSaleService } from './pos-sale.service';
import { PosSummaryService } from './pos-summary.service';
import { CreateSaleDto } from './dto/create-sale.dto';
import { PosSummaryQueryDto } from './dto/pos-summary-query.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';

@Controller('pos/sales')
@UseGuards(AuthGuard, RolesGuard)
export class PosController {
  constructor(
    private readonly posSaleService: PosSaleService,
    private readonly posSummaryService: PosSummaryService,
  ) {}

  @Post()
  @Roles(Role.admin, Role.cashier)
  @UseInterceptors(IdempotencyInterceptor)
  createSale(@Body() dto: CreateSaleDto, @CurrentUser('id') userId?: string) {
    return this.posSaleService.createSale(dto, userId);
  }

  @Get()
  @Roles(Role.admin, Role.cashier)
  findAllSales() {
    return this.posSaleService.findAllSales();
  }

  @Get('summary')
  @Roles(Role.admin, Role.cashier)
  getSalesSummary(@Query() query: PosSummaryQueryDto) {
    return this.posSummaryService.getSalesSummary(query.from, query.to);
  }

  @Get(':id')
  @Roles(Role.admin, Role.cashier)
  findSaleById(@Param('id', ParseUUIDPipe) id: string) {
    return this.posSaleService.findSaleById(id);
  }
}
