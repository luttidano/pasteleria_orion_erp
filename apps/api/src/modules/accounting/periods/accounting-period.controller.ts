import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../../common/enums';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AnnualClosingService } from './annual-closing.service';
import {
  CheckPeriodDateQueryDto,
  ExecuteAnnualClosingDto,
  PeriodIdentifierDto,
  PeriodYearQueryDto,
  ReverseAnnualClosingDto,
  UpdateAccountingSettingsDto,
} from '../dto/accounting-period.dto';

@Controller('accounting/periods')
@UseGuards(AuthGuard, RolesGuard)
export class AccountingPeriodController {
  constructor(
    private readonly periodService: AccountingPeriodService,
    private readonly settingsService: AccountingSettingsService,
    private readonly annualClosingService: AnnualClosingService,
  ) {}

  @Get()
  @Roles(Role.admin)
  getYearOverview(@Query() query: PeriodYearQueryDto) {
    return this.periodService.getYearOverview(query.year);
  }

  @Get('settings')
  @Roles(Role.admin)
  getSettings() {
    return this.settingsService.getSettings();
  }

  @Put('settings')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  updateSettings(
    @Body() dto: UpdateAccountingSettingsDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.settingsService.updateSettings(dto, userId);
  }

  @Get('check')
  @Roles(Role.admin)
  checkDate(@Query() query: CheckPeriodDateQueryDto) {
    return this.periodService.checkDate(query.date);
  }

  @Post('close')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  closePeriod(
    @Body() dto: PeriodIdentifierDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.closePeriod(dto, userId);
  }

  @Post('reopen')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  reopenPeriod(
    @Body() dto: PeriodIdentifierDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.periodService.reopenPeriod(dto, userId);
  }

  @Get('annual-closing/preview')
  @Roles(Role.admin)
  previewAnnualClosing(@Query() query: PeriodYearQueryDto) {
    return this.annualClosingService.previewAnnualClosing(query.year);
  }

  @Post('annual-closing')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  executeAnnualClosing(
    @Body() dto: ExecuteAnnualClosingDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.annualClosingService.executeAnnualClosing(dto, userId);
  }

  @Post('annual-closing/reverse')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  reverseAnnualClosing(
    @Body() dto: ReverseAnnualClosingDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.annualClosingService.reverseAnnualClosing(dto, userId);
  }
}

