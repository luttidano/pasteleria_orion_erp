import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AccountingPeriodService } from './accounting-period.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountingEntryOrigin, AccountingPeriodStatus } from '../../common/enums';

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
      },
      accountingAccount: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      posSale: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      accountingSettings: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountingPeriodService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<AccountingPeriodService>(AccountingPeriodService);
  });

  describe('extractYearMonth', () => {
    it('debe extraer año y mes sin desplazamiento por zona horaria en YYYY-MM-DD', () => {
      expect(service.extractYearMonth('2026-01-01')).toEqual({ year: 2026, month: 1 });
      expect(service.extractYearMonth('2026-12-31')).toEqual({ year: 2026, month: 12 });
    });

    it('debe rechazar fechas inválidas', () => {
      expect(() => service.extractYearMonth('2026-02-30')).toThrow(BadRequestException);
    });
  });

  describe('assertPeriodOpen', () => {
    it('debe bloquear con ConflictException si el mes está cerrado', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.accountingPeriod.findUnique.mockResolvedValue({
        id: 'per-1',
        year: 2026,
        month: 1,
        status: AccountingPeriodStatus.cerrado,
      });

      await expect(service.assertPeriodOpen('2026-01-15')).rejects.toThrow(ConflictException);
    });

    it('debe bloquear con ConflictException si el año ya tiene Cierre Anual activo', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue({
        id: 'closing-1',
        entryNumber: BigInt(99),
      });

      await expect(service.assertPeriodOpen('2026-05-10')).rejects.toThrow(ConflictException);
    });

    it('debe permitir e inicializar en abierto un mes sin registro previo', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.accountingPeriod.upsert.mockResolvedValue({
        id: 'per-2',
        year: 2026,
        month: 3,
        status: AccountingPeriodStatus.abierto,
      });

      const res = await service.assertPeriodOpen('2026-03-01');
      expect(res).toEqual({ year: 2026, month: 3 });
      expect(prisma.accountingPeriod.upsert).toHaveBeenCalledTimes(1);
    });

    it('debe bloquear con ConflictException si la fecha es anterior al inicio contable configurado', async () => {
      prisma.accountingSettings.findUnique.mockResolvedValue({
        accountingStartDate: new Date('2026-05-01T00:00:00.000Z'),
      });

      await expect(service.assertPeriodOpen('2026-04-30')).rejects.toThrow(ConflictException);
      expect(prisma.accountingPeriod.upsert).not.toHaveBeenCalled();
    });

    it('debe permitir el mismo día configurado como inicio contable', async () => {
      prisma.accountingSettings.findUnique.mockResolvedValue({
        accountingStartDate: new Date('2026-05-01T00:00:00.000Z'),
      });
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.accountingPeriod.upsert.mockResolvedValue({
        id: 'per-5',
        year: 2026,
        month: 5,
        status: AccountingPeriodStatus.abierto,
      });

      const res = await service.assertPeriodOpen('2026-05-01');
      expect(res).toEqual({ year: 2026, month: 5 });
    });
  });

  describe('updateAccountingSettings', () => {
    it('debe rechazar fijar una fecha de inicio posterior a asientos activos existentes', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue({
        entryNumber: BigInt(12),
        entryDate: new Date('2026-03-10T00:00:00.000Z'),
      });

      await expect(
        service.updateAccountingSettings({ accountingStartDate: '2026-05-01' }, 'admin-1'),
      ).rejects.toThrow(ConflictException);
      expect(prisma.accountingSettings.upsert).not.toHaveBeenCalled();
    });

    it('debe guardar la fecha de inicio contable cuando no existen asientos previos incompatibles', async () => {
      prisma.accountingEntry.findFirst.mockResolvedValue(null);
      prisma.posSale.findFirst.mockResolvedValue(null);
      prisma.accountingSettings.upsert.mockResolvedValue({
        id: 'default',
        accountingStartDate: new Date('2026-05-01T00:00:00.000Z'),
        updatedAt: new Date('2026-11-11T16:00:00.000Z'),
        updatedBy: { id: 'admin-1', name: 'Admin Orión' },
      });

      const res = await service.updateAccountingSettings(
        { accountingStartDate: '2026-05-01' },
        'admin-1',
      );
      expect(res.accountingStartDate).toBe('2026-05-01');
      expect(res.updatedBy?.name).toBe('Admin Orión');
    });
  });

  describe('closePeriod y reopenPeriod', () => {
    it('debe impedir cerrar un mes si existen ventas POS pendientes de contabilizar', async () => {
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.posSale.count.mockResolvedValue(2);

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
  });

  describe('previewAnnualClosing y executeAnnualClosing', () => {
    it('debe generar la refundición cuadrando Debe = Haber contra Resultado del Ejercicio (utilidad)', async () => {
      prisma.accountingEntry.findFirst
        .mockResolvedValueOnce(null) // existingClosing
        .mockResolvedValueOnce(null); // laterYearClosing
      prisma.accountingPeriod.count.mockResolvedValue(12);
      prisma.posSale.count.mockResolvedValue(0);

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
      prisma.posSale.count.mockResolvedValue(0);
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
        concept: 'Asiento de Cierre Anual (Refundición de Cuentas) - Ejercicio 2026',
        origin: AccountingEntryOrigin.closing,
        items: [{}, {}, {}],
      });
      prisma.accountingPeriod.findUnique.mockResolvedValue(null);
      prisma.accountingPeriod.create.mockResolvedValue({});

      const result = await service.executeAnnualClosing({ year: 2026 }, 'admin-1');

      expect(result.success).toBe(true);
      expect(result.closingDate).toBe('2026-12-31');
      expect(result.resultadoEjercicio).toBe(-100000); // pérdida neta
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
});

