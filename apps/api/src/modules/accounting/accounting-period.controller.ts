import { Body, Controller, Get, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccountingPeriodService } from './accounting-period.service';
import {
  CheckPeriodDateQueryDto,
  ExecuteAnnualClosingDto,
  PeriodIdentifierDto,
  PeriodYearQueryDto,
  ReverseAnnualClosingDto,
  UpdateAccountingSettingsDto,
} from './dto/accounting-period.dto';

@Controller('accounting/periods')
@UseGuards(AuthGuard, RolesGuard)
export class AccountingPeriodController {
  constructor(private readonly periodService: AccountingPeriodService) {}

  @Get()
  @Roles(Role.admin)
  getYearOverview(@Query() query: PeriodYearQueryDto) {
    return this.periodService.getYearOverview(query.year);
  }

  @Get('settings')
  @Roles(Role.admin)
  getSettings() {
    return this.periodService.getAccountingSettings();
  }

  @Put('settings')
  @Roles(Role.admin)
  updateSettings(
    @Body() dto: UpdateAccountingSettingsDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.updateAccountingSettings(dto, userId);
  }

  @Get('check')
  @Roles(Role.admin)
  checkDate(@Query() query: CheckPeriodDateQueryDto) {
    return this.periodService.checkDate(query.date);
  }

  @Post('close')
  @Roles(Role.admin)
  closePeriod(
    @Body() dto: PeriodIdentifierDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.closePeriod(dto, userId);
  }

  @Post('reopen')
  @Roles(Role.admin)
  reopenPeriod(
    @Body() dto: PeriodIdentifierDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.reopenPeriod(dto, userId);
  }

  @Get('annual-closing/preview')
  @Roles(Role.admin)
  previewAnnualClosing(@Query() query: PeriodYearQueryDto) {
    return this.periodService.previewAnnualClosing(query.year);
  }

  @Post('annual-closing')
  @Roles(Role.admin)
  executeAnnualClosing(
    @Body() dto: ExecuteAnnualClosingDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.executeAnnualClosing(dto, userId);
  }

  @Post('annual-closing/reverse')
  @Roles(Role.admin)
  reverseAnnualClosing(
    @Body() dto: ReverseAnnualClosingDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.reverseAnnualClosing(dto, userId);
  }
}

