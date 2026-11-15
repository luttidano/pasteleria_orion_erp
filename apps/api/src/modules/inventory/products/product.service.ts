import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateProductDto } from '../dto/create-product.dto';
import { UpdateProductDto } from '../dto/update-product.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { StockMovementService } from '../stock/stock-movement.service';
import { AccountingOutboxService } from '../../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../../accounting/outbox/accounting-outbox-processor.service';
import {
  processInventoryOutboxAfterCommit,
  recordInventoryAdjustmentInTx,
  resolveInventoryAdjustmentDecision,
} from '../stock/inventory-adjustment.helper';
import { rethrowPrismaError } from '../../../common/utils/prisma-error.util';
import {
  computeStockStatus,
  StockStatus,
} from '../../../common/utils/stock-status.util';

export type { StockStatus };

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly stockMovementService?: StockMovementService,
    @Optional()
    private readonly accountingOutboxService?: AccountingOutboxService,
    @Optional()
    private readonly accountingOutboxProcessor?: AccountingOutboxProcessorService,
  ) {}

  private mapProduct(item: any) {
    const stock = Number(item.stock);
    const minStock = Number(item.minStock ?? item.min_stock ?? 0);
    return {
      id: item.id,
      name: item.name,
      description: item.description,
      productType: item.productType || item.product_type,
      stock,
      minStock,
      unit: item.unit,
      salePrice: Number(item.salePrice ?? item.sale_price ?? 0),
      costPrice:
        item.costPrice !== null && item.costPrice !== undefined
          ? Number(item.costPrice)
          : item.cost_price
            ? Number(item.cost_price)
            : 0,
      recipeId: item.recipeId || item.recipe_id,
      recipeName: item.recipe?.name,
      supplierId: item.supplierId || item.supplier_id,
      supplierName: item.supplier?.name,
      categoryId: item.categoryId || item.category_id,
      categoryName: item.categoryRef?.name,
      imageUrl: item.imageUrl || item.image_url,
      icon: item.icon || '🧁',
      status: computeStockStatus(stock, minStock),
      isActive: Boolean(item.isActive ?? item.is_active ?? true),
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
    };
  }

  async findAll(
    productType?: 'manufactured' | 'resale',
    includeInactive = false,
  ) {
    const where: any = {};
    if (productType) {
      where.productType = productType;
    }
    if (!includeInactive) {
      where.isActive = true;
    }
    const items = await this.prisma.product.findMany({
      where,
      include: {
        recipe: {
          select: { name: true },
        },
        supplier: {
          select: { name: true },
        },
        categoryRef: {
          select: { name: true },
        },
      },
      orderBy: { name: 'asc' },
    });
    return items.map((item) => this.mapProduct(item));
  }

  async findOne(id: string) {
    const item = await this.prisma.product.findUnique({
      where: { id },
      include: {
        recipe: {
          select: { name: true },
        },
        supplier: {
          select: { name: true },
        },
        categoryRef: {
          select: { name: true },
        },
      },
    });

    if (!item) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return this.mapProduct(item);
  }

  async create(dto: CreateProductDto) {
    if (dto.productType === 'manufactured' && !dto.recipeId) {
      throw new BadRequestException(
        'Para un producto de elaboración propia, la asignación de receta es obligatoria',
      );
    }

    try {
      const created = await this.prisma.product.create({
        data: {
          name: dto.name,
          productType: dto.productType,
          stock: dto.stock,
          minStock: dto.minStock,
          unit: dto.unit,
          salePrice: dto.salePrice,
          costPrice: dto.costPrice ?? 0,
          recipeId: dto.productType === 'manufactured' ? dto.recipeId : null,
          supplierId:
            dto.productType === 'resale' ? dto.supplierId || null : null,
          categoryId: dto.categoryId || null,
          description: dto.description,
          imageUrl: dto.imageUrl,
          icon: dto.icon || '🧁',
        },
      });
      return await this.findOne(created.id);
    } catch (error) {
      rethrowPrismaError(error, {
        foreignKey: 'La receta, proveedor o categoría especificada no existe.',
      });
    }
  }

  async update(id: string, dto: UpdateProductDto) {
    const current = await this.findOne(id);
    const targetType = dto.productType ?? current.productType;
    const targetRecipeId =
      dto.recipeId !== undefined ? dto.recipeId : current.recipeId;

    if (targetType === 'manufactured' && !targetRecipeId) {
      throw new BadRequestException(
        'Para un producto de elaboración propia, la asignación de una receta es obligatoria',
      );
    }

    try {
      await this.prisma.product.update({
        where: { id },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.productType !== undefined && { productType: dto.productType }),
          ...(dto.stock !== undefined && { stock: dto.stock }),
          ...(dto.minStock !== undefined && { minStock: dto.minStock }),
          ...(dto.unit !== undefined && { unit: dto.unit }),
          ...(dto.salePrice !== undefined && { salePrice: dto.salePrice }),
          ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
          ...(dto.recipeId !== undefined && { recipeId: dto.recipeId || null }),
          ...(dto.supplierId !== undefined && {
            supplierId: dto.supplierId || null,
          }),
          ...(dto.categoryId !== undefined && {
            categoryId: dto.categoryId || null,
          }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
          ...(dto.icon !== undefined && { icon: dto.icon }),
        },
      });
      return await this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Producto con ID ${id} no encontrado.`,
        foreignKey: 'La receta, proveedor o categoría especificada no existe.',
      });
    }
  }

  async adjustStock(id: string, dto: AdjustStockDto, userId?: string) {
    let txResult: { updated: any; outboxEventId: string | null };
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.product
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const current = await tx.product.findUnique({
          where: { id },
        });

        if (!current) {
          throw new NotFoundException(`Producto con ID ${id} no encontrado`);
        }

        const currentStock = Number(current.stock ?? 0);
        const currentUnitCost = Number(current.costPrice ?? 0);

        const decision = resolveInventoryAdjustmentDecision({
          itemType: 'product',
          itemName: current.name,
          currentStock,
          currentUnitCost,
          dto,
        });

        const updated = await tx.product.update({
          where: { id },
          data: {
            stock: decision.nextStock,
            ...(decision.updatedUnitCost !== undefined
              ? { costPrice: decision.updatedUnitCost }
              : {}),
            updatedAt: new Date(),
          },
          include: {
            recipe: { select: { name: true } },
            supplier: { select: { name: true } },
            categoryRef: { select: { name: true } },
          },
        });

        const { outboxEventId } = await recordInventoryAdjustmentInTx({
          tx,
          itemType: 'product',
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
        notFound: `Producto con ID ${id} no encontrado.`,
        checkConstraint: 'El stock del producto no puede resultar negativo.',
      });
    }

    const accounting = await processInventoryOutboxAfterCommit(
      txResult.outboxEventId,
      this.accountingOutboxProcessor,
    );

    return {
      ...this.mapProduct(txResult.updated),
      ...(txResult.outboxEventId ? accounting : {}),
    };
  }

  async remove(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { posSaleItems: true },
        },
      },
    });

    if (!product) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado.`);
    }

    if (product._count.posSaleItems > 0) {
      await this.prisma.product.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
      return {
        success: true,
        id,
        archived: true,
        message:
          'Producto archivado correctamente ya que cuenta con historial de ventas.',
      };
    }

    try {
      await this.prisma.product.delete({ where: { id } });
      return { success: true, id, archived: false };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Producto con ID ${id} no encontrado.`,
        foreignKeyStatus: 'conflict',
        foreignKey: 'No se puede eliminar este producto porque está en uso.',
      });
    }
  }
}
