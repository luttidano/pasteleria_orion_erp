import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';

describe('PurchasesService', () => {
  let service: PurchasesService;
  let prisma: any;
  let outboxService: any;
  let outboxProcessor: any;

  beforeEach(async () => {
    prisma = {
      supplier: {
        findUnique: jest.fn(),
      },
      supplierInvoice: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      supplierPayment: {
        create: jest.fn(),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    outboxService = {
      enqueueSupplierPaymentInTx: jest.fn().mockResolvedValue({ id: 'outbox-pay-1' }),
    };

    outboxProcessor = {
      processEvent: jest.fn().mockResolvedValue({
        outboxId: 'outbox-pay-1',
        aggregateType: 'supplier_payment',
        aggregateId: 'pay-1',
        entryId: 'entry-123',
        entryNumber: 10,
        alreadyProcessed: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingOutboxService, useValue: outboxService },
        { provide: AccountingOutboxProcessorService, useValue: outboxProcessor },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
  });

  describe('createInvoice', () => {
    it('debe crear una factura de compra correctamente con status pending y paidAmount 0', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1', name: 'Distribuidora Molinera' });
      prisma.supplierInvoice.create.mockResolvedValue({
        id: 'inv-1',
        supplierId: 'sup-1',
        invoiceNumber: 'FAC-1001',
        issueDate: new Date('2026-11-01T00:00:00.000Z'),
        dueDate: new Date('2026-11-30T00:00:00.000Z'),
        totalAmount: 500000,
        paidAmount: 0,
        status: 'pending',
        hasInvoice: true,
        notes: 'Sacos de harina',
        createdById: 'usr-1',
        createdAt: new Date('2026-11-01T10:00:00.000Z'),
        updatedAt: new Date('2026-11-01T10:00:00.000Z'),
        supplier: { id: 'sup-1', name: 'Distribuidora Molinera' },
      });

      const result = await service.createInvoice({
        supplierId: 'sup-1',
        invoiceNumber: 'FAC-1001',
        issueDate: '2026-11-01',
        dueDate: '2026-11-30',
        totalAmount: 500000,
        hasInvoice: true,
        notes: 'Sacos de harina',
      }, 'usr-1');

      expect(result.id).toBe('inv-1');
      expect(result.remainingAmount).toBe(500000);
      expect(result.status).toBe('pending');
      expect(prisma.supplierInvoice.create).toHaveBeenCalled();
    });

    it('debe rechazar factura si el proveedor no existe con NotFoundException', async () => {
      prisma.supplier.findUnique.mockResolvedValue(null);

      await expect(
        service.createInvoice({
          supplierId: 'sup-inexistente',
          invoiceNumber: 'FAC-1',
          dueDate: '2026-11-30',
          totalAmount: 10000,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe rechazar si dueDate es menor a issueDate con BadRequestException', async () => {
      prisma.supplier.findUnique.mockResolvedValue({ id: 'sup-1', name: 'Colun' });

      await expect(
        service.createInvoice({
          supplierId: 'sup-1',
          invoiceNumber: 'FAC-2',
          issueDate: '2026-11-20',
          dueDate: '2026-11-10',
          totalAmount: 10000,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('recordPayment', () => {
    it('debe registrar un abono parcial y cambiar status a partial', async () => {
      prisma.supplierInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        supplierId: 'sup-1',
        invoiceNumber: 'FAC-1001',
        totalAmount: 500000,
        paidAmount: 0,
        status: 'pending',
        supplier: { id: 'sup-1', name: 'Molinera' },
      });

      prisma.supplierPayment.create.mockResolvedValue({
        id: 'pay-1',
        invoiceId: 'inv-1',
        paymentDate: new Date('2026-11-15T00:00:00.000Z'),
        amount: 200000,
        paymentMethod: 'transferencia',
        reference: 'TR-9988',
      });

      prisma.supplierInvoice.update.mockResolvedValue({
        id: 'inv-1',
        paidAmount: 200000,
        status: 'partial',
      });

      const res = await service.recordPayment('inv-1', {
        amount: 200000,
        paymentMethod: 'transferencia',
        reference: 'TR-9988',
      }, 'usr-admin');

      expect(res.success).toBe(true);
      expect(res.invoice.paidAmount).toBe(200000);
      expect(res.invoice.remainingAmount).toBe(300000);
      expect(res.invoice.status).toBe('partial');
      expect(outboxService.enqueueSupplierPaymentInTx).toHaveBeenCalled();
      expect(outboxProcessor.processEvent).toHaveBeenCalledWith('outbox-pay-1');
      expect(res.payment.accountingEntryId).toBe('entry-123');
    });

    it('debe rechazar si el pago supera el saldo pendiente con BadRequestException', async () => {
      prisma.supplierInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        supplierId: 'sup-1',
        invoiceNumber: 'FAC-1001',
        totalAmount: 500000,
        paidAmount: 400000, // Saldo restante es 100.000
        status: 'partial',
        supplier: { id: 'sup-1', name: 'Molinera' },
      });

      await expect(
        service.recordPayment('inv-1', {
          amount: 150000, // 150.000 > 100.000
          paymentMethod: 'efectivo',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe liquidar la factura completamente y cambiar status a paid', async () => {
      prisma.supplierInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        supplierId: 'sup-1',
        invoiceNumber: 'FAC-1001',
        totalAmount: 500000,
        paidAmount: 200000,
        status: 'partial',
        supplier: { id: 'sup-1', name: 'Molinera' },
      });

      prisma.supplierPayment.create.mockResolvedValue({
        id: 'pay-2',
        invoiceId: 'inv-1',
        paymentDate: new Date('2026-11-20T00:00:00.000Z'),
        amount: 300000,
        paymentMethod: 'transferencia',
      });

      prisma.supplierInvoice.update.mockResolvedValue({
        id: 'inv-1',
        paidAmount: 500000,
        status: 'paid',
      });

      const res = await service.recordPayment('inv-1', {
        amount: 300000,
        paymentMethod: 'transferencia',
      });

      expect(res.invoice.paidAmount).toBe(500000);
      expect(res.invoice.remainingAmount).toBe(0);
      expect(res.invoice.status).toBe('paid');
    });

    it('debe rechazar pago si la factura ya está pagada con ConflictException', async () => {
      prisma.supplierInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        status: 'paid',
        supplier: { id: 'sup-1', name: 'Molinera' },
      });

      await expect(
        service.recordPayment('inv-1', {
          amount: 50000,
          paymentMethod: 'efectivo',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('voidInvoice', () => {
    it('debe anular una factura sin pagos con éxito', async () => {
      prisma.supplierInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        paidAmount: 0,
      });
      prisma.supplierInvoice.update.mockResolvedValue({
        id: 'inv-1',
        status: 'voided',
      });

      const res = await service.voidInvoice('inv-1', 'usr-admin');
      expect(res.status).toBe('voided');
    });

    it('debe rechazar anulación si la factura tiene abonos con ConflictException', async () => {
      prisma.supplierInvoice.findUnique.mockResolvedValue({
        id: 'inv-1',
        paidAmount: 50000,
      });

      await expect(service.voidInvoice('inv-1')).rejects.toThrow(ConflictException);
    });
  });
});
