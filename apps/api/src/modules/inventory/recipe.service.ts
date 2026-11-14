import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { ProduceRecipeDto } from './dto/produce-recipe.dto';
import { CategoryService } from './category.service';
import { RecipeProductionService } from './recipe-production.service';
import { toBaseUnits } from '../../common/utils/unit-converter';
import { rethrowPrismaError } from '../../common/utils/prisma-error.util';

@Injectable()
export class RecipeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categoryService: CategoryService,
    @Optional()
    private readonly recipeProductionService?: RecipeProductionService,
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
   * Orden de producción: delega la ejecución de tandas de horneado y deducción atómica
   * a RecipeProductionService (SRP).
   */
  async produce(id: string, dto: ProduceRecipeDto, userId?: string) {
    if (!this.recipeProductionService) {
      throw new BadRequestException('Servicio de producción no configurado.');
    }
    return this.recipeProductionService.produce(id, dto, userId);
  }
}
