import { Module } from '@nestjs/common';
import { InventoryValuationModule } from '../inventory/inventory-valuation.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';
import { AccountingPeriodController } from './accounting-period.controller';
import { AccountingPeriodService } from './accounting-period.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AnnualClosingService } from './annual-closing.service';
import { EntryController } from './entry.controller';
import { EntryService } from './entry.service';
import { EntryVoidService } from './entry-void.service';
import { AccountingOutboxService } from './accounting-outbox.service';
import { AccountingOutboxProcessorService } from './accounting-outbox-processor.service';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { BalanceController } from './balance.controller';
import { BalanceService } from './balance.service';
import { FinancialReportController } from './financial-report.controller';
import { FinancialReportService } from './financial-report.service';

@Module({
  imports: [InventoryValuationModule],
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
    AccountingOutboxService,
    AccountingSettingsService,
    AccountingPeriodService,
    AnnualClosingService,
    EntryService,
    EntryVoidService,
    AccountingOutboxProcessorService,
    LedgerService,
    BalanceService,
    FinancialReportService,
  ],
  exports: [
    AccountingPeriodService,
    EntryService,
    EntryVoidService,
    AccountingOutboxService,
    AccountingOutboxProcessorService,
  ],
})
export class AccountingModule {}
