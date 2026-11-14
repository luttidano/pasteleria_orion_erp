import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PosSaleService } from './pos-sale.service';
import { PosShiftService } from './pos-shift.service';
import { PosAccountingStatusService } from './pos-accounting-status.service';
import { PrismaService } from '../../database/prisma.service';
import { AccountingOutboxService } from '../accounting/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/accounting-outbox-processor.service';
import { InventoryStockService } from '../inventory/inventory-stock.service';
import { CreateSaleDto } from './dto/create-sale.dto';

describe('PosSaleService', () => {
  let service: PosSaleService;
  let prisma: any;
  let outboxProcessor: any;

  beforeEach(async () => {
    prisma = {
      $transaction: jest.fn(),
      posSale: {
        count: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      posShift: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-sale-1' }),
      },
    };

    outboxProcessor = {
      processEvent: jest.fn().mockResolvedValue({
        outboxId: 'outbox-sale-1',
        aggregateType: 'pos_sale',
        aggregateId: 'sale-uuid-1',
        entryId: 'entry-sale-1',
        entryNumber: 1,
        alreadyProcessed: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PosSaleService,
        PosShiftService,
        PosAccountingStatusService,
        AccountingOutboxService,
        InventoryStockService,
        { provide: PrismaService, useValue: prisma },
        { provide: AccountingOutboxProcessorService, useValue: outboxProcessor },
      ],
    }).compile();

    service = module.get<PosSaleService>(PosSaleService);
  });

  describe('createSale', () => {
    it('debe descontar únicamente el stock del producto vendido vía InventoryStockService y NO los ingredientes en bodega', async () => {
      const manufacturedProductId = '11111111-1111-4111-a111-111111111111';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'debito',
        items: [
          {
            productId: manufacturedProductId,
            quantity: 2,
          },
        ],
      };

      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: manufacturedProductId,
              name: 'Torta Selva Negra',
              stock: 10,
              salePrice: 595,
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        packaging: {
          findMany: jest.fn().mockResolvedValue([]),
          updateMany: jest.fn(),
        },
        ingredient: {
          update: jest.fn(),
        },
        posShift: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'shift-active-1',
            shiftNumber: 1n,
            status: 'abierto',
          }),
          findUnique: jest.fn(),
        },
        accountingOutbox: {
          upsert: jest.fn().mockResolvedValue({ id: 'outbox-sale-1' }),
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
            accountingStatus: 'pending',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-03T20:00:00Z'),
            items: [
              {
                id: 'item-uuid-1',
                saleId: 'sale-uuid-1',
                productId: manufacturedProductId,
                packagingId: null,
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

      prisma.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      const result = await service.createSale(saleDto, 'cashier-1');

      expect(mockTx.product.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: manufacturedProductId, stock: { gte: 2 } },
          data: expect.objectContaining({ stock: { decrement: 2 } }),
        }),
      );
      expect(mockTx.ingredient.update).not.toHaveBeenCalled();

      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 1000,
            taxAmount: 190,
            total: 1190,
            accountingStatus: 'pending',
            items: {
              create: [
                expect.objectContaining({
                  productId: manufacturedProductId,
                  packagingId: null,
                  productName: 'Torta Selva Negra',
                  quantity: 2,
                  unitPrice: 595,
                  lineTotal: 1190,
                }),
              ],
            },
          }),
        }),
      );

      expect(mockTx.accountingOutbox.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            aggregateType: 'pos_sale',
            aggregateId: 'sale-uuid-1',
            referenceCode: 'TK-123456',
            payload: expect.objectContaining({
              ticketNumber: 'TK-123456',
              soldAt: '2026-11-03T20:00:00.000Z',
              total: 1190,
              paymentMethod: 'debito',
            }),
          }),
        }),
      );
      expect(outboxProcessor.processEvent).toHaveBeenCalledWith('outbox-sale-1');
      expect(prisma.posSale.updateMany).toHaveBeenCalledWith({
        where: { id: 'sale-uuid-1', accountingStatus: { not: 'posted' } },
        data: { accountingStatus: 'posted', accountingError: null },
      });

      expect(result.id).toBe('sale-uuid-1');
      expect(result.items[0].productId).toBe(manufacturedProductId);
    });

    it('debe ignorar precios manipulados por el cliente y calcular totales autoritativos desde la base de datos', async () => {
      const productId = '22222222-2222-4222-a222-222222222222';
      const tamperedDto: CreateSaleDto = {
        paymentMethod: 'efectivo',
        subtotal: 1,
        taxAmount: 0,
        total: 1,
        items: [
          {
            productId,
            productName: 'Nombre Manipulado',
            quantity: 2,
            unitPrice: 1,
          },
        ],
      };

      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: productId,
              name: 'Torta Tres Leches',
              stock: 8,
              salePrice: 11900,
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        posShift: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'shift-1',
            shiftNumber: 1n,
            status: 'abierto',
          }),
        },
        accountingOutbox: {
          upsert: jest.fn().mockResolvedValue({ id: 'outbox-sale-auth' }),
        },
        posSale: {
          create: jest.fn().mockResolvedValue({
            id: 'sale-auth-price',
            ticketNumber: 'TK-AUTH',
            paymentMethod: 'efectivo',
            subtotal: 20000,
            taxAmount: 3800,
            total: 23800,
            status: 'completada',
            accountingStatus: 'pending',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-11T15:00:00Z'),
            items: [
              {
                id: 'item-auth',
                saleId: 'sale-auth-price',
                productId,
                packagingId: null,
                productName: 'Torta Tres Leches',
                quantity: 2,
                unitPrice: 11900,
                lineTotal: 23800,
              },
            ],
            createdBy: null,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.createSale(tamperedDto);

      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subtotal: 20000,
            taxAmount: 3800,
            total: 23800,
            items: {
              create: [
                expect.objectContaining({
                  productName: 'Torta Tres Leches',
                  unitPrice: 11900,
                  lineTotal: 23800,
                }),
              ],
            },
          }),
        }),
      );
      expect(mockTx.accountingOutbox.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            payload: expect.objectContaining({ total: 23800 }),
          }),
        }),
      );
      expect(outboxProcessor.processEvent).toHaveBeenCalledWith('outbox-sale-auth');
    });

    it('debe rechazar con ConflictException si el stock disponible en catálogo es insuficiente', async () => {
      const productId = '44444444-4444-4444-a444-444444444444';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'debito',
        items: [
          {
            productId,
            quantity: 5,
          },
        ],
      };

      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: productId,
              name: 'Brazo de Reina',
              stock: 2,
              salePrice: 238,
            },
          ]),
          updateMany: jest.fn(),
        },
        posSale: { create: jest.fn() },
      };

      prisma.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      await expect(service.createSale(saleDto)).rejects.toThrow(
        ConflictException,
      );
      await expect(service.createSale(saleDto)).rejects.toThrow(
        /Stock insuficiente para "Brazo de Reina"/,
      );
    });

    it('debe descontar stock de empaque secundario y cobrar $100 por Ley de Bolsas cuando se incluye packagingId', async () => {
      const packagingId = '55555555-5555-4555-a555-555555555555';

      const saleDto: CreateSaleDto = {
        paymentMethod: 'efectivo',
        items: [
          {
            packagingId,
            quantity: 1,
          },
        ],
      };

      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        product: { findMany: jest.fn(), updateMany: jest.fn() },
        packaging: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: packagingId,
              name: 'Bolsa Kraft Grande',
              packageType: 'secundario',
              stock: 50,
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        ingredient: { update: jest.fn() },
        posShift: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'shift-1',
            shiftNumber: 1n,
            status: 'abierto',
          }),
        },
        accountingOutbox: {
          upsert: jest.fn().mockResolvedValue({ id: 'outbox-sale-auth' }),
        },
        posSale: {
          create: jest.fn().mockResolvedValue({
            id: 'sale-uuid-pkg',
            ticketNumber: 'TK-999999',
            paymentMethod: 'efectivo',
            subtotal: 84.03,
            taxAmount: 15.97,
            total: 100,
            status: 'completada',
            accountingStatus: 'pending',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-03T20:00:00Z'),
            items: [
              {
                id: 'item-uuid-pkg',
                saleId: 'sale-uuid-pkg',
                productId: null,
                packagingId,
                productName: 'Bolsa Kraft Grande',
                quantity: 1,
                unitPrice: 100,
                lineTotal: 100,
              },
            ],
            createdBy: null,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (callback: any) =>
        callback(mockTx),
      );

      const result = await service.createSale(saleDto);

      expect(mockTx.packaging.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: packagingId, stock: { gte: 1 } },
          data: expect.objectContaining({ stock: { decrement: 1 } }),
        }),
      );
      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            total: 100,
            items: {
              create: [
                expect.objectContaining({
                  productId: null,
                  packagingId,
                  unitPrice: 100,
                  lineTotal: 100,
                }),
              ],
            },
          }),
        }),
      );
      expect(result.items[0].productId).toBeNull();
      expect(result.items[0].packagingId).toBe(packagingId);
    });

    it('debe asignar shiftId al crear turno vía INSERT ... ON CONFLICT DO NOTHING RETURNING id', async () => {
      const productId = '66666666-6666-4666-a666-666666666666';
      const saleDto: CreateSaleDto = {
        paymentMethod: 'efectivo',
        items: [{ productId, quantity: 1 }],
      };

      const mockTx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([]) // product FOR UPDATE
          .mockResolvedValueOnce([{ id: 'shift-open-2' }]), // INSERT INTO pos_shift RETURNING id
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: productId,
              name: 'Kuchen de Frambuesa',
              stock: 5,
              salePrice: 1190,
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        posShift: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'prev-closed-shift' }),
          findUnique: jest.fn().mockResolvedValue({
            id: 'shift-open-2',
            shiftNumber: 2n,
            status: 'abierto',
          }),
        },
        accountingOutbox: {
          upsert: jest.fn().mockResolvedValue({ id: 'outbox-sale-shift-2' }),
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
            accountingStatus: 'pending',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-11T18:00:00Z'),
            items: [],
            createdBy: { id: 'u1', name: 'Cajero', role: 'cashier' },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.createSale(saleDto, 'u1');

      expect(mockTx.posSale.updateMany).not.toHaveBeenCalled();
      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shiftId: 'shift-open-2',
          }),
        }),
      );
    });

    it('debe recuperar el turno concurrente sin SAVEPOINT cuando ON CONFLICT DO NOTHING retorna vacío', async () => {
      const productId = '77777777-7777-4777-a777-777777777777';
      const racedShift = {
        id: 'shift-raced-1',
        shiftNumber: 9n,
        status: 'abierto',
      };

      const mockTx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]),
        product: {
          findMany: jest.fn().mockResolvedValue([
            { id: productId, name: 'Pie de Limón', stock: 4, salePrice: 1190 },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        posShift: {
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 'prev-closed-shift' })
            .mockResolvedValueOnce(racedShift),
          findUnique: jest.fn(),
        },
        accountingOutbox: {
          upsert: jest.fn().mockResolvedValue({ id: 'outbox-sale-raced' }),
        },
        posSale: {
          updateMany: jest.fn(),
          create: jest.fn().mockResolvedValue({
            id: 'sale-raced-1',
            ticketNumber: 'TK-RACED-1',
            paymentMethod: 'efectivo',
            subtotal: 1000,
            taxAmount: 190,
            total: 1190,
            status: 'completada',
            accountingStatus: 'pending',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-11T18:00:00Z'),
            items: [],
            createdBy: { id: 'u1', name: 'Cajero', role: 'cashier' },
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));

      await service.createSale(
        {
          paymentMethod: 'efectivo',
          items: [{ productId, quantity: 1 }],
        },
        'u1',
      );

      expect(mockTx.posSale.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            shiftId: 'shift-raced-1',
          }),
        }),
      );
    });

    it('debe encolar pos_sale_cogs con unitCost y no bloquear la venta si el COGS queda pendiente por costPrice=0', async () => {
      const productId = '88888888-8888-4888-a888-888888888888';
      let upsertCount = 0;
      const mockTx = {
        $queryRaw: jest.fn().mockResolvedValue([]),
        product: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: productId,
              name: 'Alfajor Artesanal',
              stock: 10,
              unit: 'un',
              salePrice: 1500,
              costPrice: 0,
            },
          ]),
          updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
        posShift: {
          findFirst: jest.fn().mockResolvedValue({
            id: 'shift-cogs-1',
            shiftNumber: 1n,
            status: 'abierto',
          }),
        },
        accountingOutbox: {
          upsert: jest.fn().mockImplementation(async () => {
            upsertCount += 1;
            return { id: upsertCount === 1 ? 'outbox-income-1' : 'outbox-cogs-1' };
          }),
        },
        posSale: {
          create: jest.fn().mockResolvedValue({
            id: 'sale-cogs-pending',
            ticketNumber: 'TK-COGS-0',
            paymentMethod: 'efectivo',
            subtotal: 1261,
            taxAmount: 239,
            total: 1500,
            status: 'completada',
            accountingStatus: 'pending',
            dataOrigin: 'real',
            soldAt: new Date('2026-11-12T15:00:00Z'),
            items: [
              {
                id: 'sale-item-cogs-1',
                saleId: 'sale-cogs-pending',
                productId,
                packagingId: null,
                productName: 'Alfajor Artesanal',
                quantity: 1,
                unitPrice: 1500,
                unitCost: 0,
                lineTotal: 1500,
              },
            ],
            createdBy: null,
          }),
        },
      };

      prisma.$transaction.mockImplementation(async (cb: any) => cb(mockTx));
      outboxProcessor.processEvent
        .mockResolvedValueOnce({
          outboxId: 'outbox-income-1',
          aggregateType: 'pos_sale',
          aggregateId: 'sale-cogs-pending',
          entryId: 'entry-inc-1',
          entryNumber: 50,
          alreadyProcessed: false,
        })
        .mockRejectedValueOnce(new BadRequestException('Falta costPrice de Alfajor Artesanal'));

      const result = await service.createSale({
        paymentMethod: 'efectivo',
        items: [{ productId, quantity: 1 }],
      });

      expect(mockTx.accountingOutbox.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          create: expect.objectContaining({
            aggregateType: 'pos_sale_cogs',
          }),
        }),
      );
      expect(result.accountingStatus).toBe('posted');
      expect(result.accountingWarning).toMatch(/Costo de venta pendiente/i);
    });
  });

  describe('findSaleById', () => {
    it('debe lanzar NotFoundException cuando la venta no existe', async () => {
      prisma.posSale.findUnique.mockResolvedValue(null);

      await expect(
        service.findSaleById('99999999-9999-4999-8999-999999999999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('CreateSaleDto con ValidationPipe estricto', () => {
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });

    it('debe cerrar el bypass de @ValidateIf doble en CreateSaleDto (XOR estricto productId vs packagingId)', async () => {
      await expect(
        pipe.transform(
          {
            paymentMethod: 'efectivo',
            items: [{ quantity: 1 }],
          },
          { type: 'body', metatype: CreateSaleDto },
        ),
      ).rejects.toThrow(BadRequestException);

      await expect(
        pipe.transform(
          {
            paymentMethod: 'efectivo',
            items: [
              {
                productId: '11111111-1111-4111-8111-111111111111',
                packagingId: '22222222-2222-4222-8222-222222222222',
                quantity: 1,
              },
            ],
          },
          { type: 'body', metatype: CreateSaleDto },
        ),
      ).rejects.toThrow(BadRequestException);

      const valid = await pipe.transform(
        {
          paymentMethod: 'debito',
          items: [
            {
              productId: '11111111-1111-4111-8111-111111111111',
              quantity: 2,
            },
          ],
        },
        { type: 'body', metatype: CreateSaleDto },
      );
      expect(valid.items[0].quantity).toBe(2);
    });
  });
});
