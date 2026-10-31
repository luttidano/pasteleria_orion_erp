import { Controller, Get, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AccountService } from './account.service';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  @Get('accounts')
  @Roles(Role.admin, Role.cashier)
  findAccounts() {
    return this.accountService.findAccounts();
  }
}