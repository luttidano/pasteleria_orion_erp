import { ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AnnualClosingService } from './annual-closing.service';
import { AccountingSettingsService } from './accounting-settings.service';
import { AccountingOutboxService } from '../outbox/accounting-outbox.service';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin } from '../../../common/enums';

describe('AnnualClosingService', () => {
  let service: AnnualClosingService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      accountingPeriod: {
        findUnique: jest.fn(),
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
      accountingAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      accountingOutbox: {
        count: jest.fn().mockResolvedValue(0),
      },
      accountingSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnnualClosingService,
        AccountingSettingsService,
        AccountingOutboxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AnnualClosingService>(AnnualClosingService);
  });

  describe('previewAnnualClosing y executeAnnualClosing', () => {
    it('debe generar la refundición cuadrando Debe = Haber contra Resultado del Ejercicio (utilidad)', async () => {
      prisma.accountingEntry.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.accountingPeriod.count.mockResolvedValue(12);
      prisma.accountingOutbox.count.mockResolvedValue(0);

      const equityAcc = {
        id: 'acc-3102',
        code: '3102',
        name: 'Resultado del Ejercicio',
      };
      prisma.accountingAccount.findFirst.mockResolvedValue(equityAcc);

      prisma.accountingAccount.findMany.mockResolvedValue([
        {
          id: 'acc-4101',
          code: '4101',
          name: 'Ventas de Pastelería y Cafetería',
          accountType: 'ingreso',
          entryItems: [{ debit: 0, credit: 1000000 }],
        },
        {
          id: 'acc-5101',
          code: '5101',
          name: 'Costo Materia Prima',
          accountType: 'costo',
          entryItems: [{ debit: 350000, credit: 0 }],
        },
        {
          id: 'acc-6102',
          code: '6102',
          name: 'Gastos Generales',
          accountType: 'gasto',
          entryItems: [{ debit: 250000, credit: 0 }],
        },
      ]);

      const preview = await service.previewAnnualClosing(2026);

      expect(preview.canExecute).toBe(true);
      expect(preview.totalIngresos).toBe(1000000);
      expect(preview.totalCostos).toBe(350000);
      expect(preview.totalGastos).toBe(250000);
      expect(preview.resultadoEjercicio).toBe(400000);

      const totalDebe = preview.lines.reduce((s, l) => s + l.debit, 0);
      const totalHaber = preview.lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebe).toBe(1000000);
      expect(totalHaber).toBe(1000000);

      const equityLine = preview.lines.find((l) => l.accountCode === '3102');
      expect(equityLine).toBeDefined();
      expect(equityLine?.credit).toBe(400000);
      expect(equityLine?.debit).toBe(0);
    });

    it('debe ejecutar la refundición al 31-12 y cerrar los 12 meses del año', async () => {
      prisma.accountingEntry.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.accountingPeriod.count.mockResolvedValue(10);
      prisma.accountingOutbox.count.mockResolvedValue(0);
      prisma.accountingAccount.findFirst.mockResolvedValue({
        id: 'acc-3102',
        code: '3102',
        name: 'Resultado del Ejercicio',
      });
      prisma.accountingAccount.findMany.mockResolvedValue([
        {
          id: 'acc-4101',
          code: '4101',
          name: 'Ventas',
          accountType: 'ingreso',
          entryItems: [{ debit: 0, credit: 200000 }],
        },
        {
          id: 'acc-6102',
          code: '6102',
          name: 'Gastos',
          accountType: 'gasto',
          entryItems: [{ debit: 300000, credit: 0 }],
        },
      ]);

      prisma.accountingEntry.create.mockResolvedValue({
        id: 'entry-close-1',
        entryNumber: BigInt(120),
        entryDate: new Date('2026-12-31T00:00:00.000Z'),
        concept:
          'Asiento de Cierre Anual (Refundición de Cuentas) - Ejercicio 2026',
        origin: AccountingEntryOrigin.closing,
        items: [{}, {}, {}],
      });
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.accountingPeriod.create.mockResolvedValue({});

      const result = await service.executeAnnualClosing({ year: 2026 }, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.closingDate).toBe('2026-12-31');
      expect(result.resultadoEjercicio).toBe(-100000);
      expect(prisma.accountingEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            origin: AccountingEntryOrigin.closing,
            closingYear: 2026,
          }),
        }),
      );
      expect(prisma.accountingPeriod.create).toHaveBeenCalledTimes(12);
    });
  });

  describe('concurrencia en reverso de cierre anual', () => {
    it('debe lanzar ConflictException si reverseAnnualClosing pierde carrera concurrente (updateMany count 0)', async () => {
      prisma.accountingEntry.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          id: 'closing-2026',
          entryNumber: 120n,
          entryDate: new Date('2026-12-31T00:00:00.000Z'),
          items: [],
        });
      prisma.accountingEntry.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(
        service.reverseAnnualClosing(
          { year: 2026, reason: 'Corrección final' },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
      expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
      expect(prisma.accountingEntry.create).not.toHaveBeenCalled();
    });
  });
});
