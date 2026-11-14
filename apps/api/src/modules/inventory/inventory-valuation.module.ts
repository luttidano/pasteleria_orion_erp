import { Module } from '@nestjs/common';
import { InventoryValuationService } from './inventory-valuation.service';

@Module({
  providers: [InventoryValuationService],
  exports: [InventoryValuationService],
})
export class InventoryValuationModule {}

