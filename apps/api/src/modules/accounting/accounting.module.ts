import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { EntryController } from './entry.controller';
import { EntryService } from './entry.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';

@Module({
  controllers: [
    AccountController,
    EntryController,
    LedgerController,
    BalanceController,
  ],
  providers: [
    AccountService,
    EntryService,
    LedgerService,
    BalanceService,
  ],
  exports: [
    AccountService,
    EntryService,
    LedgerService,
    BalanceService,
  ],
})
export class AccountingModule {}