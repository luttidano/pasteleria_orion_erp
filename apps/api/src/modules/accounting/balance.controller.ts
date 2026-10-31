import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { BalanceService } from './balance.service';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class BalanceController {
  constructor(private readonly balanceService: BalanceService) {}

  @Get('balance')
  @Roles(Role.admin)
  getBalance() {
    return this.balanceService.getBalance();
  }
}