import { Injectable } from '@nestjs/common';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { PosAccountingStatusService } from '../pos/pos-accounting-status.service';

@Injectable()
export class PosAccountingSyncService {
  constructor(
    private readonly outboxService: AccountingOutboxService,
    private readonly outboxProcessor: AccountingOutboxProcessorService,
    private readonly posAccountingStatusService: PosAccountingStatusService,
  ) {}

  getPendingSalesCount(): Promise<{ pendingCount: number }> {
    return this.outboxService.getPendingCount();
  }

  async syncPendingSales(): Promise<{ synced: number; failed: number }> {
    const result = await this.outboxProcessor.syncPendingEvents();
    await this.posAccountingStatusService.applySyncResults(
      result.syncedSales,
      result.syncedShifts,
      result.recoveredItemCosts,
    );

    return {
      synced: result.synced,
      failed: result.failed,
    };
  }
}

