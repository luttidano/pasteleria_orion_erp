import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosShiftController } from './pos-shift.controller';
import { PosSaleService } from './pos-sale.service';
import { PosShiftService } from './pos-shift.service';
import { PosSummaryService } from './pos-summary.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [InventoryModule, AccountingModule],
  controllers: [PosController, PosShiftController],
  providers: [
    PosSaleService,
    PosShiftService,
    PosSummaryService,
    PosAccountingStatusService,
  ],
  exports: [PosAccountingStatusService],
})
export class PosModule {}
