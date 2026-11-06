import { Test, TestingModule } from '@nestjs/testing';
import { SupplierService } from './supplier.service';
import { PrismaService } from '../../database/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SupplierService', () => {
  let service: SupplierService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      supplier: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupplierService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<SupplierService>(SupplierService);
  });

  it('debe listar proveedores y detectar correctamente la modalidad de abastecimiento', async () => {
    prisma.supplier.findMany.mockResolvedValue([
      {
        id: 'sup-1',
        name: 'Distribuidora Mayorista La Vega',
        phone: '+56988887777',
        deliverySchedule: 'Retiro presencial lunes y jueves',
        category: 'Frutas y Verduras',
        approximatePrices: 'Precios mayoristas mercado',
        icon: '🏬',
        supplierTypes: ['materia_prima'],
        supplierIngredients: [{ id: 'si-1' }],
        resaleProducts: [],
      },
      {
        id: 'sup-2',
        name: 'Molino Central',
        phone: '+56977776666',
        deliverySchedule: 'Despacho martes a primera hora',
        category: 'Harinas',
        approximatePrices: '$25.000 saco 25kg',
        icon: '🚚',
        supplierTypes: ['materia_prima'],
        supplierIngredients: [],
        resaleProducts: [],
      },
    ]);

    const result = await service.findAll();
    expect(result).toHaveLength(2);
    expect(result[0].supplyModality).toBe('presencial');
    expect(result[0].ingredientsCount).toBe(1);
    expect(result[1].supplyModality).toBe('despacho');
  });

  it('no debe permitir eliminar un proveedor si tiene productos de reventa asociados', async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      id: 'sup-1',
      name: 'Bebidas Andina',
      resaleProducts: [{ id: 'prod-1', name: 'Coca Cola 350cc' }],
    });

    await expect(service.remove('sup-1')).rejects.toThrow(BadRequestException);
  });

  it('debe eliminar exitosamente un proveedor cuando no tiene productos asociados', async () => {
    prisma.supplier.findUnique.mockResolvedValue({
      id: 'sup-1',
      name: 'Proveedor Sin Productos',
      resaleProducts: [],
    });
    prisma.supplier.delete.mockResolvedValue({ id: 'sup-1' });

    const result = await service.remove('sup-1');
    expect(result).toEqual({ success: true, id: 'sup-1' });
  });

  it('debe lanzar NotFoundException si el proveedor no existe', async () => {
    prisma.supplier.findUnique.mockResolvedValue(null);

    await expect(service.findOne('sup-inexistente')).rejects.toThrow(NotFoundException);
  });
});
