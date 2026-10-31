import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Determina la modalidad de abastecimiento según los datos del proveedor
   */
  private detectSupplyModality(item: any): 'despacho' | 'presencial' {
    const schedule = (item.deliverySchedule || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const icon = item.icon || '';

    if (
      schedule.includes('presencial') ||
      schedule.includes('retiro') ||
      schedule.includes('local') ||
      schedule.includes('mayorista') ||
      notes.includes('presencial') ||
      notes.includes('local') ||
      notes.includes('mayorista') ||
      name.includes('mayorista') ||
      name.includes('vega') ||
      ['🏬', '🏪', '🛒'].includes(icon)
    ) {
      return 'presencial';
    }
    return 'despacho';
  }

  private mapSupplier(item: any) {
    return {
      id: item.id,
      name: item.name,
      phone: item.phone,
      supplierType: item.supplierType,
      supplyModality: this.detectSupplyModality(item),
      deliverySchedule: item.deliverySchedule,
      category: item.category,
      approximatePrices: item.approximatePrices,
      contactPerson: item.contactPerson,
      icon: item.icon || '🚚',
      email: item.email,
      address: item.address,
      notes: item.notes,
      createdAt: item.createdAt?.toISOString(),
      updatedAt: item.updatedAt?.toISOString(),
      ingredientsCount: item.supplierIngredients?.length ?? 0,
      resaleProductsCount: item.resaleProducts?.length ?? 0,
    };
  }

  async findAll(type?: string) {
    try {
      const where = type ? { supplierType: type } : {};
      const suppliers = await this.prisma.supplier.findMany({
        where,
        include: {
          supplierIngredients: true,
          resaleProducts: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return suppliers.map((s) => this.mapSupplier(s));
    } catch (error) {
      console.error('[SupplierService] Error consultando proveedores:', error);
      throw new InternalServerErrorException('No se pudieron consultar los proveedores.');
    }
  }

  async findOne(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        supplierIngredients: {
          include: { ingredient: true },
        },
        resaleProducts: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado.`);
    }

    return this.mapSupplier(supplier);
  }

  async create(dto: CreateSupplierDto) {
    try {
      const isPresencial = dto.supplyModality === 'presencial';

      // Valores por defecto acordes a la realidad operativa del negocio
      const phone = dto.phone?.trim() || 'Sin registrar';
      const deliverySchedule =
        dto.deliverySchedule?.trim() ||
        (isPresencial ? 'Compra presencial / Retiro en local' : 'A coordinar / Pedido directo');
      const category = dto.category?.trim() || 'General';
      const approximatePrices = dto.approximatePrices?.trim() || 'A consultar en establecimiento';
      const icon = dto.icon || (isPresencial ? '🏬' : '🚚');

      const created = await this.prisma.supplier.create({
        data: {
          name: dto.name.trim(),
          phone,
          deliverySchedule,
          category,
          approximatePrices,
          contactPerson: dto.contactPerson?.trim() || null,
          icon,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          notes: dto.notes?.trim() || null,
          supplierType: dto.supplierType || 'materia_prima',
        },
      });

      return this.mapSupplier(created);
    } catch (error) {
      console.error('[SupplierService] Error registrando proveedor:', error);
      throw new InternalServerErrorException('No se pudo registrar el proveedor.');
    }
  }

  async update(id: string, dto: UpdateSupplierDto) {
    await this.findOne(id);

    try {
      const updated = await this.prisma.supplier.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name.trim() }),
          ...(dto.phone !== undefined && { phone: dto.phone.trim() || 'Sin registrar' }),
          ...(dto.deliverySchedule !== undefined && { deliverySchedule: dto.deliverySchedule.trim() }),
          ...(dto.category !== undefined && { category: dto.category.trim() }),
          ...(dto.approximatePrices !== undefined && { approximatePrices: dto.approximatePrices.trim() }),
          ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson?.trim() || null }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
          ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
          ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
          ...(dto.supplierType !== undefined && { supplierType: dto.supplierType }),
          updatedAt: new Date(),
        },
      });

      return this.mapSupplier(updated);
    } catch (error) {
      console.error('[SupplierService] Error actualizando proveedor:', error);
      throw new InternalServerErrorException('No se pudo actualizar el proveedor.');
    }
  }

  async remove(id: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id },
      include: {
        resaleProducts: true,
      },
    });

    if (!supplier) {
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado.`);
    }

    if (supplier.resaleProducts.length > 0) {
      throw new BadRequestException(
        `No se puede eliminar: el proveedor tiene ${supplier.resaleProducts.length} producto(s) de reventa asociados.`,
      );
    }

    await this.prisma.supplier.delete({
      where: { id },
    });

    return { success: true, id };
  }
}