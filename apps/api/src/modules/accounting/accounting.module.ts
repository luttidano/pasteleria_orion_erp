import { Module } from '@nestjs/common';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountingPeriodController } from './accounting-period.controller';
import { AccountingPeriodService } from './accounting-period.service';
import { EntryController } from './entry.controller';
import { EntryService } from './entry.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { FinancialReportController } from './financial-report.controller';
import { FinancialReportService } from './financial-report.service';

@Module({
  controllers: [
    AccountController,
    AccountingPeriodController,
    EntryController,
    LedgerController,
    BalanceController,
    FinancialReportController,
  ],
  providers: [
    AccountService,
    AccountingPeriodService,
    EntryService,
    LedgerService,
    BalanceService,
    FinancialReportService,
  ],
  exports: [
    AccountService,
    AccountingPeriodService,
    EntryService,
    LedgerService,
    BalanceService,
    FinancialReportService,
  ],
})
export class AccountingModule {}
