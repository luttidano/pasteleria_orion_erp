import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryStockService } from './inventory-stock.service';

describe('InventoryStockService (precios autoritativos y concurrencia ACID)', () => {
  let service: InventoryStockService;
  let mockPrisma: any;
  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn(),
    };
    service = new InventoryStockService(mockPrisma);
  });
  it('debe calcular las alertas consolidadas de stock vía queryRaw nativo', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      { outOfStockCount: 2, restockCount: 5 },
    ]);

    const result = await service.getAlertCounts();

    expect(result.outOfStockCount).toBe(2);
    expect(result.restockCount).toBe(5);
    expect(result.totalAlerts).toBe(7);
  });

  it('debe bloquear por UUID ordenado, agregar cantidades duplicadas, calcular precios desde BD y cobrar Ley de Bolsas ($100 / $0)', async () => {
    const prodB = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const prodA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const bagId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const boxId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

    const updateOrder: string[] = [];
    const mockTx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: prodA,
            name: 'Kuchen Berries',
            stock: 10,
            unit: 'un',
            salePrice: 12000,
            costPrice: 4500,
          },
          {
            id: prodB,
            name: 'Pie de Limón',
            stock: 8,
            unit: 'un',
            salePrice: 15000,
            costPrice: 5200,
          },
        ]),
        updateMany: jest.fn().mockImplementation(async (args: any) => {
          updateOrder.push(args.where.id);
          return { count: 1 };
        }),
      },
      packaging: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: bagId,
            name: 'Bolsa Kraft Mediana',
            packageType: 'secundario',
            stock: 30,
            unit: 'un',
            costPrice: 40,
          },
          {
            id: boxId,
            name: 'Caja Torta Cortesía',
            packageType: 'secundario',
            stock: 20,
            unit: 'un',
            costPrice: 350,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const pricedLines = await service.reserveAndDeductForSaleInTx(mockTx, [
      { productId: prodB, quantity: 1 },
      { productId: prodA, quantity: 2 },
      { productId: prodA, quantity: 1 }, // repetido -> total 3 para prodA
      { packagingId: bagId, quantity: 2 },
      { packagingId: boxId, quantity: 1 },
    ]);

    expect(mockTx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(updateOrder).toEqual([prodA, prodB]);

    expect(mockTx.product.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: prodA, stock: { gte: 3 } },
        data: expect.objectContaining({ stock: { decrement: 3 } }),
      }),
    );

    expect(pricedLines).toEqual([
      {
        productId: prodB,
        packagingId: null,
        productName: 'Pie de Limón',
        quantity: 1,
        unitPrice: 15000,
        unitCost: 5200,
        lineTotal: 15000,
      },
      {
        productId: prodA,
        packagingId: null,
        productName: 'Kuchen Berries',
        quantity: 2,
        unitPrice: 12000,
        unitCost: 4500,
        lineTotal: 24000,
      },
      {
        productId: prodA,
        packagingId: null,
        productName: 'Kuchen Berries',
        quantity: 1,
        unitPrice: 12000,
        unitCost: 4500,
        lineTotal: 12000,
      },
      {
        productId: null,
        packagingId: bagId,
        productName: 'Bolsa Kraft Mediana',
        quantity: 2,
        unitPrice: 100,
        unitCost: 40,
        lineTotal: 200,
      },
      {
        productId: null,
        packagingId: boxId,
        productName: 'Caja Torta Cortesía',
        quantity: 1,
        unitPrice: 0,
        unitCost: 350,
        lineTotal: 0,
      },
    ]);
  });

  it('debe rechazar empaques primarios en ventas POS', async () => {
    const primaryPkgId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const mockTx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      packaging: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: primaryPkgId,
            name: 'Cápsula Cupcake N°5',
            packageType: 'primario',
            stock: 100,
          },
        ]),
      },
    };

    await expect(
      service.reserveAndDeductForSaleInTx(mockTx, [
        { packagingId: primaryPkgId, quantity: 1 },
      ]),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe lanzar ConflictException si el stock acumulado no alcanza o updateMany retorna count 0', async () => {
    const prodId = '11111111-1111-4111-8111-111111111111';
    const mockTxInsufficient: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: prodId, name: 'Brazo de Reina', stock: 3, salePrice: 9000 },
        ]),
        updateMany: jest.fn(),
      },
    };

    await expect(
      service.reserveAndDeductForSaleInTx(mockTxInsufficient, [
        { productId: prodId, quantity: 2 },
        { productId: prodId, quantity: 2 },
      ]),
    ).rejects.toThrow(ConflictException);
    expect(mockTxInsufficient.product.updateMany).not.toHaveBeenCalled();

    const mockTxRace: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: prodId, name: 'Brazo de Reina', stock: 5, salePrice: 9000 },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await expect(
      service.reserveAndDeductForSaleInTx(mockTxRace, [
        { productId: prodId, quantity: 2 },
      ]),
    ).rejects.toThrow(ConflictException);
  });

  it('debe registrar todos los movimientos de Kardex en un solo lote mediante recordManyInTx', async () => {
    const prodId = '11111111-1111-4111-8111-111111111111';
    const pkgId = '22222222-2222-4222-8222-222222222222';
    const mockMovementService: any = {
      recordInTx: jest.fn(),
      recordManyInTx: jest.fn().mockResolvedValue(2),
    };
    const stockServiceWithKardex = new InventoryStockService(
      mockPrisma,
      mockMovementService,
    );

    const mockTx: any = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: prodId,
            name: 'Torta Tres Leches',
            stock: 5,
            unit: 'un',
            salePrice: 18000,
            costPrice: 7000,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      packaging: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: pkgId,
            name: 'Bolsa Kraft Mediana',
            packageType: 'secundario',
            stock: 10,
            unit: 'un',
            costPrice: 50,
            salePrice: 100,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await stockServiceWithKardex.reserveAndDeductForSaleInTx(
      mockTx,
      [
        { productId: prodId, quantity: 1 },
        { packagingId: pkgId, quantity: 2 },
      ],
      { saleId: 'sale-batch-1', ticketNumber: 'TK-1' },
    );

    expect(mockMovementService.recordInTx).not.toHaveBeenCalled();
    expect(mockMovementService.recordManyInTx).toHaveBeenCalledTimes(1);
    expect(mockMovementService.recordManyInTx).toHaveBeenCalledWith(
      mockTx,
      expect.arrayContaining([
        expect.objectContaining({ itemType: 'product', itemId: prodId }),
        expect.objectContaining({ itemType: 'packaging', itemId: pkgId }),
      ]),
    );
  });

  it('debe reutilizar las filas retornadas por FOR UPDATE sin ejecutar findMany redundantes', async () => {
    const prodId = '11111111-1111-4111-8111-111111111111';
    const pkgId = '22222222-2222-4222-8222-222222222222';
    const mockTx: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([
          {
            id: prodId,
            name: 'Torta Manjar',
            stock: 6,
            unit: 'un',
            salePrice: 14000,
            costPrice: 5500,
          },
        ])
        .mockResolvedValueOnce([
          {
            id: pkgId,
            name: 'Bolsa Kraft Pequeña',
            packageType: 'secundario',
            stock: 20,
            unit: 'un',
            costPrice: 30,
            salePrice: 100,
          },
        ]),
      product: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      packaging: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const lines = await service.reserveAndDeductForSaleInTx(mockTx, [
      { productId: prodId, quantity: 1 },
      { packagingId: pkgId, quantity: 1 },
    ]);

    expect(mockTx.product.findMany).not.toHaveBeenCalled();
    expect(mockTx.packaging.findMany).not.toHaveBeenCalled();
    expect(lines).toHaveLength(2);
    expect(lines[0].unitPrice).toBe(14000);
    expect(lines[1].unitPrice).toBe(100);
  });
});

