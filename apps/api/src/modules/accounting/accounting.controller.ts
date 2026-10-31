import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { AccountingService } from './accounting.service';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class AccountingController {
  constructor(private readonly accountingService: AccountingService) {}

  @Get('accounts')
  @Roles(Role.admin, Role.cashier)
  findAccounts() {
    return this.accountingService.findAccounts();
  }

  // Libro Diario formal con Debe y Haber
  @Get('entries')
  @Roles(Role.admin)
  findEntries() {
    return this.accountingService.findEntries();
  }

  @Post('entries')
  @Roles(Role.admin)
  createEntry(@Body() dto: CreateAccountingEntryDto) {
    return this.accountingService.createEntry(dto);
  }

  // Balance de Comprobación y Saldos
  @Get('balance')
  @Roles(Role.admin)
  getBalance() {
    return this.accountingService.getBalance();
  }

  @Get('pending-sales-count')
  @Roles(Role.admin)
  getPendingSalesCount() {
    return this.accountingService.getPendingSalesCount();
  }

  @Post('sync-pending-sales')
  @Roles(Role.admin)
  syncPendingSales() {
    return this.accountingService.syncPendingSales();
  }
}