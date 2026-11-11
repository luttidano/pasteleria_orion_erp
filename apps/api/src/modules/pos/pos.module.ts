import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { PosShiftController } from './pos-shift.controller';
import { PosService } from './pos.service';
import { AccountingModule } from '../accounting/accounting.module';

@Module({
  imports: [AccountingModule],
  controllers: [PosController, PosShiftController],
  providers: [PosService],
  exports: [PosService],
})
export class PosModule {}