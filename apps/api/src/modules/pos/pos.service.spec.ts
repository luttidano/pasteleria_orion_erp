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
    it('debe descontar stock de producto y de ingredientes de receta para productos de elaboración propia', async () => {
      const manufacturedProductId = '11111111-1111-4111-a111-111111111111';
      const ingredientId = '22222222-2222-4222-a222-222222222222';

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
        recipe: {
          id: 'rec-1',
          name: 'Receta Selva Negra',
          yieldServings: 1, // 1 porción por tanda
          ingredients: [
            {
              id: 'ri-1',
              ingredientId,
              quantity: 250, // 250 gramos por porción
              unit: 'g',
              ingredients: {
                id: ingredientId,
                name: 'Harina de Trigo',
                stock: 5, // 5 kg disponibles
                unit: 'kg',
              },
            },
          ],
        },
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

      // 2. Debe descontar los insumos proporcionales de la receta (2 * 250g = 500g = 0.5kg -> stock: 5 - 0.5 = 4.5kg)
      expect(mockTx.ingredient.update).toHaveBeenCalledWith({
        where: { id: ingredientId },
        data: {
          stock: 4.5,
        },
      });

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
  });
});

