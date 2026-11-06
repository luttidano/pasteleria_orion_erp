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
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

    entryService = {
      registerSaleIncome: jest.fn().mockResolvedValue({ success: true }),
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
        posSale: { create: jest.fn() },
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
});
