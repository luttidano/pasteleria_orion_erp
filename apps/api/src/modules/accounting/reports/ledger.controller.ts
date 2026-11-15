import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { Role } from '../../../common/enums';
import { Roles } from '../../../common/decorators/roles.decorator';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { LedgerService } from './ledger.service';
import { DateRangeQueryDto } from '../dto/report-query.dto';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('ledger/:accountId')
  @Roles(Role.admin)
  getAccountLedger(
    @Param('accountId', ParseUUIDPipe) accountId: string,
    @Query() query: DateRangeQueryDto,
  ) {
    return this.ledgerService.getAccountLedger(
      accountId,
      query.startDate,
      query.endDate,
    );
  }
}