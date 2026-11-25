import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AccountingOutboxProcessorService } from './accounting-outbox-processor.service';

@Injectable()
export class AccountingOutboxScheduler {
  private readonly logger = new Logger(AccountingOutboxScheduler.name);
  private isProcessing = false;

  constructor(
    private readonly outboxProcessor: AccountingOutboxProcessorService,
  ) {}

  @Interval(15000)
  async processOutboxBatch(): Promise<void> {
    if (process.env.NODE_ENV === 'test' || this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    try {
      const result = await this.outboxProcessor.syncPendingEvents();
      if (result.synced > 0 || result.failed > 0) {
        this.logger.log(
          `[OutboxWorker] Lote procesado: ${result.synced} sincronizados, ${result.failed} fallidos.`,
        );
      }
    } catch (err) {
      this.logger.error(
        '[OutboxWorker] Error procesando lote de outbox:',
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      this.isProcessing = false;
    }
  }
}
