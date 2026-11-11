import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGeneralSupplyDto } from './dto/create-general-supply.dto';
import { UpdateGeneralSupplyDto } from './dto/update-general-supply.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

@Injectable()
export class GeneralSupplyService {
  constructor(private readonly prisma: PrismaService) {}

  private computeStatus(stock: number, minStock: number): StockStatus {
    if (stock <= 0) return 'agotado';
    if (stock <= minStock) return 'bajo';
    return 'suficiente';
  }

  private mapGeneralSupply(item: any) {
    const stock = Number(item.stock ?? 0);
    const minStock = Number(item.minStock ?? item.min_stock ?? 0);

    const supplier = item.supplier
      ? {
          id: item.supplier.id,
          name: item.supplier.name,
          phone: item.supplier.phone,
          deliverySchedule: item.supplier.deliverySchedule,
          category: item.supplier.category,
          supplierTypes: item.supplier.supplierTypes || ['insumo_general'],
          contactPerson: item.supplier.contactPerson,
          icon: item.supplier.icon,
        }
      : null;

    return {
      id: item.id,
      name: item.name,
      category: item.category,
      stock,
      minStock,
      unit: item.unit || 'un',
      costPrice:
        item.costPrice !== null && item.costPrice !== undefined
          ? Number(item.costPrice)
          : 0,
      supplierId: item.supplierId ?? null,
      supplier,
      icon: item.icon || '🧤',
      description: item.description ?? null,
      status: this.computeStatus(stock, minStock),
      createdAt:
        item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item.createdAt,
      updatedAt:
        item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : item.updatedAt,
    };
  }

  private async ensureSupplierExists(supplierId: string) {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: supplierId },
      select: { id: true },
    });
    if (!supplier) {
      throw new BadRequestException(
        `El proveedor con ID "${supplierId}" no existe.`,
      );
    }
  }

  async findAll(category?: string) {
    const where: Record<string, any> = {};
    if (category && category.trim() && category !== 'all') {
      where.category = category.trim();
    }

    const items = await this.prisma.generalSupply.findMany({
      where,
      include: { supplier: true },
      orderBy: [{ name: 'asc' }],
    });

    return items.map((item) => this.mapGeneralSupply(item));
  }

  async findOne(id: string) {
    const item = await this.prisma.generalSupply.findUnique({
      where: { id },
      include: { supplier: true },
    });

    if (!item) {
      throw new NotFoundException(
        `Insumo general con ID "${id}" no encontrado.`,
      );
    }

    return this.mapGeneralSupply(item);
  }

  async create(dto: CreateGeneralSupplyDto) {
    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    const created = await this.prisma.generalSupply.create({
      data: {
        name: dto.name.trim(),
        category: dto.category.trim(),
        stock: dto.stock,
        minStock: dto.minStock,
        unit: dto.unit?.trim() || 'un',
        costPrice: dto.costPrice ?? 0,
        supplierId: dto.supplierId || null,
        icon: dto.icon?.trim() || '🧤',
        description: dto.description?.trim() || null,
      },
      include: { supplier: true },
    });

    return this.mapGeneralSupply(created);
  }

  async update(id: string, dto: UpdateGeneralSupplyDto) {
    await this.findOne(id);

    if (dto.supplierId) {
      await this.ensureSupplierExists(dto.supplierId);
    }

    const updated = await this.prisma.generalSupply.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name.trim() }),
        ...(dto.category !== undefined && { category: dto.category.trim() }),
        ...(dto.stock !== undefined && { stock: dto.stock }),
        ...(dto.minStock !== undefined && { minStock: dto.minStock }),
        ...(dto.unit !== undefined && { unit: dto.unit.trim() || 'un' }),
        ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
        ...(dto.supplierId !== undefined && {
          supplierId: dto.supplierId || null,
        }),
        ...(dto.icon !== undefined && { icon: dto.icon.trim() || '🧤' }),
        ...(dto.description !== undefined && {
          description: dto.description?.trim() || null,
        }),
        updatedAt: new Date(),
      },
      include: { supplier: true },
    });

    return this.mapGeneralSupply(updated);
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    if (!Number.isFinite(dto.delta)) {
      throw new BadRequestException('El ajuste de stock debe ser numérico.');
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.generalSupply.findUnique({
        where: { id },
      });

      if (!current) {
        throw new NotFoundException(
          `Insumo general con ID "${id}" no encontrado.`,
        );
      }

      const currentStock = Number(current.stock ?? 0);
      const nextStock = Math.max(
        0,
        Math.round((currentStock + dto.delta) * 1000) / 1000,
      );

      return tx.generalSupply.update({
        where: { id },
        data: {
          stock: nextStock,
          updatedAt: new Date(),
        },
        include: { supplier: true },
      });
    });

    return this.mapGeneralSupply(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.generalSupply.delete({ where: { id } });
    return {
      success: true,
      message: 'Insumo general eliminado correctamente.',
    };
  }
}

