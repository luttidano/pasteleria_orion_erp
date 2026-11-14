import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { FinancialReportService } from './financial-report.service';
import {
  BalanceSheetQueryDto,
  DateRangeQueryDto,
} from './dto/report-query.dto';

@Controller('accounting/reports')
@UseGuards(AuthGuard, RolesGuard)
export class FinancialReportController {
  constructor(private readonly financialReportService: FinancialReportService) {}

  @Get('income-statement')
  @Roles(Role.admin)
  getIncomeStatement(@Query() query: DateRangeQueryDto) {
    return this.financialReportService.getIncomeStatement(
      query.startDate,
      query.endDate,
    );
  }

  @Get('balance-sheet')
  @Roles(Role.admin)
  getBalanceSheet(@Query() query: BalanceSheetQueryDto) {
    return this.financialReportService.getBalanceSheet(query.asOfDate);
  }

  @Get('summary')
  @Roles(Role.admin)
  getFinancialSummary(@Query() query: DateRangeQueryDto) {
    return this.financialReportService.getFinancialSummary(
      query.startDate,
      query.endDate,
    );
  }
}

