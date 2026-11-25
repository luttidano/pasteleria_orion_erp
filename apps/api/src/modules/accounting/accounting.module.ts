import { Module } from '@nestjs/common';
import { InventoryValuationModule } from '../inventory/valuation/inventory-valuation.module';
import { AccountController } from './accounts/account.controller';
import { AccountService } from './accounts/account.service';
import { AccountingPeriodController } from './periods/accounting-period.controller';
import { AccountingPeriodService } from './periods/accounting-period.service';
import { PeriodLockService } from './periods/period-lock.service';
import { AccountingSettingsService } from './periods/accounting-settings.service';
import { AnnualClosingService } from './periods/annual-closing.service';
import { EntryController } from './entries/entry.controller';
import { EntryService } from './entries/entry.service';
import { EntryVoidService } from './entries/entry-void.service';
import { AccountingAccountResolverService } from './outbox/handlers/accounting-account-resolver.service';
import { InventoryAccountingHandler } from './outbox/handlers/inventory-accounting.handler';
import { PurchaseAccountingHandler } from './outbox/handlers/purchase-accounting.handler';
import { SaleAccountingHandler } from './outbox/handlers/sale-accounting.handler';
import { ShiftAccountingHandler } from './outbox/handlers/shift-accounting.handler';
import { AccountingOutboxService } from './outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from './outbox/accounting-outbox-processor.service';
import { AccountingOutboxScheduler } from './outbox/accounting-outbox.scheduler';
import { LedgerController } from './reports/ledger.controller';
import { LedgerService } from './reports/ledger.service';
import { BalanceController } from './reports/balance.controller';
import { BalanceService } from './reports/balance.service';
import { FinancialReportController } from './reports/financial-report.controller';
import { FinancialReportService } from './reports/financial-report.service';
import { TaxCalculatorService } from './tax/tax-calculator.service';
import { TaxController } from './tax/tax.controller';
import { TaxService } from './tax/tax.service';

@Module({
  imports: [InventoryValuationModule],
  controllers: [
    AccountController,
    AccountingPeriodController,
    EntryController,
    LedgerController,
    BalanceController,
    FinancialReportController,
    TaxController,
  ],
  providers: [
    AccountService,
    AccountingOutboxService,
    AccountingSettingsService,
    AccountingPeriodService,
    PeriodLockService,
    AnnualClosingService,
    EntryService,
    EntryVoidService,
    AccountingAccountResolverService,
    SaleAccountingHandler,
    ShiftAccountingHandler,
    InventoryAccountingHandler,
    PurchaseAccountingHandler,
    AccountingOutboxProcessorService,
    AccountingOutboxScheduler,
    LedgerService,
    BalanceService,
    FinancialReportService,
    TaxCalculatorService,
    TaxService,
  ],
  exports: [
    AccountingPeriodService,
    PeriodLockService,
    EntryService,
    EntryVoidService,
    AccountingAccountResolverService,
    SaleAccountingHandler,
    ShiftAccountingHandler,
    InventoryAccountingHandler,
    PurchaseAccountingHandler,
    AccountingOutboxService,
    AccountingOutboxProcessorService,
    TaxCalculatorService,
    TaxService,
  ],
})
export class AccountingModule {}
