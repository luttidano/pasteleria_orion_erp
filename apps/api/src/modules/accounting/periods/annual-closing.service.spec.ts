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
      accountingEntryItem: {
        groupBy: jest.fn().mockResolvedValue([]),
        aggregate: jest
          .fn()
          .mockResolvedValue({ _sum: { debit: 0, credit: 0 } }),
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
        code: '3.1.02.01',
        name: 'Resultado del Ejercicio',
      };
      prisma.accountingAccount.findFirst.mockResolvedValue(equityAcc);

      prisma.accountingAccount.findMany.mockResolvedValue([
        {
          id: 'acc-4101',
          code: '4.1.01.01',
          name: 'Ventas de Pastelería y Cafetería',
          accountType: 'ingreso',
        },
        {
          id: 'acc-5101',
          code: '5.1.01.01',
          name: 'Costo Materia Prima',
          accountType: 'costo',
        },
        {
          id: 'acc-6102',
          code: '6.1.01.01',
          name: 'Gastos Generales',
          accountType: 'gasto',
        },
      ]);

      prisma.accountingEntryItem.groupBy.mockResolvedValue([
        { accountId: 'acc-4101', _sum: { debit: 0, credit: 1000000 } },
        { accountId: 'acc-5101', _sum: { debit: 350000, credit: 0 } },
        { accountId: 'acc-6102', _sum: { debit: 250000, credit: 0 } },
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

      const equityLine = preview.lines.find((l) => l.accountCode === '3.1.02.01');
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
        code: '3.1.02.01',
        name: 'Resultado del Ejercicio',
      });
      prisma.accountingAccount.findMany.mockResolvedValue([
        {
          id: 'acc-4101',
          code: '4.1.01.01',
          name: 'Ventas',
          accountType: 'ingreso',
        },
        {
          id: 'acc-6102',
          code: '6.1.01.01',
          name: 'Gastos',
          accountType: 'gasto',
        },
      ]);

      prisma.accountingEntryItem.groupBy.mockResolvedValue([
        { accountId: 'acc-4101', _sum: { debit: 0, credit: 200000 } },
        { accountId: 'acc-6102', _sum: { debit: 300000, credit: 0 } },
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

    it('debe traspasar saldo de ejercicios anteriores desde 3102 a 3103 al cerrar un año subsiguiente', async () => {
      prisma.accountingEntry.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.accountingPeriod.count.mockResolvedValue(12);
      prisma.accountingOutbox.count.mockResolvedValue(0);

      prisma.accountingAccount.findFirst.mockImplementation(
        async (args?: any) => {
          const code = args?.where?.code;
          const codeMatch = (target: string) =>
            code === target || (code?.in && code.in.includes(target));
          if (codeMatch('3.1.02.01')) {
            return {
              id: 'acc-3102',
              code: '3.1.02.01',
              name: 'Resultado del Ejercicio',
            };
          }
          if (codeMatch('3.1.02.02')) {
            return {
              id: 'acc-3103',
              code: '3.1.02.02',
              name: 'Resultados Acumulados',
            };
          }
          return null;
        },
      );

      // Saldo previo acumulado en 3.1.02.01 de años anteriores: $500.000 crédito (utilidad)
      prisma.accountingEntryItem.aggregate.mockResolvedValueOnce({
        _sum: { debit: 0, credit: 500000 },
      });

      prisma.accountingAccount.findMany.mockResolvedValue([
        {
          id: 'acc-4101',
          code: '4.1.01.01',
          name: 'Ventas',
          accountType: 'ingreso',
        },
        {
          id: 'acc-6101',
          code: '6.1.01.01',
          name: 'Costos y Gastos',
          accountType: 'gasto',
        },
      ]);

      // Resultado del año 2026: Ventas 600.000 - Gastos 400.000 = Utilidad 200.000
      prisma.accountingEntryItem.groupBy.mockResolvedValue([
        { accountId: 'acc-4101', _sum: { debit: 0, credit: 600000 } },
        { accountId: 'acc-6101', _sum: { debit: 400000, credit: 0 } },
      ]);

      const preview = await service.previewAnnualClosing(2026);

      expect(preview.canExecute).toBe(true);
      expect(preview.resultadoEjercicio).toBe(200000);
      expect(preview.priorEarningsTransferred).toBe(500000);
      expect(preview.retainedEarningsAccount?.code).toBe('3.1.02.02');

      // Líneas de transferencia entre 3.1.02.01 y 3.1.02.02
      const transferDebit3102 = preview.lines.find(
        (l) => l.accountCode === '3.1.02.01' && l.debit === 500000,
      );
      const transferCredit3103 = preview.lines.find(
        (l) => l.accountCode === '3.1.02.02' && l.credit === 500000,
      );
      expect(transferDebit3102).toBeDefined();
      expect(transferCredit3103).toBeDefined();

      // Línea final de resultado 2026 en 3.1.02.01
      const currentYearLine = preview.lines.find(
        (l) => l.accountCode === '3.1.02.01' && l.credit === 200000,
      );
      expect(currentYearLine).toBeDefined();

      // Debe cuadrar Debe = Haber exactamente
      const totalDebe = preview.lines.reduce((s, l) => s + l.debit, 0);
      const totalHaber = preview.lines.reduce((s, l) => s + l.credit, 0);
      expect(totalDebe).toBe(totalHaber);
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
