import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import {
  AccountingOutboxProcessorService,
  dispatchOutboxBestEffort,
  isOutboxDeferredError,
} from '../accounting/outbox/accounting-outbox-processor.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';
import {
  getZonedDateString,
  STORE_TIMEZONE,
} from '../../common/utils/chile-time.util';

export interface EnqueueShiftDifferenceParams {
  shiftId: string;
  shiftNumber: number;
  closedAt: Date;
  cashDifference: number;
  entryDate?: string;
}

export interface ReconcileShiftDifferenceParams {
  shiftId: string;
  shiftNumber: number | bigint;
  cashDifference: number;
  outboxEventId: string | null;
  initialAccountingStatus?: 'none' | 'posted' | 'pending';
  initialAccountingWarning?: string | null;
  initialClosingEntryId?: string | null;
  initialClosingEntryNumber?: number | null;
}

export interface ShiftReconciliationResult {
  accountingStatus: 'none' | 'posted' | 'pending';
  accountingWarning: string | null;
  closingEntryId: string | null;
  closingEntryNumber: number | null;
}

@Injectable()
export class PosShiftReconciliationService {
  constructor(
    private readonly accountingOutboxService: AccountingOutboxService,
    private readonly accountingOutboxProcessor: AccountingOutboxProcessorService,
    private readonly posAccountingStatusService: PosAccountingStatusService,
  ) {}

  /**
   * Encola en la misma transacción del arqueo el evento de ajuste contable por descuadre de caja.
   */
  async enqueueShiftDifferenceInTx(
    tx: Prisma.TransactionClient,
    params: EnqueueShiftDifferenceParams,
  ): Promise<string | null> {
    const { shiftId, shiftNumber, closedAt, cashDifference } = params;
    if (Math.abs(cashDifference) < 0.01) {
      return null;
    }

    const entryDate =
      params.entryDate ?? getZonedDateString(closedAt, STORE_TIMEZONE);

    const outboxEvent =
      await this.accountingOutboxService.enqueueShiftDifferenceInTx(tx, {
        shiftId,
        shiftNumber,
        closedAt,
        cashDifference,
        entryDate,
      });

    return outboxEvent?.id ?? null;
  }

  /**
   * Procesa de forma asíncrona/desacoplada la conciliación contable de la diferencia de caja.
   * Si tiene éxito marca el turno como 'posted', si falla lo deja 'pending' con advertencia.
   */
  async reconcileShiftDifference(
    params: ReconcileShiftDifferenceParams,
  ): Promise<ShiftReconciliationResult> {
    let accountingStatus: 'none' | 'posted' | 'pending' =
      params.initialAccountingStatus ?? 'none';
    let accountingWarning: string | null =
      params.initialAccountingWarning ?? null;
    let closingEntryId: string | null = params.initialClosingEntryId ?? null;
    let closingEntryNumber: number | null =
      params.initialClosingEntryNumber ?? null;

    const cashDiff = Number(params.cashDifference ?? 0);
    if (Math.abs(cashDiff) >= 0.01 && params.outboxEventId) {
      try {
        const adj = await dispatchOutboxBestEffort(
          this.accountingOutboxProcessor,
          params.outboxEventId,
        );

        if (adj.entryId) {
          accountingStatus = 'posted';
          closingEntryId = adj.entryId;
          closingEntryNumber = adj.entryNumber;
          accountingWarning = null;

          await this.posAccountingStatusService
            .markShiftPosted(params.shiftId, adj.entryId)
            .catch(() => undefined);
        }
      } catch (accError) {
        accountingStatus = 'pending';
        if (isOutboxDeferredError(accError)) {
          await this.posAccountingStatusService
            .markShiftPending(params.shiftId, accError.message)
            .catch(() => undefined);
        } else {
          const errorMsg =
            accError instanceof Error
              ? accError.message
              : 'Error al registrar diferencia de caja en contabilidad.';
          accountingWarning = `Turno cerrado en caja. El ajuste contable por diferencia quedó pendiente: ${errorMsg}`;
          console.warn(
            `[PosShiftService] Turno #${Number(params.shiftNumber)} cerrado, ajuste contable pendiente:`,
            errorMsg,
          );

          await this.posAccountingStatusService
            .markShiftPending(params.shiftId, accountingWarning)
            .catch(() => undefined);
        }
      }
    }

    return {
      accountingStatus,
      accountingWarning,
      closingEntryId,
      closingEntryNumber,
    };
  }
}
