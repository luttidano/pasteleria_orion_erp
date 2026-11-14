import {
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateGeneralSupplyDto } from './dto/create-general-supply.dto';
import { UpdateGeneralSupplyDto } from './dto/update-general-supply.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { SupplierService } from './supplier.service';
import { StockMovementService } from './stock-movement.service';
import { AccountingOutboxService } from '../accounting/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/accounting-outbox-processor.service';
import {
  processInventoryOutboxAfterCommit,
  recordInventoryAdjustmentInTx,
  resolveInventoryAdjustmentDecision,
} from './inventory-adjustment.helper';
import { rethrowPrismaError } from '../../common/utils/prisma-error.util';
import {
  computeStockStatus,
  StockStatus,
} from '../../common/utils/stock-status.util';

export type { StockStatus };

@Injectable()
export class GeneralSupplyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supplierService: SupplierService,
    @Optional() private readonly stockMovementService?: StockMovementService,
    @Optional()
    private readonly accountingOutboxService?: AccountingOutboxService,
    @Optional()
    private readonly accountingOutboxProcessor?: AccountingOutboxProcessorService,
  ) {}

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
      status: computeStockStatus(stock, minStock),
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
      await this.supplierService.ensureExists(dto.supplierId);
    }

    try {
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
    } catch (error) {
      rethrowPrismaError(error, {
        foreignKey: 'El proveedor especificado no existe.',
      });
    }
  }

  async update(id: string, dto: UpdateGeneralSupplyDto) {
    await this.findOne(id);

    if (dto.supplierId) {
      await this.supplierService.ensureExists(dto.supplierId);
    }

    try {
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
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Insumo general con ID "${id}" no encontrado.`,
        foreignKey: 'El proveedor especificado no existe.',
      });
    }
  }

  async adjustStock(id: string, dto: AdjustStockDto, userId?: string) {
    let txResult: { updated: any; outboxEventId: string | null };
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.general_supply
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const current = await tx.generalSupply.findUnique({
          where: { id },
        });

        if (!current) {
          throw new NotFoundException(
            `Insumo general con ID "${id}" no encontrado.`,
          );
        }

        const currentStock = Number(current.stock ?? 0);
        const currentUnitCost = Number(current.costPrice ?? 0);

        const decision = resolveInventoryAdjustmentDecision({
          itemType: 'general_supply',
          itemName: current.name,
          currentStock,
          currentUnitCost,
          dto,
        });

        const updated = await tx.generalSupply.update({
          where: { id },
          data: {
            stock: decision.nextStock,
            ...(decision.updatedUnitCost !== undefined
              ? { costPrice: decision.updatedUnitCost }
              : {}),
            updatedAt: new Date(),
          },
          include: { supplier: true },
        });

        const { outboxEventId } = await recordInventoryAdjustmentInTx({
          tx,
          itemType: 'general_supply',
          itemId: current.id,
          itemName: current.name,
          unit: current.unit || 'un',
          currentStock,
          decision,
          userId,
          stockMovementService: this.stockMovementService,
          accountingOutboxService: this.accountingOutboxService,
        });

        return { updated, outboxEventId };
      });
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Insumo general con ID "${id}" no encontrado.`,
        checkConstraint: 'El stock de insumo general no puede resultar negativo.',
      });
    }

    const accounting = await processInventoryOutboxAfterCommit(
      txResult.outboxEventId,
      this.accountingOutboxProcessor,
    );

    return {
      ...this.mapGeneralSupply(txResult.updated),
      ...(txResult.outboxEventId ? accounting : {}),
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.generalSupply.delete({ where: { id } });
      return {
        success: true,
        message: 'Insumo general eliminado correctamente.',
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Insumo general con ID "${id}" no encontrado.`,
        foreignKeyStatus: 'conflict',
      });
    }
  }
}
