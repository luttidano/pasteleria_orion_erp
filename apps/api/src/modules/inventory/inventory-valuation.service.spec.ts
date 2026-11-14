import { Test, TestingModule } from '@nestjs/testing';
import { InventoryValuationService } from './inventory-valuation.service';
import { PrismaService } from '../../database/prisma.service';

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ingredient: { findMany: jest.fn() },
      packaging: { findMany: jest.fn() },
      product: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryValuationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<InventoryValuationService>(InventoryValuationService);
  });

  it('debe calcular correctamente la valorización consolidada de bodega', async () => {
    prisma.ingredient.findMany.mockResolvedValue([
      { id: 'ing-1', name: 'Harina Selecta', stock: 50, unit: 'kg', price: 1200 },
      { id: 'ing-2', name: 'Mantequilla', stock: 20, unit: 'kg', price: 6500 },
    ]);
    prisma.packaging.findMany.mockResolvedValue([
      { id: 'pack-1', name: 'Caja Kraft 26cm', stock: 100, unit: 'un', costPrice: 500 },
    ]);
    prisma.product.findMany.mockResolvedValue([
      { id: 'prod-1', name: 'Torta Selva Negra', stock: 15, unit: 'un', costPrice: 8000, salePrice: 15000 },
    ]);

    const summary = await service.getValuationSummary();

    expect(summary.rawMaterialsValue).toBe(190000);
    expect(summary.packagingValue).toBe(50000);
    expect(summary.finishedProductsValue).toBe(120000);
    expect(summary.totalWarehouseValue).toBe(360000);
    expect(summary.topRawMaterials[0].id).toBe('ing-2');
  });
});
