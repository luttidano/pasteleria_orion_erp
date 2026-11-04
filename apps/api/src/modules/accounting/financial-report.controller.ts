import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FinancialReportService } from './financial-report.service';

@Controller('accounting/reports')
@UseGuards(AuthGuard, RolesGuard)
export class FinancialReportController {
  constructor(private readonly financialReportService: FinancialReportService) {}

  @Get('income-statement')
  @Roles(Role.admin)
  getIncomeStatement(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialReportService.getIncomeStatement(startDate, endDate);
  }

  @Get('balance-sheet')
  @Roles(Role.admin)
  getBalanceSheet(@Query('asOfDate') asOfDate?: string) {
    return this.financialReportService.getBalanceSheet(asOfDate);
  }

  @Get('summary')
  @Roles(Role.admin)
  getFinancialSummary(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.financialReportService.getFinancialSummary(startDate, endDate);
  }
}

