import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RecipeService } from './recipe.service';
import { RecipeProductionService } from './recipe-production.service';
import { CategoryService } from './category.service';
import { PrismaService } from '../../database/prisma.service';
import { StockMovementService } from './stock-movement.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';

describe('RecipeService (ACID produce y conversión estricta de unidades)', () => {
  let service: RecipeService;
  let prisma: any;
  let outboxProcessor: any;

  beforeEach(async () => {
    prisma = {
      recipe: {
        findUnique: jest.fn(),
      },
      ingredient: {
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      product: {
        update: jest.fn(),
      },
      stockMovement: {
        create: jest.fn().mockResolvedValue({ id: 'mov-rec-1' }),
      },
      accountingOutbox: {
        upsert: jest.fn().mockResolvedValue({ id: 'outbox-prod-1' }),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
    };

    outboxProcessor = {
      processEvent: jest.fn().mockResolvedValue({
        outboxId: 'outbox-prod-1',
        aggregateType: 'inventory_production',
        aggregateId: 'prod-run-1',
        entryId: 'entry-prod-1',
        entryNumber: 1,
        alreadyProcessed: false,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipeService,
        RecipeProductionService,
        CategoryService,
        StockMovementService,
        AccountingOutboxService,
        { provide: AccountingOutboxProcessorService, useValue: outboxProcessor },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RecipeService>(RecipeService);
  });

  it('debe descontar insumos e incrementar producto terminado atómicamente dentro de $transaction con FOR UPDATE', async () => {
    const recipeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const flourId = '11111111-1111-4111-8111-111111111111';
    const creamId = '22222222-2222-4222-8222-222222222222';
    const productId = '33333333-3333-4333-8333-333333333333';

    prisma.recipe.findUnique.mockResolvedValue({
      id: recipeId,
      name: 'Bizcocho Vainilla',
      yieldServings: 10,
      ingredients: [
        {
          ingredientId: creamId,
          quantity: 250,
          unit: 'ml',
          ingredients: { id: creamId, name: 'Crema de Leche', stock: 3, unit: 'L' },
        },
        {
          ingredientId: flourId,
          quantity: 500,
          unit: 'g',
          ingredients: { id: flourId, name: 'Harina Selecta', stock: 10, unit: 'kg' },
        },
      ],
      products: [
        {
          id: productId,
          name: 'Torta Vainilla',
          stock: 2,
          unit: 'un',
          costPrice: 1000,
        },
      ],
    });

    prisma.ingredient.findMany.mockResolvedValue([
      { id: flourId, name: 'Harina Selecta', stock: 10, unit: 'kg', price: 1200 },
      { id: creamId, name: 'Crema de Leche', stock: 3, unit: 'L', price: 4000 },
    ]);
    prisma.ingredient.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.update.mockResolvedValue({
      id: productId,
      name: 'Torta Vainilla',
      stock: 22,
      unit: 'un',
      costPrice: 236.36,
    });

    const result = await service.produce(recipeId, { quantity: 2, productId });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
    expect(prisma.ingredient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: flourId, stock: { gte: 1 } },
        data: expect.objectContaining({ stock: { decrement: 1 } }),
      }),
    );
    expect(prisma.ingredient.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: creamId, stock: { gte: 0.5 } },
        data: expect.objectContaining({ stock: { decrement: 0.5 } }),
      }),
    );
    // 1*1200 + 0.5*4000 = 3200; promedio = (2*1000 + 3200) / 22 = 236.36
    expect(prisma.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: productId },
        data: expect.objectContaining({
          stock: { increment: 20 },
          costPrice: 236.36,
        }),
      }),
    );
    expect(prisma.stockMovement.create).toHaveBeenCalledTimes(3); // 2 production_out + 1 production_in
    expect(prisma.accountingOutbox.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          aggregateType: 'inventory_production',
          payload: expect.objectContaining({
            totalCost: 3200,
            unitsProduced: 20,
          }),
        }),
      }),
    );
    expect(outboxProcessor.processEvent).toHaveBeenCalledWith('outbox-prod-1');
    expect(result.product.addedStock).toBe(20);
    expect(result.product.newStock).toBe(22);
    expect(result.accountingStatus).toBe('posted');
  });

  it('debe permitir producir aunque falte precio en ingrediente dejando asiento pendiente sin bloquear cocina', async () => {
    const recipeId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    const ingId = '11111111-1111-4111-8111-111111111111';
    const prodId = '33333333-3333-4333-8333-333333333333';

    prisma.recipe.findUnique.mockResolvedValue({
      id: recipeId,
      name: 'Queque Naranja',
      yieldServings: 10,
      ingredients: [
        {
          ingredientId: ingId,
          quantity: 1,
          unit: 'kg',
          ingredients: { id: ingId, name: 'Naranja Orgánica', stock: 5, unit: 'kg', price: 0 },
        },
      ],
      products: [{ id: prodId, name: 'Queque Naranja', stock: 0, unit: 'un', costPrice: 0 }],
    });
    prisma.ingredient.findMany.mockResolvedValue([
      { id: ingId, name: 'Naranja Orgánica', stock: 5, unit: 'kg', price: 0 },
    ]);
    prisma.ingredient.updateMany.mockResolvedValue({ count: 1 });
    prisma.product.update.mockResolvedValue({
      id: prodId,
      name: 'Queque Naranja',
      stock: 10,
      unit: 'un',
      costPrice: 0,
    });
    outboxProcessor.processEvent.mockRejectedValueOnce(
      new BadRequestException('Falta precio de Naranja Orgánica'),
    );

    const res = await service.produce(recipeId, { quantity: 1, productId: prodId });
    expect(res.success).toBe(true);
    expect(res.product.newStock).toBe(10);
    expect(res.accountingStatus).toBe('pending');
    expect(res.accountingWarning).toMatch(/pendiente/i);
  });

  it('debe lanzar ConflictException si updateMany falla por concurrencia (count 0)', async () => {
    const recipeId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
    const ingId = '11111111-1111-4111-8111-111111111111';
    const prodId = '33333333-3333-4333-8333-333333333333';

    prisma.recipe.findUnique.mockResolvedValue({
      id: recipeId,
      name: 'Queque',
      yieldServings: 8,
      ingredients: [
        {
          ingredientId: ingId,
          quantity: 1,
          unit: 'kg',
          ingredients: { id: ingId, name: 'Harina', stock: 5, unit: 'kg' },
        },
      ],
      products: [{ id: prodId, name: 'Queque Vainilla', stock: 1, unit: 'un' }],
    });
    prisma.ingredient.findMany.mockResolvedValue([
      { id: ingId, name: 'Harina', stock: 5, unit: 'kg' },
    ]);
    prisma.ingredient.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.produce(recipeId, { quantity: 1, productId: prodId }),
    ).rejects.toThrow(ConflictException);
    expect(prisma.product.update).not.toHaveBeenCalled();
  });

  it('debe rechazar recetas sin ingredientes o con unidades incompatibles / desconocidas', async () => {
    const recipeId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    const prodId = '33333333-3333-4333-8333-333333333333';

    prisma.recipe.findUnique.mockResolvedValueOnce({
      id: recipeId,
      name: 'Receta Vacía',
      yieldServings: 4,
      ingredients: [],
      products: [{ id: prodId, name: 'Postre', stock: 0, unit: 'un' }],
    });
    await expect(
      service.produce(recipeId, { quantity: 1, productId: prodId }),
    ).rejects.toThrow(BadRequestException);

    const ingId = '11111111-1111-4111-8111-111111111111';
    prisma.recipe.findUnique.mockResolvedValueOnce({
      id: recipeId,
      name: 'Receta Incongruente',
      yieldServings: 4,
      ingredients: [
        {
          ingredientId: ingId,
          quantity: 2,
          unit: 'un',
          ingredients: { id: ingId, name: 'Harina', stock: 10, unit: 'kg' },
        },
      ],
      products: [{ id: prodId, name: 'Postre', stock: 0, unit: 'un' }],
    });
    prisma.ingredient.findMany.mockResolvedValueOnce([
      { id: ingId, name: 'Harina', stock: 10, unit: 'kg' },
    ]);

    await expect(
      service.produce(recipeId, { quantity: 1, productId: prodId }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe reportar unidades incompatibles sin producir en findOne', async () => {
    const recipeId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
    prisma.recipe.findUnique.mockResolvedValue({
      id: recipeId,
      name: 'Receta Descalibrada',
      yieldServings: 5,
      ingredients: [
        {
          id: 'ri-1',
          ingredientId: 'ing-1',
          quantity: 1,
          unit: 'caja',
          ingredients: { id: 'ing-1', name: 'Huevo', stock: 60, unit: 'un' },
        },
      ],
      products: [],
    });

    const enriched = await service.findOne(recipeId);
    expect(enriched.canProduce).toBe(false);
    expect(enriched.maxBatches).toBe(0);
    expect(enriched.missingIngredients[0]).toMatchObject({
      name: 'Huevo',
      incompatibleUnits: true,
    });
  });
});

