import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PosService } from './pos.service';
import { PrismaService } from '../../database/prisma.service';
import { EntryService } from '../accounting/entry.service';
import { CreateSaleDto } from './dto/create-sale.dto';

describe('PosService', () => {
  let service: PosService;
  let prisma: any;
  let entryService: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    entryService = {
      registerSaleIncome: jest.fn().mockResolvedValue({ success: true }),
      registerShiftDifferenceAdjustment: jest
        .fn()
        .mockResolvedValue({ entryId: 'adj-entry-1', entryNumber: 42 }),
    };

    prisma.posShift = {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosService,
        { provide: PrismaService, useValue: prisma },
        { provide: EntryService, useValue: entryService },
      ],
    }).compile();

    service = module.get<PosService>(PosService);
  });

  describe('createSale', () => {
    it('debe descontar únicamente el stock del producto vendido y NO los ingredientes en bodega (se deducen en producción)', async () => {
      const manufacturedProductId = '11111111-1111-4111-a111-111111111111';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'debito',
        subtotal: 1000,
        taxAmount: 190,
        total: 1190,
        items: [
          {
            productId: manufacturedProductId,
            productName: 'Torta Selva Negra',
            quantity: 2,
            unitPrice: 595,
          },
        ],
      };

      const mockProduct = {
        id: manufacturedProductId,
        name: 'Torta Selva Negra',
        productType: 'manufactured',
        stock: 10,
      };

      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue({}),
        },
        ingredient: {
          update: jest.fn().mockResolvedValue({}),
        },
        posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'sale-uuid-1',
            ticketNumber: 'TK-123456',
            paymentMethod: 'debito',
            subtotal: 1000,
            taxAmount: 190,
            total: 1190,
            status: 'completada',
            accountingStatus: 'posted',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-03T20:00:00Z'),
            items: [
              {
                id: 'item-uuid-1',
                saleId: 'sale-uuid-1',
                productId: manufacturedProductId,
                productName: 'Torta Selva Negra',
                quantity: 2,
                unitPrice: 595,
                lineTotal: 1190,
              },
            ],
            createdBy: {
              id: 'cashier-1',
              name: 'Cajero Central',
              role: 'cashier',
            },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await service.createSale(saleDto, 'cashier-1');

      // 1. Debe verificar y descontar stock del producto comercial (2 unidades)
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: manufacturedProductId },
        data: {
          stock: {
            decrement: 2,
          },
        },
      });

      // 2. NO debe descontar insumos de la bodega (la deducción ocurre al producir en cocina)
      expect(mockTx.ingredient.update).not.toHaveBeenCalled();

      // 3. Debe asociar el UUID real del producto en pos_sale_item
      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            items: {
              create: [
                expect.objectContaining({
                  productId: manufacturedProductId,
                  productName: 'Torta Selva Negra',
                  quantity: 2,
                }),
              ],
            },
          }),
        }),
      );

      // 4. Debe registrar asiento contable de ingreso
      expect(entryService.registerSaleIncome).toHaveBeenCalledWith({
        id: 'sale-uuid-1',
        ticketNumber: 'TK-123456',
        soldAt: '2026-11-03T20:00:00.000Z',
        total: 1190,
        paymentMethod: 'debito',
      });

      expect(result.id).toBe('sale-uuid-1');
      expect(result.items[0].product_id).toBe(manufacturedProductId);
    });

    it('debe descontar sólo stock de producto para productos de reventa sin tocar ingredientes', async () => {
      const resaleProductId = '33333333-3333-4333-a333-333333333333';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'efectivo',
        subtotal: 2000,
        taxAmount: 380,
        total: 2380,
        items: [
          {
            productId: resaleProductId,
            productName: 'Bebida Coca Cola',
            quantity: 1,
            unitPrice: 2380,
          },
        ],
      };

      const mockProduct = {
        id: resaleProductId,
        name: 'Bebida Coca Cola',
        productType: 'resale',
        stock: 20,
        recipe: null,
      };

      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn().mockResolvedValue({}),
        },
        ingredient: {
          update: jest.fn().mockResolvedValue({}),
        },
        posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'sale-uuid-2',
            ticketNumber: 'TK-654321',
            paymentMethod: 'efectivo',
            subtotal: 2000,
            taxAmount: 380,
            total: 2380,
            status: 'completada',
            accountingStatus: 'posted',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-03T20:00:00Z'),
            items: [
              {
                id: 'item-uuid-2',
                saleId: 'sale-uuid-2',
                productId: resaleProductId,
                productName: 'Bebida Coca Cola',
                quantity: 1,
                unitPrice: 2380,
                lineTotal: 2380,
              },
            ],
            createdBy: null,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await service.createSale(saleDto);

      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: resaleProductId },
        data: {
          stock: {
            decrement: 1,
          },
        },
      });

      // No debe descontar ingredientes
      expect(mockTx.ingredient.update).not.toHaveBeenCalled();
      expect(result.items[0].product_id).toBe(resaleProductId);
    });

    it('debe rechazar la venta si el stock disponible en catálogo es insuficiente', async () => {
      const productId = '44444444-4444-4444-a444-444444444444';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'debito',
        subtotal: 1000,
        taxAmount: 190,
        total: 1190,
        items: [
          {
            productId,
            productName: 'Brazo de Reina',
            quantity: 5,
            unitPrice: 238,
          },
        ],
      };

      const mockProduct = {
        id: productId,
        name: 'Brazo de Reina',
        productType: 'resale',
        stock: 2, // Solo hay 2, se piden 5
      };

      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue(mockProduct),
          update: jest.fn(),
        },
        ingredient: { update: jest.fn() },
        posSale: {
        count: jest.fn(),
        updateMany: jest.fn(), create: jest.fn() },
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      await expect(service.createSale(saleDto)).rejects.toThrow(BadRequestException);
      await expect(service.createSale(saleDto)).rejects.toThrow(
        /Stock insuficiente para "Brazo de Reina"/,
      );
    });
    it('debe descontar stock de empaque secundario cuando se incluye en la venta (packagingId)', async () => {
      const packagingId = '55555555-5555-4555-a555-555555555555';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'efectivo',
        subtotal: 500,
        taxAmount: 95,
        total: 595,
        items: [
          {
            packagingId,
            productName: 'Bolsa Kraft Grande',
            quantity: 1,
            unitPrice: 595,
          },
        ],
      };

      const mockPackaging = {
        id: packagingId,
        name: 'Bolsa Kraft Grande',
        stock: 50,
      };

      const mockTx = {
        product: { findUnique: jest.fn(), update: jest.fn() },
        packaging: {
          findUnique: jest.fn().mockResolvedValue(mockPackaging),
          update: jest.fn().mockResolvedValue({}),
        },
        ingredient: { update: jest.fn() },
        posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'sale-uuid-pkg',
            ticketNumber: 'TK-999999',
            paymentMethod: 'efectivo',
            subtotal: 500,
            taxAmount: 95,
            total: 595,
            status: 'completada',
            accountingStatus: 'posted',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-03T20:00:00Z'),
            items: [
              {
                id: 'item-uuid-pkg',
                saleId: 'sale-uuid-pkg',
                productId: null,
                productName: 'Bolsa Kraft Grande',
                quantity: 1,
                unitPrice: 595,
                lineTotal: 595,
              },
            ],
            createdBy: null,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockTx);
      });

      const result = await service.createSale(saleDto);

      expect(mockTx.packaging.update).toHaveBeenCalledWith({
        where: { id: packagingId },
        data: {
          stock: {
            decrement: 1,
          },
        },
      });
      expect(mockTx.product.update).not.toHaveBeenCalled();
      expect(mockTx.ingredient.update).not.toHaveBeenCalled();
      expect(result.items[0].product_id).toBeNull();
    });
  });

  describe('getSalesSummary', () => {
    it('debe sumar por separado efectivo en gaveta y tarjetas POS', async () => {
      prisma.posSale.groupBy.mockResolvedValue([
        { paymentMethod: 'efectivo', _sum: { total: 12500 }, _count: { _all: 2 } },
        { paymentMethod: 'debito', _sum: { total: 8000 }, _count: { _all: 1 } },
        { paymentMethod: 'credito', _sum: { total: 4500 }, _count: { _all: 1 } },
      ]);

      const summary = await service.getSalesSummary(
        '2026-11-11T03:00:00.000Z',
        '2026-11-12T02:59:59.999Z',
      );

      expect(summary.cashSalesTotal).toBe(12500);
      expect(summary.cardPosTotal).toBe(12500);
      expect(summary.debitTotal).toBe(8000);
      expect(summary.creditTotal).toBe(4500);
      expect(summary.totalSales).toBe(25000);
      expect(summary.transactionsCount).toBe(4);
      expect(prisma.posSale.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          by: ['paymentMethod'],
          where: expect.objectContaining({
            status: 'completada',
          }),
        }),
      );
    });
  });

  describe('POS Shifts & Arqueo de Caja', () => {
    it('debe asignar shiftId del turno abierto al crear una venta', async () => {
      const productId = '66666666-6666-4666-a666-666666666666';
      const saleDto: CreateSaleDto = {
        paymentMethod: 'efectivo',
        subtotal: 1000,
        taxAmount: 190,
        total: 1190,
        items: [
          {
            productId,
            productName: 'Kuchen de Frambuesa',
            quantity: 1,
            unitPrice: 1190,
          },
        ],
      };

      const mockTx = {
        product: {
          findUnique: jest.fn().mockResolvedValue({
            id: productId,
            name: 'Kuchen de Frambuesa',
            stock: 5,
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        posShift: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'prev-closed-shift' }),
          create: jest.fn().mockResolvedValue({
            id: 'shift-open-2',
            shiftNumber: 2n,
            status: 'abierto',
          }),
        },
        posSale: {
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'sale-shift-2',
            ticketNumber: 'TK-SHIFT-2',
            paymentMethod: 'efectivo',
            subtotal: 1000,
            taxAmount: 190,
            total: 1190,
            status: 'completada',
            accountingStatus: 'posted',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-11T18:00:00Z'),
            items: [],
            createdBy: { id: 'u1', name: 'Cajero', role: 'cashier' },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.createSale(saleDto, 'u1');

      expect(mockTx.posShift.create).toHaveBeenCalled();
      expect(mockTx.posSale.updateMany).not.toHaveBeenCalled();
      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shiftId: 'shift-open-2',
          }),
        }),
      );
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
      expect(overview.cashSalesTotal).toBe(0);
      expect(overview.cardPosTotal).toBe(0);
      expect(overview.openingCash).toBe(0);
      expect(overview.expectedCash).toBe(0);
      expect(overview.transactionsCount).toBe(0);
      expect(overview.lastClosedShift?.shiftNumber).toBe(1);
    });

    it('debe cerrar el turno con faltante y generar ajuste contable automático', async () => {
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
        posShift: {
          findFirst: jest.fn().mockResolvedValue(openShift),
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
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
      prisma.posShift.update.mockResolvedValue({
        ...closedRecord,
        accountingStatus: 'posted',
        closingEntryId: 'adj-entry-1',
      });

      const result = await service.closeShift(
        {
          countedCash: 19500,
          notes: 'Faltó una moneda de $500',
          localDate: '2026-11-11',
        },
        'u1',
      );

      expect(result.expectedCash).toBe(20000);
      expect(result.countedCash).toBe(19500);
      expect(result.cashDifference).toBe(-500);
      expect(result.accountingStatus).toBe('posted');
      expect(result.closingEntryNumber).toBe(42);
      expect(
        entryService.registerShiftDifferenceAdjustment,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          shiftId: 'shift-open-3',
          shiftNumber: 3,
          cashDifference: -500,
          entryDate: '2026-11-11',
        }),
      );
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
        posShift: {
          findFirst: jest.fn().mockResolvedValue(openShift),
          update: jest.fn().mockResolvedValue(closedRecord),
        },
        posSale: {
        count: jest.fn(),
        updateMany: jest.fn(),
          groupBy: jest.fn().mockResolvedValue([
            { paymentMethod: 'efectivo', _sum: { total: 5000 }, _count: { _all: 1 } },
          ]),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
      entryService.registerShiftDifferenceAdjustment.mockRejectedValueOnce(
        new Error('El período contable Noviembre 2026 está cerrado.'),
      );
      prisma.posShift.update.mockResolvedValue(closedRecord);

      const result = await service.closeShift({ countedCash: 10500 }, 'u1');

      expect(result.status).toBe('cerrado');
      expect(result.accountingStatus).toBe('pending');
      expect(result.accountingWarning).toMatch(/pendiente/i);
    });

    it('debe usar la fecha de Chile (America/Santiago) en el servidor cuando no se envía localDate ni from/to', async () => {
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
        posShift: {
          findFirst: jest.fn().mockResolvedValue(openShift),
          update: jest.fn().mockResolvedValue(closedRecord),
        },
        posSale: {
          groupBy: jest.fn().mockResolvedValue([
            { paymentMethod: 'efectivo', _sum: { total: 5000 }, _count: { _all: 1 } },
          ]),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
      prisma.posShift.update.mockResolvedValue({
        ...closedRecord,
        accountingStatus: 'posted',
        closingEntryId: 'adj-entry-1',
      });

      await service.closeShift({ countedCash: 5200 }, 'u1');

      expect(entryService.registerShiftDifferenceAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          entryDate: '2026-11-11',
        }),
      );

      prisma.posShift.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      prisma.posSale.groupBy.mockResolvedValueOnce([]);

      const overview = await service.getActiveShiftOverview();
      expect(overview.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });
});
