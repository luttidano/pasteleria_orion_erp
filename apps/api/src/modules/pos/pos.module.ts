import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosShiftController } from './pos-shift.controller';
import { PosSaleService } from './pos-sale.service';
import { PosShiftService } from './pos-shift.service';
import { PosShiftReconciliationService } from './pos-shift-reconciliation.service';
import { PosSummaryService } from './pos-summary.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';
import { PosSalesReaderModule } from './pos-sales-reader.module';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule, AccountingModule, PosSalesReaderModule],
  controllers: [PosController, PosShiftController],
  providers: [
    PosSaleService,
    PosShiftService,
    PosShiftReconciliationService,
    PosSummaryService,
    PosAccountingStatusService,
  ],
  exports: [
    PosAccountingStatusService,
    PosShiftReconciliationService,
    PosSalesReaderModule,
  ],
})
export class PosModule {}
