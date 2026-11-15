import { Module } from '@nestjs/common';
import { InventoryValuationModule } from '../inventory/inventory-valuation.module';
import { AccountController } from './accounts/account.controller';
import { AccountService } from './accounts/account.service';
import { AccountingPeriodController } from './periods/accounting-period.controller';
import { AccountingPeriodService } from './periods/accounting-period.service';
import { AccountingSettingsService } from './periods/accounting-settings.service';
import { AnnualClosingService } from './periods/annual-closing.service';
import { EntryController } from './entries/entry.controller';
import { EntryService } from './entries/entry.service';
import { EntryVoidService } from './entries/entry-void.service';
import { AccountingIntegrationService } from './outbox/accounting-integration.service';
import { AccountingOutboxService } from './outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from './outbox/accounting-outbox-processor.service';
import { LedgerController } from './reports/ledger.controller';
import { LedgerService } from './reports/ledger.service';
import { BalanceController } from './reports/balance.controller';
import { BalanceService } from './reports/balance.service';
import { FinancialReportController } from './reports/financial-report.controller';
import { FinancialReportService } from './reports/financial-report.service';

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
    AccountingIntegrationService,
    AccountingOutboxProcessorService,
    LedgerService,
    BalanceService,
    FinancialReportService,
  ],
  exports: [
    AccountingPeriodService,
    EntryService,
    EntryVoidService,
    AccountingIntegrationService,
    AccountingOutboxService,
    AccountingOutboxProcessorService,
  ],
})
export class AccountingModule {}
