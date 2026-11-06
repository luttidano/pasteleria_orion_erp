import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';

@Injectable()
export class PackagingService {
  constructor(private readonly prisma: PrismaService) {}

  private mapPackaging(p: any) {
    const stock = Number(p.stock || 0);
    const minStock = Number(p.minStock ?? p.min_stock ?? 0);
    let status: 'suficiente' | 'bajo' | 'agotado' = 'suficiente';
    if (stock <= 0) status = 'agotado';
    else if (stock <= minStock) status = 'bajo';

    const supplier = p.supplier
      ? {
          id: p.supplier.id,
          name: p.supplier.name,
          phone: p.supplier.phone,
          deliverySchedule: p.supplier.deliverySchedule,
          category: p.supplier.category,
          supplierTypes: p.supplier.supplierTypes || ['empaque'],
          contactPerson: p.supplier.contactPerson,
          icon: p.supplier.icon,
        }
      : null;

    return {
      id: p.id,
      name: p.name,
      packageType: p.packageType,
      category: p.category,
      stock,
      minStock,
      unit: p.unit || 'un',
      costPrice:
        p.costPrice !== null && p.costPrice !== undefined
          ? Number(p.costPrice)
          : 0,
      supplierId: p.supplierId,
      supplier,
      icon: p.icon || '📦',
      description: p.description,
      status,
      createdAt:
        p.createdAt instanceof Date ? p.createdAt.toISOString() : p.createdAt,
      updatedAt:
        p.updatedAt instanceof Date ? p.updatedAt.toISOString() : p.updatedAt,
    };
  }

  async findAll(type?: string) {
    const where: any = {};
    if (type && (type === 'primario' || type === 'secundario')) {
      where.packageType = type;
    }

    const items = await this.prisma.packaging.findMany({
      where,
      include: { supplier: true },
      orderBy: [{ packageType: 'asc' }, { name: 'asc' }],
    });

    return items.map((p) => this.mapPackaging(p));
  }

  async findOne(id: string) {
    const packaging = await this.prisma.packaging.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!packaging) {
      throw new NotFoundException(`Empaque con ID "${id}" no encontrado.`);
    }

    return this.mapPackaging(packaging);
  }

  async create(dto: CreatePackagingDto) {
    const created = await this.prisma.packaging.create({
      data: {
        name: dto.name,
        packageType: dto.packageType,
        category: dto.category,
        stock: dto.stock,
        minStock: dto.minStock,
        unit: dto.unit || 'un',
        costPrice: dto.costPrice ?? 0,
        supplierId: dto.supplierId || null,
        icon: dto.icon || '📦',
        description: dto.description,
      },
      include: { supplier: true },
    });

    return this.mapPackaging(created);
  }

  async update(id: string, dto: UpdatePackagingDto) {
    await this.findOne(id);

    const updated = await this.prisma.packaging.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.packageType !== undefined && { packageType: dto.packageType }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.supplierId !== undefined && { supplierId: dto.supplierId || null }),
        ...(dto.icon !== undefined && { icon: dto.icon }),
        ...(dto.description !== undefined && { description: dto.description }),
        updatedAt: new Date(),
      },
      include: { supplier: true },
    });

    return this.mapPackaging(updated);
  }

  async adjustStock(id: string, delta: number) {
    const current = await this.findOne(id);
    const newStock = Math.max(0, current.stock + delta);

    const updated = await this.prisma.packaging.update({
      where: { id },
      data: {
        stock: newStock,
        updatedAt: new Date(),
      },
      include: { supplier: true },
    });

    return this.mapPackaging(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.packaging.delete({ where: { id } });
    return { success: true, message: 'Empaque eliminado correctamente.' };
  }
}
