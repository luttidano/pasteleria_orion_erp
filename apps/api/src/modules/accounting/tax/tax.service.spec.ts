import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculatorService } from './tax-calculator.service';
import { TaxService } from './tax.service';
import { PrismaService } from '../../../database/prisma.service';

describe('TaxService', () => {
  let service: TaxService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      posSale: {
        findMany: jest.fn(),
      },
      supplierInvoice: {
        findMany: jest.fn(),
      },
      accountingEntry: {
        findMany: jest.fn(),
      },
      accountingEntryItem: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculatorService,
        TaxService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
  });

  describe('getSalesBook', () => {
    it('debe calcular correctamente las ventas netas y el IVA Débito (19%) del mes', async () => {
      // 2 ventas de $11.900 cada una (Neto: $10.000, IVA: $1.900)
      prisma.posSale.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          ticketNumber: 'TK-001',
          soldAt: new Date('2026-11-05T14:00:00.000Z'),
          total: 11900,
          paymentMethod: 'efectivo',
        },
        {
          id: 'sale-2',
          ticketNumber: 'TK-002',
          soldAt: new Date('2026-11-10T18:30:00.000Z'),
          total: 11900,
          paymentMethod: 'debito',
        },
      ]);

      const res = await service.getSalesBook({ year: 2026, month: 11 });

      expect(res.period.label).toBe('Noviembre 2026');
      expect(res.totals.documentCount).toBe(2);
      expect(res.totals.totalAmount).toBe(23800);
      expect(res.totals.netAmount).toBe(20000);
      expect(res.totals.vatAmount).toBe(3800);
      expect(res.entries.length).toBe(2);
      expect(res.entries[0].documentNumber).toBe('TK-001');
    });
  });

  describe('getPurchasesBook', () => {
    it('debe desglosar facturas de proveedores con IVA Crédito', async () => {
      // 1 factura de proveedor de $119.000 (Neto: $100.000, IVA Crédito: $19.000)
      prisma.supplierInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FAC-991',
          issueDate: new Date('2026-11-04T00:00:00.000Z'),
          totalAmount: 119000,
          supplier: {
            id: 'sup-1',
            name: 'Molino Central',
            rut: '76.123.456-7',
          },
        },
      ]);
      prisma.accountingEntry.findMany.mockResolvedValue([]);

      const res = await service.getPurchasesBook({ year: 2026, month: 11 });

      expect(res.totals.documentCount).toBe(1);
      expect(res.totals.totalAmount).toBe(119000);
      expect(res.totals.netAmount).toBe(100000);
      expect(res.totals.vatAmount).toBe(19000);
      expect(res.entries[0].supplierName).toBe('Molino Central');
      expect(res.entries[0].supplierRut).toBe('76.123.456-7');
      expect(res.entries[0].source).toBe('supplier_invoice');
    });
  });

  describe('getVatSummary (F29 y Balance IVA)', () => {
    it('debe determinar IVA a pagar cuando Débito > Crédito + Remanente', async () => {
      // Ventas: $119.000 (IVA Débito: $19.000, Neto: $100.000)
      prisma.posSale.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          ticketNumber: 'TK-100',
          soldAt: new Date('2026-11-15T12:00:00.000Z'),
          total: 119000,
          paymentMethod: 'transferencia',
        },
      ]);

      // Compras: $59.500 (IVA Crédito: $9.500, Neto: $50.000)
      prisma.supplierInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FAC-1',
          issueDate: new Date('2026-11-02T00:00:00.000Z'),
          totalAmount: 59500,
          supplier: { id: 'sup-1', name: 'Distribuidora', rut: '77.888.999-K' },
        },
      ]);
      prisma.accountingEntry.findMany.mockResolvedValue([]);

      // Mock Libro Mayor
      prisma.accountingEntryItem.findMany
        .mockResolvedValueOnce([{ debit: 0, credit: 19000 }]) // 2102 Débito
        .mockResolvedValueOnce([{ debit: 9500, credit: 0 }]); // 1108 Crédito

      const res = await service.getVatSummary({
        year: 2026,
        month: 11,
        previousRemanent: 2000,
        ppmRate: 0.25,
      });

      // IVA Débito ($19.000) - IVA Crédito ($9.500) = $9.500 bruto
      expect(res.f29.grossVatPayable).toBe(9500);

      // Con remanente de $2.000: $9.500 - $2.000 = $7.500 a pagar
      expect(res.f29.netVatPayable).toBe(7500);
      expect(res.f29.newRemanent).toBe(0);

      // PPM = 0.25% de $100.000 (ventas netas) = $250
      expect(res.f29.ppmAmount).toBe(250);

      // Total a pagar F29 = $7.500 + $250 = $7.750
      expect(res.f29.totalTaxToPay).toBe(7750);
      expect(res.accountingReconciliation.isReconciled).toBe(true);
    });

    it('debe generar nuevo Remanente a favor cuando Crédito + Remanente > Débito', async () => {
      // Ventas: $23.800 (IVA Débito: $3.800, Neto: $20.000)
      prisma.posSale.findMany.mockResolvedValue([
        {
          id: 'sale-1',
          ticketNumber: 'TK-200',
          soldAt: new Date('2026-11-20T12:00:00.000Z'),
          total: 23800,
          paymentMethod: 'efectivo',
        },
      ]);

      // Compras: $119.000 (IVA Crédito: $19.000, Neto: $100.000)
      prisma.supplierInvoice.findMany.mockResolvedValue([
        {
          id: 'inv-1',
          invoiceNumber: 'FAC-20',
          issueDate: new Date('2026-11-03T00:00:00.000Z'),
          totalAmount: 119000,
          supplier: { id: 'sup-1', name: 'Distribuidora', rut: '77.888.999-K' },
        },
      ]);
      prisma.accountingEntry.findMany.mockResolvedValue([]);

      prisma.accountingEntryItem.findMany
        .mockResolvedValueOnce([{ debit: 0, credit: 3800 }]) // 2102
        .mockResolvedValueOnce([{ debit: 19000, credit: 0 }]); // 1108

      const res = await service.getVatSummary({
        year: 2026,
        month: 11,
        previousRemanent: 0,
        ppmRate: 0.25,
      });

      // Débito ($3.800) - Crédito ($19.000) = -$15.200
      expect(res.f29.netVatPayable).toBe(0);
      expect(res.f29.newRemanent).toBe(15200);

      // PPM de 0.25% sobre $20.000 = $50
      expect(res.f29.ppmAmount).toBe(50);

      // El total a pagar en F29 es solo el PPM ($50)
      expect(res.f29.totalTaxToPay).toBe(50);
      expect(res.accountingReconciliation.isReconciled).toBe(true);
    });
  });
});
