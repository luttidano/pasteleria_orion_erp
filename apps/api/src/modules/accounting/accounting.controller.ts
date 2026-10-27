import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountingService } from './accounting.service';
import { CreateAccountingMovementDto } from './dto/create-accounting-movement.dto';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @Roles(Role.admin, Role.cashier)
  findAccounts() {
    return this.accountingService.findAccounts();
  }

  @Get('movements')
  @Roles(Role.admin, Role.cashier)
  findMovements() {
    return this.accountingService.findMovements();
  }

  @Post('movements')
  @Roles(Role.admin, Role.cashier)
  createMovement(@Body() dto: CreateAccountingMovementDto) {
    return this.accountingService.createMovement(dto);
  }

  @Get('pending-sales-count')
  @Roles(Role.admin, Role.cashier)
  getPendingSalesCount() {
    return this.accountingService.getPendingSalesCount();
  }

  @Post('sync-pending-sales')
  @Roles(Role.admin)
  syncPendingSales() {
    return this.accountingService.syncPendingSales();
  }
}
