import { BadRequestException, ConflictException } from '@nestjs/common';
import { InventoryStockService } from './inventory-stock.service';

describe('InventoryStockService (precios autoritativos y concurrencia ACID)', () => {
  let service: InventoryStockService;

  beforeEach(() => {
    service = new InventoryStockService();
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
});

