import {
  BadRequestException,
  ConflictException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountingSettingsService } from './accounting-settings.service';
import { AccountingOutboxService } from './accounting-outbox.service';
import { PrismaService } from '../../database/prisma.service';
import {
  BalanceSheetQueryDto,
  DateRangeQueryDto,
} from './dto/report-query.dto';

describe('AccountingSettingsService & Report Query DTOs', () => {
  let service: AccountingSettingsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingEntry: {
        findFirst: jest.fn(),
      },
      accountingOutbox: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      accountingSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingSettingsService,
        AccountingOutboxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountingSettingsService>(AccountingSettingsService);
  });

  describe('updateSettings', () => {
    it('debe rechazar fijar una fecha de inicio posterior a asientos activos existentes', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue({
        entryNumber: BigInt(12),
        entryDate: new Date('2026-03-10T00:00:00.000Z'),
      });

      await expect(
        service.updateSettings({ accountingStartDate: '2026-05-01' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.accountingSettings.upsert).not.toHaveBeenCalled();
    });

    it('debe guardar la fecha de inicio contable cuando no existen asientos previos incompatibles', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.accountingOutbox.findFirst.mockResolvedValue(null);
      prisma.accountingSettings.upsert.mockResolvedValue({
        id: 'default',
        accountingStartDate: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-11-11T16:00:00.000Z'),
        updatedBy: { id: 'admin-1', name: 'Admin Orión' },
      });

      const res = await service.updateSettings(
        { accountingStartDate: '2026-05-01' },
        'admin-1',
      );
      expect(res.accountingStartDate).toBe('2026-05-01');
      expect(res.updatedBy?.name).toBe('Admin Orión');
    });
  });

  describe('Report Query DTOs con ValidationPipe estricto', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe validar DateRangeQueryDto y BalanceSheetQueryDto con YYYY-MM-DD estricto', async () => {
      await expect(
        pipe.transform(
          { startDate: '2026-11-01T00:00:00Z' },
          { type: 'query', metatype: DateRangeQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          { asOfDate: '11-11-2026' },
          { type: 'query', metatype: BalanceSheetQueryDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const validRange = await pipe.transform(
        { startDate: '2026-11-01', endDate: '' },
        { type: 'query', metatype: DateRangeQueryDto },
      );
      expect(validRange.startDate).toBe('2026-11-01');
      expect(validRange.endDate).toBeUndefined();
    });
  });
});
