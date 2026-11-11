import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { GeneralSupplyService } from './general-supply.service';
import { PrismaService } from '../../database/prisma.service';
import { CreateGeneralSupplyDto } from './dto/create-general-supply.dto';
import { UpdateGeneralSupplyDto } from './dto/update-general-supply.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';

describe('GeneralSupplyService', () => {
  let service: GeneralSupplyService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      generalSupply: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      supplier: {
        findUnique: jest.fn(),
      },
      $transaction: jest.fn((cb: any) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneralSupplyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<GeneralSupplyService>(GeneralSupplyService);
  });

  it('debe listar insumos generales con estado de stock calculado (suficiente, bajo, agotado)', async () => {
    prisma.generalSupply.findMany.mockResolvedValue([
      {
        id: 'gs-1',
        name: 'Guantes de Nitrilo M',
        category: 'Protección (EPP)',
        stock: 8,
        minStock: 3,
        unit: 'caja',
        costPrice: 4500,
        supplierId: 'sup-1',
        supplier: {
          id: 'sup-1',
          name: 'Aseo & Seguridad Sur',
          phone: '+56911112222',
          supplierTypes: ['insumo_general'],
        },
      },
      {
        id: 'gs-2',
        name: 'Cofias Desechables',
        category: 'Protección (EPP)',
        stock: 2,
        minStock: 3,
        unit: 'paquete',
        costPrice: 1800,
        supplierId: null,
        supplier: null,
      },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(2);
    expect(result[0].status).toBe('suficiente');
    expect(result[0].supplier?.name).toBe('Aseo & Seguridad Sur');
    expect(result[1].status).toBe('bajo');
    expect(result[1].supplier).toBeNull();
  });

  it('debe crear un insumo general sin proveedor asignado (opcional)', async () => {
    prisma.generalSupply.create.mockResolvedValue({
      id: 'gs-3',
      name: 'Detergente Desengrasante',
      category: 'Higiene y Aseo',
      stock: 4,
      minStock: 2,
      unit: 'bidón',
      costPrice: 8900,
      supplierId: null,
      supplier: null,
      icon: '🧴',
    });

    const created = await service.create({
      name: 'Detergente Desengrasante',
      category: 'Higiene y Aseo',
      stock: 4,
      minStock: 2,
      unit: 'bidón',
      costPrice: 8900,
      supplierId: null,
      icon: '🧴',
    });

    expect(prisma.supplier.findUnique).not.toHaveBeenCalled();
    expect(created.supplierId).toBeNull();
    expect(created.status).toBe('suficiente');
  });

  it('debe lanzar BadRequestException si el proveedor opcional enviado no existe', async () => {
    prisma.supplier.findUnique.mockResolvedValue(null);

    await expect(
      service.create({
        name: 'Guantes de Cocina',
        category: 'Protección (EPP)',
        stock: 5,
        minStock: 2,
        supplierId: '11111111-1111-4111-8111-111111111111',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe ajustar stock sin permitir valores negativos y pasar a agotado en 0', async () => {
    prisma.generalSupply.findUnique.mockResolvedValue({
      id: 'gs-1',
      name: 'Guantes de Nitrilo M',
      category: 'Protección (EPP)',
      stock: 2,
      minStock: 3,
      unit: 'caja',
      costPrice: 4500,
    });
    prisma.generalSupply.update.mockImplementation(({ data }: any) => ({
      id: 'gs-1',
      name: 'Guantes de Nitrilo M',
      category: 'Protección (EPP)',
      stock: data.stock,
      minStock: 3,
      unit: 'caja',
      costPrice: 4500,
      supplier: null,
    }));

    const result = await service.adjustStock('gs-1', { delta: -5 });
    expect(result.stock).toBe(0);
    expect(result.status).toBe('agotado');
  });

  it('debe lanzar NotFoundException si el insumo general no existe', async () => {
    prisma.generalSupply.findUnique.mockResolvedValue(null);

    await expect(service.findOne('id-inexistente')).rejects.toThrow(
      NotFoundException,
    );
  });
});

describe('GeneralSupply & Supplier DTOs con ValidationPipe estricto', () => {
  const pipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  it('debe transformar números, aceptar supplierId vacío como null y permitir UUIDs seedeados', async () => {
    const withoutSupplier = await pipe.transform(
      {
        name: 'Guantes de Nitrilo',
        category: 'Protección (EPP)',
        stock: '5',
        minStock: '2',
        supplierId: '',
      },
      { type: 'body', metatype: CreateGeneralSupplyDto },
    );

    expect(withoutSupplier.stock).toBe(5);
    expect(withoutSupplier.minStock).toBe(2);
    expect(withoutSupplier.supplierId).toBeNull();

    const withSeedUuid = await pipe.transform(
      {
        name: 'Cofias',
        category: 'Protección (EPP)',
        stock: 3,
        minStock: 2,
        supplierId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      },
      { type: 'body', metatype: CreateGeneralSupplyDto },
    );
    expect(withSeedUuid.supplierId).toBe(
      'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
    );
  });

  it('debe rechazar propiedades no declaradas en el DTO (forbidNonWhitelisted) y UUIDs inválidos', async () => {
    await expect(
      pipe.transform(
        {
          name: 'Guantes',
          category: 'Protección (EPP)',
          stock: 1,
          minStock: 1,
          campoExtraNoPermitido: 'foo',
        },
        { type: 'body', metatype: CreateGeneralSupplyDto },
      ),
    ).rejects.toThrow(BadRequestException);

    await expect(
      pipe.transform(
        {
          name: 'Guantes',
          category: 'Protección (EPP)',
          stock: 1,
          minStock: 1,
          supplierId: 'no-es-uuid',
        },
        { type: 'body', metatype: CreateGeneralSupplyDto },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('debe mantener supplierId undefined en UpdateGeneralSupplyDto cuando no se envía y aceptar insumo_general en CreateSupplierDto', async () => {
    const partial = await pipe.transform(
      { stock: 10 },
      { type: 'body', metatype: UpdateGeneralSupplyDto },
    );
    expect(partial.stock).toBe(10);
    expect(partial.supplierId).toBeUndefined();

    const supplier = await pipe.transform(
      {
        name: 'Distribuidora Aseo Sur',
        supplierTypes: ['insumo_general'],
      },
      { type: 'body', metatype: CreateSupplierDto },
    );
    expect(supplier.supplierTypes).toEqual(['insumo_general']);
  });
});
