import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { ProduceRecipeDto } from './dto/produce-recipe.dto';
import { CategoryService } from './category.service';
import {
  computeWeightedAverageUnitCost,
  StockMovementService,
} from './stock-movement.service';
import { processInventoryOutboxAfterCommit } from './inventory-adjustment.helper';
import { AccountingOutboxService } from '../accounting/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/accounting-outbox-processor.service';
import {
  convertToTargetUnit,
  toBaseUnits,
} from '../../common/utils/unit-converter';
import { rethrowPrismaError } from '../../common/utils/prisma-error.util';
import { roundMoney, roundQuantity } from '../../common/utils/money.util';

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    @Optional() private readonly stockMovementService?: StockMovementService,
    @Optional()
    private readonly accountingOutboxService?: AccountingOutboxService,
    @Optional()
    private readonly accountingOutboxProcessor?: AccountingOutboxProcessorService,
  ) {}

  // Enriquecer receta con cálculo de si es posible producir y cuántas tandas
  private enrichWithAvailability(recipe: any) {
    let canProduce = true;
    let minRatio = Infinity;
    const missingIngredients: Array<{
      name: string;
      required: number;
      available: number;
      unit: string;
      incompatibleUnits?: boolean;
    }> = [];

    const formattedIngredients = (recipe.ingredients || []).map((ri: any) => {
      const ing = ri.ingredients || ri.ingredient || {};
      const stock = Number(ing.stock ?? 0);
      const stockUnit = ing.unit || 'kg';
      const quantity = Number(ri.quantity);
      const unit = ri.unit;

      const reqNormalized = toBaseUnits(quantity, unit);
      const stockNormalized = toBaseUnits(stock, stockUnit);

      if (
        reqNormalized &&
        stockNormalized &&
        reqNormalized.type === stockNormalized.type &&
        reqNormalized.value > 0
      ) {
        const ratio = stockNormalized.value / reqNormalized.value;
        if (ratio < minRatio) minRatio = ratio;

        if (stockNormalized.value < reqNormalized.value) {
          canProduce = false;
          missingIngredients.push({
            name: ing.name || 'Insumo',
            required: quantity,
            available: stock,
            unit,
          });
        }
      } else {
        canProduce = false;
        minRatio = 0;
        missingIngredients.push({
          name: ing.name || 'Insumo',
          required: quantity,
          available: stock,
          unit,
          incompatibleUnits: true,
        });
      }

      return {
        id: ri.id,
        ingredientId: ri.ingredientId || ri.ingredient_id,
        ingredientName: ing.name || 'Insumo',
        quantity,
        unit,
        availableStock: stock,
        stockUnit,
      };
    });

    const maxBatches =
      canProduce &&
      minRatio !== Infinity &&
      (recipe.ingredients || []).length > 0
        ? Math.floor(minRatio)
        : 0;

    const products = (recipe.products || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      stock: Number(p.stock ?? 0),
      unit: p.unit || 'un',
      salePrice: p.salePrice ? Number(p.salePrice) : 0,
      productType: p.productType,
    }));

    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      yieldServings: recipe.yieldServings ?? recipe.yield_servings ?? 1,
      category: recipe.categoryRef?.name || recipe.category || 'Pastelería',
      categoryId: recipe.categoryId || recipe.category_id,
      imageUrl: recipe.imageUrl ?? recipe.image_url,
      ingredients: formattedIngredients,
      products,
      canProduce: formattedIngredients.length > 0 ? canProduce : false,
      maxBatches,
      missingIngredients,
      isActive: Boolean(recipe.isActive ?? recipe.is_active ?? true),
      createdAt: recipe.createdAt ?? recipe.created_at,
      updatedAt: recipe.updatedAt ?? recipe.updated_at,
    };
  }

  async findAll(includeInactive = false) {
    const where = includeInactive ? {} : { isActive: true };
    const recipes = await this.prisma.recipe.findMany({
      where,
      include: {
        categoryRef: true,
        ingredients: {
          include: {
            ingredients: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            stock: true,
            unit: true,
            salePrice: true,
            productType: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });
    return recipes.map((r) => this.enrichWithAvailability(r));
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        categoryRef: true,
        ingredients: {
          include: {
            ingredients: true,
          },
        },
        products: {
          select: {
            id: true,
            name: true,
            stock: true,
            unit: true,
            salePrice: true,
            productType: true,
          },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Receta con ID ${id} no encontrada`);
    }

    return this.enrichWithAvailability(recipe);
  }

  async create(createRecipeDto: CreateRecipeDto) {
    const { ingredients, ...recipeData } = createRecipeDto;

    try {
      const newRecipe = await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.categoryService.resolveCategoryIdInTx(
          tx,
          recipeData.categoryId,
          recipeData.category,
          'recipe',
        );

        return tx.recipe.create({
          data: {
            name: recipeData.name,
            description: recipeData.description,
            yieldServings: recipeData.yieldServings || 1,
            categoryId,
            imageUrl: recipeData.imageUrl,
            ingredients: {
              create: ingredients.map((item) => ({
                ingredientId: item.ingredientId,
                quantity: item.quantity,
                unit: item.unit,
              })),
            },
          },
          include: {
            categoryRef: true,
            ingredients: {
              include: {
                ingredients: true,
              },
            },
            products: {
              select: {
                id: true,
                name: true,
                stock: true,
                unit: true,
                salePrice: true,
                productType: true,
              },
            },
          },
        });
      });

      return this.enrichWithAvailability(newRecipe);
    } catch (error) {
      rethrowPrismaError(error, {
        unique: 'La receta ya existe o tiene ingredientes duplicados.',
        foreignKey: 'Alguno de los ingredientes o la categoría especificada no existe.',
      });
    }
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto) {
    await this.findOne(id);
    const { ingredients, ...recipeData } = updateRecipeDto;

    try {
      await this.prisma.$transaction(async (tx) => {
        const categoryId = await this.categoryService.resolveCategoryIdInTx(
          tx,
          recipeData.categoryId,
          recipeData.category,
          'recipe',
        );

        const updatePayload: Record<string, any> = {};
        if (recipeData.name !== undefined) updatePayload.name = recipeData.name;
        if (recipeData.description !== undefined)
          updatePayload.description = recipeData.description;
        if (recipeData.yieldServings !== undefined)
          updatePayload.yieldServings = recipeData.yieldServings;
        if (categoryId !== undefined) updatePayload.categoryId = categoryId;
        if (recipeData.imageUrl !== undefined)
          updatePayload.imageUrl = recipeData.imageUrl;

        await tx.recipe.update({
          where: { id },
          data: updatePayload,
        });

        if (ingredients) {
          await tx.recipeIngredient.deleteMany({ where: { recipeId: id } });
          await tx.recipeIngredient.createMany({
            data: ingredients.map((item) => ({
              recipeId: id,
              ingredientId: item.ingredientId,
              quantity: item.quantity,
              unit: item.unit,
            })),
          });
        }
      });

      return await this.findOne(id);
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Receta con ID ${id} no encontrada.`,
        unique: 'La receta contiene ingredientes duplicados.',
        foreignKey: 'Alguno de los ingredientes o la categoría especificada no existe.',
      });
    }
  }

  async remove(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!recipe) {
      throw new NotFoundException(`Receta con ID ${id} no encontrada.`);
    }

    if (recipe._count.products > 0) {
      await this.prisma.recipe.update({
        where: { id },
        data: { isActive: false, updatedAt: new Date() },
      });
      return {
        message:
          'Receta archivada correctamente ya que tiene productos vinculados.',
        id,
        archived: true,
      };
    }

    try {
      await this.prisma.recipe.delete({ where: { id } });
      return { message: 'Receta eliminada correctamente', id, archived: false };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Receta con ID ${id} no encontrada.`,
        foreignKeyStatus: 'conflict',
        foreignKey: 'No se puede eliminar la receta porque tiene dependencias activas.',
      });
    }
  }

  /**
   * Orden de producción ACID:
   * - Lectura de receta, ingredientes y producto objetivo dentro de `$transaction`.
   * - Bloqueo pesimista `FOR UPDATE` ordenado por UUID de ingrediente + producto.
   * - Validación estricta de ingredientes no vacíos y unidades dimensionalmente compatibles.
   * - Descuento condicional atómico (`decrement`) e incremento atómico (`increment`).
   */
  async produce(id: string, dto: ProduceRecipeDto, userId?: string) {
    if (!Number.isFinite(dto.quantity) || dto.quantity <= 0) {
      throw new BadRequestException(
        'La cantidad de tandas a producir debe ser mayor a 0.',
      );
    }

    let txOutput: {
      response: any;
      outboxEventId: string | null;
    };

    try {
      txOutput = await this.prisma.$transaction(async (tx) => {
        const recipe = await tx.recipe.findUnique({
          where: { id },
          include: {
            ingredients: {
              include: {
                ingredients: true,
              },
            },
            products: true,
          },
        });

        if (!recipe) {
          throw new NotFoundException(`Receta con ID "${id}" no encontrada.`);
        }

        if (!recipe.ingredients || recipe.ingredients.length === 0) {
          throw new BadRequestException(
            'Esta receta no tiene materias primas configuradas y no puede producir stock.',
          );
        }

        if (!recipe.products || recipe.products.length === 0) {
          throw new BadRequestException(
            'Esta receta no tiene ningún producto comercial de elaboración propia asignado en el catálogo. Asigna o crea un producto para esta receta primero.',
          );
        }

        const targetProduct = dto.productId
          ? recipe.products.find((p) => p.id === dto.productId)
          : recipe.products[0];

        if (!targetProduct) {
          throw new BadRequestException(
            'El producto comercial seleccionado no está asociado a esta receta.',
          );
        }

        const sortedIngredientIds = Array.from(
          new Set(recipe.ingredients.map((ri) => ri.ingredientId)),
        ).sort();

        if (sortedIngredientIds.length === 0) {
          throw new BadRequestException(
            'Esta receta no tiene ingredientes válidos para descontar.',
          );
        }

        // Adquirir bloqueos pesimistas ordenados por ID para evitar deadlocks y sobrescrituras
        await tx.$queryRaw`
          SELECT id
          FROM public.ingredient
          WHERE id IN (${Prisma.join(sortedIngredientIds.map((ingId) => Prisma.sql`${ingId}::uuid`))})
          ORDER BY id
          FOR UPDATE
        `;

        await tx.$queryRaw`
          SELECT id
          FROM public.product
          WHERE id = ${targetProduct.id}::uuid
          FOR UPDATE
        `;

        const lockedIngredients = await tx.ingredient.findMany({
          where: { id: { in: sortedIngredientIds } },
          select: { id: true, name: true, stock: true, unit: true, price: true },
        });
        const ingredientMap = new Map(lockedIngredients.map((i) => [i.id, i]));

        const lockedProduct =
          typeof tx.product.findUnique === 'function'
            ? await tx.product.findUnique({
                where: { id: targetProduct.id },
                select: { id: true, stock: true, costPrice: true },
              })
            : null;

        const requiredByIngredient = new Map<
          string,
          {
            name: string;
            requiredQty: number;
            stockUnit: string;
            availableStock: number;
            unitCost: number;
          }
        >();

        for (const ri of recipe.ingredients) {
          const ing = ingredientMap.get(ri.ingredientId) ?? ri.ingredients;
          if (!ing) {
            throw new BadRequestException(
              `El insumo asociado (${ri.ingredientId}) no existe en bodega.`,
            );
          }

          const stockUnit = ing.unit || 'kg';
          const recipeQty = Number(ri.quantity) * dto.quantity;
          const converted = convertToTargetUnit(recipeQty, ri.unit, stockUnit);

          if (converted === null || !Number.isFinite(converted) || converted <= 0) {
            throw new BadRequestException(
              `Unidades incompatibles para el insumo "${ing.name}": receta en "${ri.unit}" y bodega en "${stockUnit}".`,
            );
          }

          const existingAgg = requiredByIngredient.get(ing.id);
          const nextReq = roundQuantity(
            (existingAgg?.requiredQty ?? 0) + converted,
          );
          requiredByIngredient.set(ing.id, {
            name: ing.name,
            requiredQty: nextReq,
            stockUnit,
            availableStock: Number(ing.stock ?? 0),
            unitCost: roundMoney(Number(ing.price ?? 0)),
          });
        }

        for (const ingId of sortedIngredientIds) {
          const req = requiredByIngredient.get(ingId)!;
          if (req.availableStock + 1e-9 < req.requiredQty) {
            throw new ConflictException(
              `Stock insuficiente para el insumo "${req.name}". Se requieren ${req.requiredQty.toFixed(3)} ${req.stockUnit}, pero solo hay ${req.availableStock.toFixed(3)} ${req.stockUnit} en bodega.`,
            );
          }
        }

        const productionId = randomUUID();
        const missingCostIngredients: Array<{
          ingredientId: string;
          name: string;
          deductedQty: number;
        }> = [];
        let totalProductionCost = 0;

        const deductedIngredients: Array<{
          ingredientId: string;
          name: string;
          deducted: number;
          newStock: number;
          unit: string;
          cost: number;
        }> = [];

        for (const ingId of sortedIngredientIds) {
          const req = requiredByIngredient.get(ingId)!;
          const deductAmount = req.requiredQty;

          const updateResult = await tx.ingredient.updateMany({
            where: {
              id: ingId,
              stock: { gte: deductAmount },
            },
            data: {
              stock: { decrement: deductAmount },
              updatedAt: new Date(),
            },
          });

          if (updateResult.count === 0) {
            throw new ConflictException(
              `Stock insuficiente o modificado concurrentemente para el insumo "${req.name}".`,
            );
          }

          const expectedRemaining = Math.max(
            0,
            roundQuantity(req.availableStock - deductAmount),
          );
          const lineCost = roundMoney(deductAmount * req.unitCost);
          totalProductionCost = roundMoney(totalProductionCost + lineCost);

          if (req.unitCost <= 0) {
            missingCostIngredients.push({
              ingredientId: ingId,
              name: req.name,
              deductedQty: deductAmount,
            });
          }

          if (this.stockMovementService) {
            await this.stockMovementService.recordInTx(tx, {
              itemType: 'ingredient',
              itemId: ingId,
              itemName: req.name,
              movementType: 'production_out',
              quantityDelta: -deductAmount,
              unit: req.stockUnit,
              stockBefore: req.availableStock,
              stockAfter: expectedRemaining,
              unitCost: req.unitCost,
              totalCost: lineCost,
              referenceType: 'recipe_production',
              referenceId: productionId,
              reason: `Producción receta "${recipe.name}" (${dto.quantity} tanda/s)`,
              createdById: userId,
            });
          }

          deductedIngredients.push({
            ingredientId: ingId,
            name: req.name,
            deducted: deductAmount,
            newStock: expectedRemaining,
            unit: req.stockUnit,
            cost: lineCost,
          });
        }

        const unitsToAdd = roundQuantity(
          dto.producedUnits !== undefined && dto.producedUnits > 0
            ? dto.producedUnits
            : Number(recipe.yieldServings || 1) * dto.quantity,
        );

        const prevProdStock = Number(
          lockedProduct?.stock ?? targetProduct.stock ?? 0,
        );
        const prevProdCost = roundMoney(
          Number(lockedProduct?.costPrice ?? targetProduct.costPrice ?? 0),
        );
        const canUpdateProductCost =
          missingCostIngredients.length === 0 && totalProductionCost > 0;
        const batchUnitCost =
          totalProductionCost > 0 && unitsToAdd > 0
            ? roundMoney(totalProductionCost / unitsToAdd)
            : prevProdCost;
        const nextProdCost = canUpdateProductCost
          ? computeWeightedAverageUnitCost({
              currentStock: prevProdStock,
              currentUnitCost: prevProdCost,
              addedQuantity: unitsToAdd,
              addedNetTotalCost: totalProductionCost,
            })
          : prevProdCost;

        const updatedProduct = await tx.product.update({
          where: { id: targetProduct.id },
          data: {
            stock: { increment: unitsToAdd },
            ...(canUpdateProductCost ? { costPrice: nextProdCost } : {}),
            updatedAt: new Date(),
          },
          select: {
            id: true,
            name: true,
            stock: true,
            unit: true,
          },
        });

        const finalProdStock = roundQuantity(Number(updatedProduct.stock));

        if (this.stockMovementService) {
          await this.stockMovementService.recordInTx(tx, {
            itemType: 'product',
            itemId: updatedProduct.id,
            itemName: updatedProduct.name,
            movementType: 'production_in',
            quantityDelta: unitsToAdd,
            unit: updatedProduct.unit || 'un',
            stockBefore: prevProdStock,
            stockAfter: finalProdStock,
            unitCost: batchUnitCost,
            totalCost: totalProductionCost,
            referenceType: 'recipe_production',
            referenceId: productionId,
            reason: `Elaboración receta "${recipe.name}"`,
            createdById: userId,
          });
        }

        const outboxEvent = this.accountingOutboxService
          ? await this.accountingOutboxService.enqueueProductionInTx(tx, {
              productionId,
              recipeId: recipe.id,
              recipeName: recipe.name,
              productId: updatedProduct.id,
              productName: updatedProduct.name,
              batches: dto.quantity,
              unitsProduced: unitsToAdd,
              totalCost: totalProductionCost,
              missingCostIngredients,
              producedAt: new Date(),
            })
          : null;

        return {
          outboxEventId: outboxEvent?.id ?? null,
          response: {
            success: true,
            message: `¡Producción registrada exitosamente! Se agregaron ${unitsToAdd} ${updatedProduct.unit || 'un'} a "${updatedProduct.name}".`,
            recipe: {
              id: recipe.id,
              name: recipe.name,
              batches: dto.quantity,
            },
            product: {
              id: updatedProduct.id,
              name: updatedProduct.name,
              addedStock: unitsToAdd,
              newStock: finalProdStock,
              unit: updatedProduct.unit || 'un',
              unitCost: nextProdCost,
            },
            deductedIngredients,
            totalCost: totalProductionCost,
          },
        };
      });
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: `Receta con ID "${id}" no encontrada.`,
        checkConstraint:
          'Stock insuficiente para completar la producción solicitada.',
      });
    }

    const accounting = await processInventoryOutboxAfterCommit(
      txOutput.outboxEventId,
      this.accountingOutboxProcessor,
    );

    return {
      ...txOutput.response,
      ...(txOutput.outboxEventId ? accounting : {}),
    };
  }
}
