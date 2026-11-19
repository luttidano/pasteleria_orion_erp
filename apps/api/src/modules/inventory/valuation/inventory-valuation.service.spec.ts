import { Test, TestingModule } from '@nestjs/testing';
import { InventoryValuationService } from './inventory-valuation.service';
import { PrismaService } from '../../../database/prisma.service';

describe('InventoryValuationService', () => {
  let service: InventoryValuationService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      ingredient: { findMany: jest.fn() },
      packaging: { findMany: jest.fn() },
      product: { findMany: jest.fn() },
      generalSupply: { findMany: jest.fn() },
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
      // Producto con costPrice 0: debe hacer fallback a salePrice en vez de evaluarse en $0
      { id: 'prod-2', name: 'Pie de Limón', stock: 5, unit: 'un', costPrice: 0, salePrice: 10000 },
    ]);
    prisma.generalSupply.findMany.mockResolvedValue([
      { id: 'sup-1', name: 'Guantes Nitrilo', stock: 10, unit: 'caja', costPrice: 4000 },
    ]);

    const summary = await service.getValuationSummary();

    expect(summary.rawMaterialsValue).toBe(190000);
    expect(summary.packagingValue).toBe(50000);
    // prod-1: 15 * 8000 = 120000; prod-2: 5 * 10000 = 50000; total = 170000
    expect(summary.finishedProductsValue).toBe(170000);
    expect(summary.generalSuppliesValue).toBe(40000);
    // 190000 + 50000 + 170000 + 40000 = 450000
    expect(summary.totalWarehouseValue).toBe(450000);
    expect(summary.topRawMaterials[0].id).toBe('ing-2');
    expect(summary.topGeneralSupplies?.[0].id).toBe('sup-1');
  });
});
