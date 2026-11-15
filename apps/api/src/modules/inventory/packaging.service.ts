import {
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { StockMovementService } from './stock-movement.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import {
  processInventoryOutboxAfterCommit,
  recordInventoryAdjustmentInTx,
  resolveInventoryAdjustmentDecision,
} from './inventory-adjustment.helper';
import { rethrowPrismaError } from '../../common/utils/prisma-error.util';
import { computeStockStatus } from '../../common/utils/stock-status.util';

@Injectable()
export class PackagingService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly stockMovementService?: StockMovementService,
    @Optional()
    private readonly accountingOutboxService?: AccountingOutboxService,
    @Optional()
    private readonly accountingOutboxProcessor?: AccountingOutboxProcessorService,
  ) {}

  private mapPackaging(p: any) {
    const stock = Number(p.stock || 0);
    const minStock = Number(p.minStock ?? p.min_stock ?? 0);
    const status = computeStockStatus(stock, minStock);

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
      salePrice:
        p.salePrice !== null && p.salePrice !== undefined
          ? Number(p.salePrice)
          : 0,
      isActive: Boolean(p.isActive ?? p.is_active ?? true),
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

  async findAll(type?: string, includeInactive = false) {
    const where: any = {};
    if (type && (type === 'primario' || type === 'secundario')) {
      where.packageType = type;
    }
    if (!includeInactive) {
      where.isActive = true;
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
    try {
      const created = await this.prisma.packaging.create({
        data: {
          name: dto.name,
          packageType: dto.packageType,
          category: dto.category,
          stock: dto.stock,
          minStock: dto.minStock,
          unit: dto.unit || 'un',
          costPrice: dto.costPrice ?? 0,
          salePrice: dto.salePrice ?? 0,
          supplierId: dto.supplierId || null,
          icon: dto.icon || '📦',
          description: dto.description,
        },
        include: { supplier: true },
      });

      return this.mapPackaging(created);
    } catch (error) {
      rethrowPrismaError(error, {
        foreignKey: 'El proveedor especificado no existe.',
      });
    }
  }

  async update(id: string, dto: UpdatePackagingDto) {
    await this.findOne(id);

    try {
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
          ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
          ...(dto.supplierId !== undefined && {
            supplierId: dto.supplierId || null,
          }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
          ...(dto.description !== undefined && { description: dto.description }),
          updatedAt: new Date(),
        },
        include: { supplier: true },
      });

      return this.mapPackaging(updated);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Empaque con ID "${id}" no encontrado.`,
        foreignKey: 'El proveedor especificado no existe.',
      });
    }
  }

  async adjustStock(
    id: string,
    input: number | AdjustStockDto,
    userId?: string,
  ) {
    const dto: AdjustStockDto =
      typeof input === 'number'
        ? { delta: input }
        : input ?? ({ delta: Number.NaN } as AdjustStockDto);

    let txResult: { updated: any; outboxEventId: string | null };
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.packaging
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const current = await tx.packaging.findUnique({
          where: { id },
        });

        if (!current) {
          throw new NotFoundException(`Empaque con ID "${id}" no encontrado.`);
        }

        const currentStock = Number(current.stock ?? 0);
        const currentUnitCost = Number(current.costPrice ?? 0);

        const decision = resolveInventoryAdjustmentDecision({
          itemType: 'packaging',
          itemName: current.name,
          currentStock,
          currentUnitCost,
          dto,
        });

        const updated = await tx.packaging.update({
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
          itemType: 'packaging',
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
        notFound: `Empaque con ID "${id}" no encontrado.`,
        checkConstraint: 'El stock de empaque no puede resultar negativo.',
      });
    }

    const accounting = await processInventoryOutboxAfterCommit(
      txResult.outboxEventId,
      this.accountingOutboxProcessor,
    );

    return {
      ...this.mapPackaging(txResult.updated),
      ...(txResult.outboxEventId ? accounting : {}),
    };
  }

  async remove(id: string) {
    const packaging = await this.prisma.packaging.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posSaleItems: true },
        },
      },
    });

    if (!packaging) {
      throw new NotFoundException(`Empaque con ID "${id}" no encontrado.`);
    }

    if (packaging._count.posSaleItems > 0) {
      await this.prisma.packaging.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
      return {
        success: true,
        id,
        archived: true,
        message: 'Empaque archivado correctamente ya que cuenta con historial de ventas.',
      };
    }

    try {
      await this.prisma.packaging.delete({ where: { id } });
      return {
        success: true,
        id,
        archived: false,
        message: 'Empaque eliminado correctamente.',
      };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Empaque con ID "${id}" no encontrado.`,
        foreignKeyStatus: 'conflict',
        foreignKey: 'El empaque no puede eliminarse porque tiene registros asociados.',
      });
    }
  }
}
