import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountingPeriodService } from './accounting-period.service';
import { PeriodLockService } from './period-lock.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AccountingOutboxService } from '../outbox/accounting-outbox.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingPeriodStatus } from '../../../common/enums';

describe('AccountingPeriodService', () => {
  let service: AccountingPeriodService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingPeriod: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        upsert: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      accountingEntry: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      accountingOutbox: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      accountingSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPeriodService,
        PeriodLockService,
        AccountingSettingsService,
        AccountingOutboxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountingPeriodService>(AccountingPeriodService);
  });

  describe('extractYearMonth', () => {
    it('debe extraer año y mes sin desplazamiento por zona horaria en YYYY-MM-DD', () => {
      expect(service.extractYearMonth('2026-01-01')).toEqual({
        year: 2026,
        month: 1,
      });
      expect(service.extractYearMonth('2026-12-31')).toEqual({
        year: 2026,
        month: 12,
      });
    });

    it('debe rechazar fechas inválidas', () => {
      expect(() => service.extractYearMonth('2026-02-30')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('assertPeriodOpen', () => {
    it('debe bloquear con ConflictException si el mes está cerrado', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.$queryRaw.mockResolvedValue([{ status: AccountingPeriodStatus.cerrado }]);

      await expect(service.assertPeriodOpen('2026-01-15')).rejects.toThrow(
        ConflictException,
      );
    });

    it('debe bloquear con ConflictException si el año ya tiene Cierre Anual activo', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue({
        id: 'closing-1',
        entryNumber: BigInt(99),
      });

      await expect(service.assertPeriodOpen('2026-05-10')).rejects.toThrow(
        ConflictException,
      );
    });

    it('debe permitir e inicializar en abierto un mes sin registro previo', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([{ status: AccountingPeriodStatus.abierto }]);

      const res = await service.assertPeriodOpen('2026-03-01');
      expect(res).toEqual({ year: 2026, month: 3 });
      expect(prisma.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('debe bloquear con ConflictException si la fecha es anterior al inicio contable configurado', async () => {
      prisma.accountingSettings.findUnique.mockResolvedValue({
        accountingStartDate: new Date('2026-05-01T00:00:00.000Z'),
      });

      await expect(service.assertPeriodOpen('2026-04-30')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.$executeRaw).not.toHaveBeenCalled();
    });

    it('debe permitir el mismo día configurado como inicio contable', async () => {
      prisma.accountingSettings.findUnique.mockResolvedValue({
        accountingStartDate: new Date('2026-05-01T00:00:00.000Z'),
      });
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.$executeRaw.mockResolvedValue(1);
      prisma.$queryRaw.mockResolvedValue([{ status: AccountingPeriodStatus.abierto }]);

      const res = await service.assertPeriodOpen('2026-05-01');
      expect(res).toEqual({ year: 2026, month: 5 });
    });
  });

  describe('closePeriod y reopenPeriod', () => {
    it('debe impedir cerrar un mes si existen eventos POS pendientes en accounting_outbox', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.accountingOutbox.count.mockResolvedValue(2);

      await expect(
        service.closePeriod({ year: 2026, month: 10 }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('debe impedir reabrir un mes cuando el ejercicio tiene Cierre Anual activo', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue({
        id: 'closing-1',
        entryNumber: BigInt(50),
      });

      await expect(
        service.reopenPeriod({ year: 2026, month: 11 }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar ConflictException si reopenPeriod pierde carrera concurrente (updateMany count 0)', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValueOnce(null);
      prisma.accountingPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-11',
        year: 2026,
        month: 11,
        status: AccountingPeriodStatus.cerrado,
      });
      prisma.accountingPeriod.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.reopenPeriod({ year: 2026, month: 11 }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
    });
  });
});
