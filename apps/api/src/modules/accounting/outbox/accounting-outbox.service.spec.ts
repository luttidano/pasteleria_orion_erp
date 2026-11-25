import { Test, TestingModule } from '@nestjs/testing';
import { AccountingOutboxService } from './accounting-outbox.service';
import { AccountingOutboxProcessorService } from './accounting-outbox-processor.service';
import { EntryService } from '../entries/entry.service';
import { PrismaService } from '../../../database/prisma.service';
import { PosAccountingSyncService } from '../../integrations/pos-accounting-sync.service';
import { PosAccountingStatusService } from '../../pos/pos-accounting-status.service';

describe('AccountingOutbox & PosAccountingSync (Transactional Outbox)', () => {
  let outboxService: AccountingOutboxService;
  let processor: AccountingOutboxProcessorService;
  let syncService: PosAccountingSyncService;
  let prisma: any;
  let entryService: any;

  beforeEach(async () => {
    prisma = {
      accountingOutbox: {
        upsert: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue({}),
      },
      accountingEntry: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      posSale: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      posSaleItem: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      posShift: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    entryService = {
      registerSaleIncome: jest
        .fn()
        .mockResolvedValue({ entryId: 'entry-sale-1', entryNumber: 101 }),
      registerShiftDifferenceAdjustment: jest
        .fn()
        .mockResolvedValue({ entryId: 'entry-shift-1', entryNumber: 102 }),
      registerInventoryPurchase: jest
        .fn()
        .mockResolvedValue({ entryId: 'entry-pur-1', entryNumber: 103 }),
      registerProductionTransfer: jest
        .fn()
        .mockResolvedValue({ entryId: 'entry-prod-1', entryNumber: 104 }),
      registerInventoryAdjustment: jest
        .fn()
        .mockResolvedValue({ entryId: 'entry-adj-1', entryNumber: 105 }),
      registerSaleCogs: jest
        .fn()
        .mockResolvedValue({ entryId: 'entry-cogs-1', entryNumber: 106 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingOutboxService,
        AccountingOutboxProcessorService,
        PosAccountingStatusService,
        PosAccountingSyncService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntryService, useValue: entryService },
      ],
    }).compile();

    outboxService = module.get(AccountingOutboxService);
    processor = module.get(AccountingOutboxProcessorService);
    syncService = module.get(PosAccountingSyncService);
  });

  it('debe omitir enqueueSaleInTx cuando el total es <= 0', async () => {
    const res = await outboxService.enqueueSaleInTx(prisma, {
      saleId: 'sale-zero',
      ticketNumber: 'TK-0',
      soldAt: new Date('2026-11-12T12:00:00Z'),
      total: 0,
      paymentMethod: 'efectivo',
    });

    expect(res).toBeNull();
    expect(prisma.accountingOutbox.upsert).not.toHaveBeenCalled();
  });

  it('debe sincronizar eventos pendientes (ventas + diferencias de turno) y delegar el estado a PosModule', async () => {
    prisma.accountingOutbox.findMany.mockResolvedValueOnce([
      { id: 'outbox-1' },
      { id: 'outbox-2' },
    ]);

    prisma.accountingOutbox.findUnique
      .mockResolvedValueOnce({
        id: 'outbox-1',
        aggregateType: 'pos_sale',
        aggregateId: 'sale-pending-1',
        status: 'pending',
        payload: {
          ticketNumber: 'TK-900',
          soldAt: '2026-11-11T16:00:00.000Z',
          total: 1190,
          paymentMethod: 'efectivo',
        },
      })
      .mockResolvedValueOnce({
        id: 'outbox-2',
        aggregateType: 'pos_shift',
        aggregateId: 'shift-pending-1',
        status: 'pending',
        payload: {
          shiftNumber: 8,
          closedAt: '2026-11-11T23:00:00.000Z',
          cashDifference: -500,
          entryDate: '2026-11-11',
        },
      });

    const result = await syncService.syncPendingSales();

    expect(result).toEqual({ synced: 2, failed: 0 });
    expect(entryService.registerSaleIncome).toHaveBeenCalledWith(
      {
        id: 'sale-pending-1',
        ticketNumber: 'TK-900',
        soldAt: '2026-11-11T16:00:00.000Z',
        total: 1190,
        paymentMethod: 'efectivo',
      },
      prisma,
    );
    expect(entryService.registerShiftDifferenceAdjustment).toHaveBeenCalledWith(
      {
        shiftId: 'shift-pending-1',
        shiftNumber: 8,
        closedAt: '2026-11-11T23:00:00.000Z',
        cashDifference: -500,
        entryDate: '2026-11-11',
      },
      prisma,
    );
    expect(prisma.accountingOutbox.update).toHaveBeenCalledTimes(2);
    expect(prisma.posSale.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: ['sale-pending-1'] },
        accountingStatus: { not: 'posted' },
      },
      data: {
        accountingStatus: 'posted',
        accountingError: null,
      },
    });
    expect(prisma.posShift.updateMany).toHaveBeenCalledWith({
      where: { id: 'shift-pending-1' },
      data: {
        accountingStatus: 'posted',
        closingEntryId: 'entry-shift-1',
        accountingWarning: null,
      },
    });
  });

  it('debe registrar lastError e incrementar attempts si falla el procesamiento en outbox', async () => {
    prisma.accountingOutbox.findUnique.mockResolvedValueOnce({
      id: 'outbox-fail',
      aggregateType: 'pos_sale',
      aggregateId: 'sale-fail',
      status: 'pending',
      payload: {
        ticketNumber: 'TK-FAIL',
        soldAt: '2026-10-15T16:00:00.000Z',
        total: 1190,
        paymentMethod: 'efectivo',
      },
    });
    entryService.registerSaleIncome.mockRejectedValueOnce(
      new Error('Período Octubre 2026 cerrado'),
    );

    await expect(processor.processEvent('outbox-fail')).rejects.toThrow(
      'Período Octubre 2026 cerrado',
    );

    expect(prisma.accountingOutbox.update).toHaveBeenCalledWith({
      where: { id: 'outbox-fail' },
      data: {
        attempts: { increment: 1 },
        lastError: 'Período Octubre 2026 cerrado',
      },
      select: { attempts: true },
    });
  });

  it('debe marcar el evento como failed (Dead-Letter) al alcanzar el límite de 5 intentos fallidos', async () => {
    prisma.accountingOutbox.findUnique.mockResolvedValueOnce({
      id: 'outbox-dead-letter',
      aggregateType: 'pos_sale',
      aggregateId: 'sale-dead',
      status: 'pending',
      payload: {
        ticketNumber: 'TK-DEAD',
        soldAt: '2026-10-15T16:00:00.000Z',
        total: 1000,
        paymentMethod: 'efectivo',
      },
    });
    entryService.registerSaleIncome.mockRejectedValueOnce(
      new Error('Error irrecuperable'),
    );
    prisma.accountingOutbox.update
      .mockResolvedValueOnce({ attempts: 5 }) // Primer update incrementa y devuelve 5
      .mockResolvedValueOnce({ id: 'outbox-dead-letter', status: 'failed' }); // Segundo update marca failed

    await expect(processor.processEvent('outbox-dead-letter')).rejects.toThrow(
      'Error irrecuperable',
    );

    expect(prisma.accountingOutbox.update).toHaveBeenCalledWith({
      where: { id: 'outbox-dead-letter' },
      data: { status: 'failed' },
    });
  });

  it('debe despachar eventos de inventario perpetuo y COGS durante el replay de outbox', async () => {
    prisma.accountingOutbox.findMany.mockResolvedValueOnce([
      { id: 'outbox-inv-1' },
      { id: 'outbox-cogs-1' },
    ]);

    prisma.accountingOutbox.findUnique
      .mockResolvedValueOnce({
        id: 'outbox-inv-1',
        aggregateType: 'inventory_purchase',
        aggregateId: 'mov-1',
        status: 'pending',
        payload: {
          movementId: 'mov-1',
          itemType: 'ingredient',
          itemId: 'ing-1',
          itemName: 'Mantequilla',
          quantity: 5,
          unit: 'kg',
          totalCost: 23800,
          hasInvoice: true,
          paymentMethod: 'efectivo',
          occurredAt: '2026-11-12T12:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        id: 'outbox-cogs-1',
        aggregateType: 'pos_sale_cogs',
        aggregateId: 'sale-1',
        status: 'pending',
        payload: {
          saleId: 'sale-1',
          ticketNumber: 'TK-200',
          soldAt: '2026-11-12T12:05:00.000Z',
          items: [
            {
              productId: 'prod-1',
              packagingId: null,
              productName: 'Pie de Limón',
              quantity: 1,
              unitCost: 4200,
            },
          ],
        },
      });

    entryService.registerSaleCogs.mockResolvedValueOnce({
      entryId: 'entry-cogs-1',
      entryNumber: 106,
      recoveredItemCosts: [{ saleItemId: 'sale-item-99', unitCost: 4200 }],
    });

    const res = await syncService.syncPendingSales();
    expect(res).toEqual({ synced: 2, failed: 0 });
    expect(entryService.registerInventoryPurchase).toHaveBeenCalledWith(
      'outbox-inv-1',
      expect.objectContaining({ itemName: 'Mantequilla', totalCost: 23800 }),
      prisma,
    );
    expect(entryService.registerSaleCogs).toHaveBeenCalledWith(
      'outbox-cogs-1',
      expect.objectContaining({ ticketNumber: 'TK-200' }),
      prisma,
    );
    expect(prisma.posSaleItem.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'sale-item-99',
        unitCost: { lte: 0 },
      },
      data: {
        unitCost: 4200,
      },
    });
  });

  it('debe acotar la latencia del hot path con processEventBestEffort sin bloquear ante demora contable', async () => {
    const slowSpy = jest
      .spyOn(processor, 'processEvent')
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            const t = setTimeout(() => {
              resolve({
                outboxId: 'outbox-slow',
                aggregateType: 'pos_sale',
                aggregateId: 'sale-slow',
                entryId: 'entry-slow',
                entryNumber: 999,
                alreadyProcessed: false,
              });
            }, 250);
            if (typeof t.unref === 'function') t.unref();
          }),
      );

    await expect(
      processor.processEventBestEffort('outbox-slow', 20),
    ).rejects.toThrow(/diferida al worker en segundo plano/i);
    expect(slowSpy).toHaveBeenCalledWith('outbox-slow');
  });
});

