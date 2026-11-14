import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { PosModule } from '../pos/pos.module';
import { PosAccountingSyncController } from './pos-accounting-sync.controller';
import { PosAccountingSyncService } from './pos-accounting-sync.service';

@Module({
  imports: [PosModule, AccountingModule],
  controllers: [PosAccountingSyncController],
  providers: [PosAccountingSyncService],
})
export class PosAccountingSyncModule {}

