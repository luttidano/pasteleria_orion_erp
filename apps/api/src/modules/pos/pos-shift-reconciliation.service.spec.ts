import { Test, TestingModule } from '@nestjs/testing';
import { PosShiftReconciliationService } from './pos-shift-reconciliation.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';

describe('PosShiftReconciliationService', () => {
  let service: PosShiftReconciliationService;
  let outboxService: any;
  let outboxProcessor: any;
  let statusService: any;

  beforeEach(async () => {
    outboxService = {
      enqueueShiftDifferenceInTx: jest.fn().mockResolvedValue({ id: 'outbox-1' }),
    };

    outboxProcessor = {
      processEvent: jest.fn().mockResolvedValue({
        outboxId: 'outbox-1',
        entryId: 'entry-123',
        entryNumber: 99,
      }),
    };

    statusService = {
      markShiftPosted: jest.fn().mockResolvedValue(undefined),
      markShiftPending: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosShiftReconciliationService,
        { provide: AccountingOutboxService, useValue: outboxService },
        { provide: AccountingOutboxProcessorService, useValue: outboxProcessor },
        { provide: PosAccountingStatusService, useValue: statusService },
      ],
    }).compile();

    service = module.get<PosShiftReconciliationService>(
      PosShiftReconciliationService,
    );
  });

  describe('enqueueShiftDifferenceInTx', () => {
    it('debe retornar null si no hay descuadre de caja (< 0.01)', async () => {
      const tx = {} as any;
      const res = await service.enqueueShiftDifferenceInTx(tx, {
        shiftId: 'shift-1',
        shiftNumber: 1,
        closedAt: new Date(),
        cashDifference: 0.004,
      });

      expect(res).toBeNull();
      expect(outboxService.enqueueShiftDifferenceInTx).not.toHaveBeenCalled();
    });

    it('debe encolar en outbox cuando hay descuadre relevante', async () => {
      const tx = {} as any;
      const closedAt = new Date('2026-11-16T15:00:00Z');
      const res = await service.enqueueShiftDifferenceInTx(tx, {
        shiftId: 'shift-1',
        shiftNumber: 1,
        closedAt,
        cashDifference: -500,
      });

      expect(res).toBe('outbox-1');
      expect(outboxService.enqueueShiftDifferenceInTx).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          shiftId: 'shift-1',
          shiftNumber: 1,
          cashDifference: -500,
        }),
      );
    });
  });

  describe('reconcileShiftDifference', () => {
    it('debe retornar estado inicial si la diferencia es 0', async () => {
      const res = await service.reconcileShiftDifference({
        shiftId: 'shift-1',
        shiftNumber: 1,
        cashDifference: 0,
        outboxEventId: null,
        initialAccountingStatus: 'none',
      });

      expect(res.accountingStatus).toBe('none');
      expect(res.closingEntryId).toBeNull();
      expect(outboxProcessor.processEvent).not.toHaveBeenCalled();
    });

    it('debe marcar posted y actualizar posAccountingStatusService si procesa con éxito', async () => {
      const res = await service.reconcileShiftDifference({
        shiftId: 'shift-1',
        shiftNumber: 1,
        cashDifference: 1000,
        outboxEventId: 'outbox-1',
        initialAccountingStatus: 'pending',
      });

      expect(res.accountingStatus).toBe('posted');
      expect(res.closingEntryId).toBe('entry-123');
      expect(res.closingEntryNumber).toBe(99);
      expect(res.accountingWarning).toBeNull();
      expect(statusService.markShiftPosted).toHaveBeenCalledWith(
        'shift-1',
        'entry-123',
      );
    });

    it('debe capturar error, marcar pending y registrar advertencia si falla el registro contable', async () => {
      outboxProcessor.processEvent.mockRejectedValueOnce(
        new Error('Período cerrado'),
      );

      const res = await service.reconcileShiftDifference({
        shiftId: 'shift-1',
        shiftNumber: 1,
        cashDifference: -200,
        outboxEventId: 'outbox-1',
        initialAccountingStatus: 'pending',
      });

      expect(res.accountingStatus).toBe('pending');
      expect(res.accountingWarning).toContain('Período cerrado');
      expect(statusService.markShiftPending).toHaveBeenCalledWith(
        'shift-1',
        expect.stringContaining('Período cerrado'),
      );
    });
  });
});
