import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PeriodLockService } from './period-lock.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AccountingOutboxService } from '../outbox/accounting-outbox.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingPeriodStatus } from '../../../common/enums';

describe('PeriodLockService', () => {
  let service: PeriodLockService;
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
      accountingSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      accountingOutbox: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $executeRaw: jest.fn().mockResolvedValue(1),
      $queryRaw: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodLockService,
        AccountingSettingsService,
        AccountingOutboxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<PeriodLockService>(PeriodLockService);
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

  describe('checkDate', () => {
    it('debe indicar abierto si no hay restricciones', async () => {
      prisma.accountingSettings.findUnique.mockResolvedValue(null);
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);

      const result = await service.checkDate('2026-06-15');
      expect(result.isOpen).toBe(true);
      expect(result.status).toBe(AccountingPeriodStatus.abierto);
      expect(result.reason).toBeNull();
    });

    it('debe indicar cerrado si el mes está cerrado', async () => {
      prisma.accountingSettings.findUnique.mockResolvedValue(null);
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.accountingPeriod.findUnique.mockResolvedValue({
        status: AccountingPeriodStatus.cerrado,
      });

      const result = await service.checkDate('2026-06-15');
      expect(result.isOpen).toBe(false);
      expect(result.status).toBe(AccountingPeriodStatus.cerrado);
      expect(result.reason).toContain('está cerrado');
    });
  });

  describe('getLockedLookup', () => {
    it('debe retornar conjuntos de meses y años bloqueados', async () => {
      prisma.accountingPeriod.findMany.mockResolvedValue([
        { year: 2026, month: 1 },
      ]);
      prisma.accountingEntry.findMany.mockResolvedValue([
        { closingYear: 2025 },
      ]);
      prisma.accountingSettings.findUnique.mockResolvedValue({
        accountingStartDate: new Date('2026-01-01T00:00:00.000Z'),
      });

      const lookup = await service.getLockedLookup();
      expect(lookup.closedMonthKeys.has('2026-1')).toBe(true);
      expect(lookup.closedYears.has(2025)).toBe(true);
      expect(lookup.accountingStartDate).toBe('2026-01-01');
    });
  });
});
