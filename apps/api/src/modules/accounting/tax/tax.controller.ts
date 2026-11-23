import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../../common/enums';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { TaxService } from './tax.service';
import { TaxPeriodQueryDto } from './dto/tax-query.dto';

@Controller('accounting/tax')
@UseGuards(AuthGuard, RolesGuard)
export class TaxController {
  constructor(private readonly taxService: TaxService) {}

  @Get('vat-summary')
  @Roles(Role.admin)
  getVatSummary(@Query() query: TaxPeriodQueryDto) {
    return this.taxService.getVatSummary(query);
  }

  @Get('sales-book')
  @Roles(Role.admin)
  getSalesBook(@Query() query: TaxPeriodQueryDto) {
    return this.taxService.getSalesBook(query);
  }

  @Get('purchases-book')
  @Roles(Role.admin)
  getPurchasesBook(@Query() query: TaxPeriodQueryDto) {
    return this.taxService.getPurchasesBook(query);
  }
}
