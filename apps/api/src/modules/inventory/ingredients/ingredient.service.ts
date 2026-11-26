import {
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CreateIngredientDto } from '../dto/create-ingredient.dto';
import { UpdateIngredientDto } from '../dto/update-ingredient.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { CategoryService } from '../categories/category.service';
import { StockMovementService } from '../stock/stock-movement.service';
import { AccountingOutboxService } from '../../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../../accounting/outbox/accounting-outbox-processor.service';
import {
  processInventoryOutboxAfterCommit,
  recordInventoryAdjustmentInTx,
  resolveInventoryAdjustmentDecision,
} from '../stock/inventory-adjustment.helper';
import { rethrowPrismaError } from '../../../common/utils/prisma-error.util';
import { roundQuantity } from '../../../common/utils/money.util';
import {
  computeStockStatus,
  StockStatus,
} from '../../../common/utils/stock-status.util';

export type { StockStatus };

@Injectable()
export class IngredientService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    @Optional() private readonly stockMovementService?: StockMovementService,
    @Optional()
    private readonly accountingOutboxService?: AccountingOutboxService,
    @Optional()
    private readonly accountingOutboxProcessor?: AccountingOutboxProcessorService,
  ) {}

  private mapIngredient(item: any) {
    const stock = roundQuantity(Number(item.stock ?? 0));
    const minStock = roundQuantity(Number(item.minStock ?? item.min_stock ?? 0));
    return {
      id: item.id,
      name: item.name,
      categoryId: item.categoryId || item.category_id,
      category: item.categoryRef?.name || item.category || 'General',
      stock,
      minStock,
      unit: item.unit,
      price:
        item.price !== null && item.price !== undefined ? Number(item.price) : 0,
      icon: item.icon,
      imageUrl: item.imageUrl || item.image_url,
      description: item.description,
      status: computeStockStatus(stock, minStock),
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
    };
  }

  async findAll() {
    const items = await this.prisma.ingredient.findMany({
      include: { categoryRef: true },
      orderBy: { name: 'asc' },
    });
    return items.map((item) => this.mapIngredient(item));
  }

  async findOne(id: string) {
    const item = await this.prisma.ingredient.findUnique({
      where: { id },
      include: { categoryRef: true },
    });

    if (!item) {
      throw new NotFoundException(`Ingrediente con ID ${id} no encontrado`);
    }

    return this.mapIngredient(item);
  }

  async create(dto: CreateIngredientDto) {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.categoryService.resolveCategoryIdInTx(
          tx,
          dto.categoryId,
          dto.category,
          'ingredient',
        );

        return tx.ingredient.create({
          data: {
            name: dto.name,
            categoryId: categoryId || null,
            stock: roundQuantity(Number(dto.stock)),
            minStock: roundQuantity(Number(dto.minStock)),
            unit: dto.unit,
            price: dto.price ?? 0,
            icon: dto.icon,
            imageUrl: dto.imageUrl,
            description: dto.description,
          },
          include: { categoryRef: true },
        });
      });

      return this.mapIngredient(created);
    } catch (error) {
      rethrowPrismaError(error, {
        foreignKey: 'La categoría especificada no existe.',
      });
    }
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.findOne(id);

    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.categoryService.resolveCategoryIdInTx(
          tx,
          (dto as any).categoryId,
          dto.category,
          'ingredient',
        );

        const updateData: Record<string, any> = {};
        if (dto.name !== undefined) updateData.name = dto.name;
        if (categoryId !== undefined) updateData.categoryId = categoryId;
        if (dto.minStock !== undefined) {
          updateData.minStock = roundQuantity(Number(dto.minStock));
        }
        if (dto.unit !== undefined) updateData.unit = dto.unit;
        if (dto.price !== undefined) updateData.price = dto.price;
        if (dto.icon !== undefined) updateData.icon = dto.icon;
        if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
        if (dto.description !== undefined)
          updateData.description = dto.description;

        return tx.ingredient.update({
          where: { id },
          data: updateData,
          include: { categoryRef: true },
        });
      });

      return this.mapIngredient(updated);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Ingrediente con ID ${id} no encontrado.`,
        foreignKey: 'La categoría especificada no existe.',
      });
    }
  }

  async adjustStock(id: string, dto: AdjustStockDto, userId?: string) {
    let txResult: { updated: any; outboxEventId: string | null };
    try {
      txResult = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.ingredient
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const current = await tx.ingredient.findUnique({
          where: { id },
        });

        if (!current) {
          throw new NotFoundException(`Ingrediente con ID ${id} no encontrado`);
        }

        const currentStock = Number(current.stock);
        const currentUnitCost = Number(current.price ?? 0);

        const decision = resolveInventoryAdjustmentDecision({
          itemType: 'ingredient',
          itemName: current.name,
          currentStock,
          currentUnitCost,
          dto,
        });

        const updated = await tx.ingredient.update({
          where: { id },
          data: {
            stock: decision.nextStock,
            ...(decision.updatedUnitCost !== undefined
              ? { price: decision.updatedUnitCost }
              : {}),
            updatedAt: new Date(),
          },
          include: { categoryRef: true },
        });

        const { outboxEventId } = await recordInventoryAdjustmentInTx({
          tx,
          itemType: 'ingredient',
          itemId: current.id,
          itemName: current.name,
          unit: current.unit || 'kg',
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
        notFound: `Ingrediente con ID ${id} no encontrado.`,
        checkConstraint: 'El stock del ingrediente no puede resultar negativo.',
      });
    }

    const accounting = await processInventoryOutboxAfterCommit(
      txResult.outboxEventId,
      this.accountingOutboxProcessor,
    );

    return {
      ...this.mapIngredient(txResult.updated),
      ...(txResult.outboxEventId ? accounting : {}),
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.ingredient.delete({ where: { id } });
      return { success: true, id };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Ingrediente con ID ${id} no encontrado.`,
        foreignKeyStatus: 'conflict',
        foreignKey:
          'No se puede eliminar este ingrediente porque está asignado a una o más recetas.',
      });
    }
  }
}
