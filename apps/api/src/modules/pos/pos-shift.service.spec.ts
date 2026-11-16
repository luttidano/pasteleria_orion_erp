import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test, TestingModule } from '@nestjs/testing';
import { PosShiftService } from './pos-shift.service';
import { PosShiftReconciliationService } from './pos-shift-reconciliation.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { ClosePosShiftDto } from './dto/pos-shift.dto';

describe('PosShiftService', () => {
  let service: PosShiftService;
  let prisma: any;
  let outboxProcessor: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn(),
      },
      posShift: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-shift-1' }),
      },
    };

    outboxProcessor = {
      processEvent: jest.fn().mockResolvedValue({
        outboxId: 'outbox-shift-1',
        aggregateType: 'pos_shift',
        aggregateId: 'shift-open-3',
        entryId: 'adj-entry-1',
        entryNumber: 42,
        alreadyProcessed: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosShiftService,
        PosShiftReconciliationService,
        PosAccountingStatusService,
        AccountingOutboxService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingOutboxProcessorService, useValue: outboxProcessor },
      ],
    }).compile();

    service = module.get<PosShiftService>(PosShiftService);
  });

  it('debe reiniciar indicadores en $0 cuando no hay turno abierto tras un cierre previo', async () => {
    prisma.posShift.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'shift-1',
        shiftNumber: 1n,
        closedAt: new Date('2026-11-11T15:00:00Z'),
        closedBy: { id: 'admin-1', name: 'Admin' },
        totalSales: 25000,
        expectedCash: 22500,
        countedCash: 22500,
        cashDifference: 0,
      });

    const overview = await service.getActiveShiftOverview(
      '2026-11-11T03:00:00.000Z',
      '2026-11-12T02:59:59.999Z',
    );

    expect(overview.hasOpenShift).toBe(false);
    expect(overview.totalSales).toBe(0);
    expect(overview.expectedCash).toBe(0);
    expect(overview.lastClosedShift?.shiftNumber).toBe(1);
  });

  it('debe cerrar el turno con FOR UPDATE usando openingCash guardado en BD y generar ajuste contable', async () => {
    const openShift = {
      id: 'shift-open-3',
      shiftNumber: 3n,
      status: 'abierto',
      openingCash: 10000,
      openedAt: new Date('2026-11-11T12:00:00Z'),
    };

    const closedRecord = {
      ...openShift,
      status: 'cerrado',
      closedAt: new Date('2026-11-11T20:00:00Z'),
      openedBy: { id: 'u1', name: 'Cajero' },
      closedBy: { id: 'u1', name: 'Cajero' },
      closingEntry: null,
      totalSales: 18000,
      transactionsCount: 3,
      cashSalesTotal: 10000,
      debitTotal: 8000,
      creditTotal: 0,
      transferTotal: 0,
      cardPosTotal: 8000,
      expectedCash: 20000,
      countedCash: 19500,
      cashDifference: -500,
      notes: 'Faltó una moneda de $500',
      closingEntryId: null,
      accountingStatus: 'pending',
      accountingWarning: null,
    };

    const mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: openShift.id }]),
      posShift: {
        findFirst: jest.fn().mockResolvedValue(openShift),
        findUnique: jest.fn().mockResolvedValue(openShift),
        update: jest.fn().mockResolvedValue(closedRecord),
      },
      posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([
          { paymentMethod: 'efectivo', _sum: { total: 10000 }, _count: { _all: 2 } },
          { paymentMethod: 'debito', _sum: { total: 8000 }, _count: { _all: 1 } },
        ]),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-shift-1' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

    const result = await service.closeShift(
      {
        countedCash: 19500,
        notes: 'Faltó una moneda de $500',
      },
      'u1',
    );

    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(result.expectedCash).toBe(20000);
    expect(result.countedCash).toBe(19500);
    expect(result.cashDifference).toBe(-500);
    expect(result.accountingStatus).toBe('posted');
    expect(result.closingEntryNumber).toBe(42);
    expect(mockTx.accountingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aggregateType: 'pos_shift',
          aggregateId: 'shift-open-3',
          payload: expect.objectContaining({
            shiftNumber: 3,
            cashDifference: -500,
            entryDate: '2026-11-11',
          }),
        }),
      }),
    );
    expect(outboxProcessor.processEvent).toHaveBeenCalledWith('outbox-shift-1');
    expect(prisma.posShift.updateMany).toHaveBeenCalledWith({
      where: { id: 'shift-open-3' },
      data: {
        accountingStatus: 'posted',
        closingEntryId: 'adj-entry-1',
        accountingWarning: null,
      },
    });
  });

  it('debe mantener el cierre en caja con accountingWarning si falla el registro contable por período cerrado', async () => {
    const openShift = {
      id: 'shift-open-4',
      shiftNumber: 4n,
      status: 'abierto',
      openingCash: 5000,
      openedAt: new Date('2026-11-11T12:00:00Z'),
    };

    const closedRecord = {
      ...openShift,
      status: 'cerrado',
      closedAt: new Date('2026-11-11T21:00:00Z'),
      openedBy: { id: 'u1', name: 'Cajero' },
      closedBy: { id: 'u1', name: 'Cajero' },
      closingEntry: null,
      totalSales: 5000,
      transactionsCount: 1,
      cashSalesTotal: 5000,
      debitTotal: 0,
      creditTotal: 0,
      transferTotal: 0,
      cardPosTotal: 0,
      expectedCash: 10000,
      countedCash: 10500,
      cashDifference: 500,
      notes: null,
      closingEntryId: null,
      accountingStatus: 'pending',
      accountingWarning: null,
    };

    const mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: openShift.id }]),
      posShift: {
        findFirst: jest.fn().mockResolvedValue(openShift),
        findUnique: jest.fn().mockResolvedValue(openShift),
        update: jest.fn().mockResolvedValue(closedRecord),
      },
      posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn().mockResolvedValue([
          { paymentMethod: 'efectivo', _sum: { total: 5000 }, _count: { _all: 1 } },
        ]),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-shift-2' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
    outboxProcessor.processEvent.mockRejectedValueOnce(
      new Error('El período contable Noviembre 2026 está cerrado.'),
    );

    const result = await service.closeShift({ countedCash: 10500 }, 'u1');

    expect(result.status).toBe('cerrado');
    expect(result.accountingStatus).toBe('pending');
    expect(result.accountingWarning).toMatch(/pendiente/i);
    expect(prisma.posShift.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shift-open-4' },
        data: expect.objectContaining({
          accountingStatus: 'pending',
        }),
      }),
    );
  });

  it('debe usar la fecha de Chile (America/Santiago) en el servidor para el ajuste contable de cierre', async () => {
    const openShift = {
      id: 'shift-tz-1',
      shiftNumber: 5n,
      status: 'abierto',
      openingCash: 0,
      openedAt: new Date('2026-11-11T14:00:00Z'),
    };

    const lateNightChileUtc = new Date('2026-11-12T01:30:00.000Z');
    const closedRecord = {
      ...openShift,
      status: 'cerrado',
      closedAt: lateNightChileUtc,
      openedBy: { id: 'u1', name: 'Cajero' },
      closedBy: { id: 'u1', name: 'Cajero' },
      closingEntry: null,
      totalSales: 5000,
      transactionsCount: 1,
      cashSalesTotal: 5000,
      debitTotal: 0,
      creditTotal: 0,
      transferTotal: 0,
      cardPosTotal: 0,
      expectedCash: 5000,
      countedCash: 5200,
      cashDifference: 200,
      notes: null,
      closingEntryId: null,
      accountingStatus: 'pending',
      accountingWarning: null,
    };

    const mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: openShift.id }]),
      posShift: {
        findFirst: jest.fn().mockResolvedValue(openShift),
        findUnique: jest.fn().mockResolvedValue(openShift),
        update: jest.fn().mockResolvedValue(closedRecord),
      },
      posSale: {
        groupBy: jest.fn().mockResolvedValue([
          { paymentMethod: 'efectivo', _sum: { total: 5000 }, _count: { _all: 1 } },
        ]),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-shift-tz' }),
      },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

    await service.closeShift({ countedCash: 5200 }, 'u1');

    expect(mockTx.accountingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          payload: expect.objectContaining({
            entryDate: '2026-11-11',
          }),
        }),
      }),
    );
  });

  it('debe rechazar con ConflictException el doble cierre secuencial y BadRequestException sin actividad', async () => {
    const mockTxAlreadyClosed = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      posShift: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce({ id: 'shift-closed-prev' }),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      posSale: { count: jest.fn() },
    };

    prisma.$transaction.mockImplementation(async (cb: any) =>
      cb(mockTxAlreadyClosed),
    );

    await expect(
      service.closeShift({ countedCash: 20000 }, 'u1'),
    ).rejects.toThrow(ConflictException);
    expect(outboxProcessor.processEvent).not.toHaveBeenCalled();

    const mockTxEmpty = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      posShift: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(null),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
      },
      posSale: { count: jest.fn().mockResolvedValue(0) },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTxEmpty));

    await expect(
      service.closeShift({ countedCash: 20000 }, 'u1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe exigir status abierto en posShift.update y lanzar ConflictException ante cierre concurrente (P2025)', async () => {
    const openShift = {
      id: 'shift-race-close',
      shiftNumber: 6n,
      status: 'abierto',
      openingCash: 10000,
      openedAt: new Date('2026-11-11T12:00:00Z'),
    };

    const p2025Error = new Prisma.PrismaClientKnownRequestError(
      'Record to update not found.',
      { code: 'P2025', clientVersion: '7.10.0' },
    );

    const mockTx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: openShift.id }]),
      posShift: {
        findFirst: jest.fn().mockResolvedValue(openShift),
        findUnique: jest.fn().mockResolvedValue(openShift),
        update: jest.fn().mockRejectedValue(p2025Error),
      },
      posSale: { groupBy: jest.fn().mockResolvedValue([]) },
    };

    prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

    await expect(
      service.closeShift({ countedCash: 10000 }, 'u1'),
    ).rejects.toThrow(ConflictException);
  });

  describe('ClosePosShiftDto con ValidationPipe estricto', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe rechazar openingCash o localDate enviados por cliente en ClosePosShiftDto', async () => {
      await expect(
        pipe.transform(
          { countedCash: 10000, openingCash: 5000 },
          { type: 'body', metatype: ClosePosShiftDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { countedCash: 10000, localDate: '2026-11-11' },
          { type: 'body', metatype: ClosePosShiftDto },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
