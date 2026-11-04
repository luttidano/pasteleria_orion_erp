import { Test, TestingModule } from '@nestjs/testing';
import { PackagingService } from './packaging.service';
import { PrismaService } from '../../database/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { NotFoundException } from '@nestjs/common';

describe('PackagingService', () => {
  let service: PackagingService;
  let prisma: any;
  let supabaseService: any;
  let mockSupabaseQuery: any;

  beforeEach(async () => {
    prisma = {
      isAvailable: true,
      packaging: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    mockSupabaseQuery = {
      select: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      maybeSingle: jest.fn(),
      single: jest.fn(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((resolve) => resolve({ data: [], error: null })),
    };

    supabaseService = {
      client: {
        from: jest.fn().mockReturnValue(mockSupabaseQuery),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PackagingService,
        { provide: PrismaService, useValue: prisma },
        { provide: SupabaseService, useValue: supabaseService },
      ],
    }).compile();

    service = module.get<PackagingService>(PackagingService);
  });

  it('debe obtener todos los empaques cuando Prisma está disponible', async () => {
    prisma.packaging.findMany.mockResolvedValue([
      {
        id: 'pack-1',
        name: 'Caja Torta 26cm',
        packageType: 'primario',
        category: 'Cajas',
        stock: 50,
        minStock: 20,
        unit: 'un',
        costPrice: 450,
        supplierId: 'sup-1',
        supplier: {
          id: 'sup-1',
          name: 'Envases Chile',
          phone: '+56911112222',
        },
      },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Caja Torta 26cm');
    expect(result[0].status).toBe('suficiente');
  });

  it('debe recurrir a Supabase REST de forma transparente cuando Prisma no está disponible', async () => {
    prisma.isAvailable = false;
    mockSupabaseQuery.then = jest.fn().mockImplementation((resolve) =>
      resolve({
        data: [
          {
            id: 'pack-sb-1',
            name: 'Bolsa Kraft 30x40',
            package_type: 'secundario',
            category: 'Bolsas',
            stock: 10,
            min_stock: 15,
            unit: 'un',
            cost_price: 180,
            supplier: null,
          },
        ],
        error: null,
      }),
    );

    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Bolsa Kraft 30x40');
    expect(result[0].status).toBe('bajo');
  });

  it('debe ajustar el stock sin permitir números negativos', async () => {
    prisma.packaging.findUnique.mockResolvedValue({
      id: 'pack-1',
      name: 'Caja Torta 26cm',
      packageType: 'primario',
      category: 'Cajas',
      stock: 5,
      minStock: 10,
      unit: 'un',
      costPrice: 450,
    });
    prisma.packaging.update.mockImplementation(({ data }: any) => ({
      id: 'pack-1',
      name: 'Caja Torta 26cm',
      packageType: 'primario',
      category: 'Cajas',
      stock: data.stock,
      minStock: 10,
      unit: 'un',
    }));

    const result = await service.adjustStock('pack-1', -10);
    expect(result.stock).toBe(0);
    expect(result.status).toBe('agotado');
  });

  it('debe lanzar NotFoundException si el empaque no existe', async () => {
    prisma.packaging.findUnique.mockResolvedValue(null);
    mockSupabaseQuery.maybeSingle.mockResolvedValue({ data: null, error: null });

    await expect(service.findOne('id-inexistente')).rejects.toThrow(NotFoundException);
  });
});
