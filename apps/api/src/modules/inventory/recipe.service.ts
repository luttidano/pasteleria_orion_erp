import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { ProduceRecipeDto } from './dto/produce-recipe.dto';
import { toBaseUnits } from '../../common/utils/unit-converter';


@Injectable()
export class RecipeService {
  constructor(private readonly prisma: PrismaService) {}

  // Enriquecer receta con cálculo de si es posible producir y cuántas tandas
  private enrichWithAvailability(recipe: any) {
    let canProduce = true;
    let minRatio = Infinity;
    const missingIngredients: Array<{ name: string; required: number; available: number; unit: string }> = [];

    const formattedIngredients = (recipe.ingredients || []).map((ri: any) => {
      const ing = ri.ingredients || ri.ingredient || {};
      const stock = Number(ing.stock ?? 0);
      const stockUnit = ing.unit || 'kg';
      const quantity = Number(ri.quantity);
      const unit = ri.unit;

      const reqNormalized = toBaseUnits(quantity, unit);
      const stockNormalized = toBaseUnits(stock, stockUnit);

      if (reqNormalized.type === stockNormalized.type && reqNormalized.value > 0) {
        const ratio = stockNormalized.value / reqNormalized.value;
        if (ratio < minRatio) minRatio = ratio;

        if (stockNormalized.value < reqNormalized.value) {
          canProduce = false;
          missingIngredients.push({
            name: ing.name || 'Insumo',
            required: quantity,
            available: stock,
            unit: unit,
          });
        }
      } else {
        if (stock < quantity) {
          canProduce = false;
          minRatio = 0;
          missingIngredients.push({
            name: ing.name || 'Insumo',
            required: quantity,
            available: stock,
            unit: unit,
          });
        } else if (quantity > 0) {
          minRatio = Math.min(minRatio, stock / quantity);
        }
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

    const maxBatches = canProduce && minRatio !== Infinity && (recipe.ingredients || []).length > 0
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
      createdAt: recipe.createdAt ?? recipe.created_at,
      updatedAt: recipe.updatedAt ?? recipe.updated_at,
    };
  }

  async findAll() {
    const recipes = await this.prisma.recipe.findMany({
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

    let categoryId = recipeData.categoryId;
    if (!categoryId && recipeData.category) {
      const cat = await this.prisma.category.findFirst({
        where: { name: recipeData.category, type: 'recipe' },
      });
      if (cat) {
        categoryId = cat.id;
      } else {
        const newCat = await this.prisma.category.create({
          data: { name: recipeData.category, type: 'recipe' },
        });
        categoryId = newCat.id;
      }
    }

    const newRecipe = await this.prisma.$transaction(async (tx) => {
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
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto) {
    await this.findOne(id);
    const { ingredients, ...recipeData } = updateRecipeDto;

    let categoryId = recipeData.categoryId;
    if (!categoryId && recipeData.category) {
      const cat = await this.prisma.category.findFirst({
        where: { name: recipeData.category, type: 'recipe' },
      });
      if (cat) {
        categoryId = cat.id;
      } else {
        const newCat = await this.prisma.category.create({
          data: { name: recipeData.category, type: 'recipe' },
        });
        categoryId = newCat.id;
      }
    }

    const updatePayload: Record<string, any> = {};
    if (recipeData.name !== undefined) updatePayload.name = recipeData.name;
    if (recipeData.description !== undefined) updatePayload.description = recipeData.description;
    if (recipeData.yieldServings !== undefined) updatePayload.yieldServings = recipeData.yieldServings;
    if (categoryId !== undefined) updatePayload.categoryId = categoryId;
    if (recipeData.imageUrl !== undefined) updatePayload.imageUrl = recipeData.imageUrl;

    await this.prisma.$transaction(async (tx) => {
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
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.recipe.delete({ where: { id } });
    return { message: 'Receta eliminada correctamente', id };
  }

  /**
   * Orden de producción: Deduce insumos consumidos e incrementa el stock del producto de elaboración propia
   */
  async produce(id: string, dto: ProduceRecipeDto) {
    const recipe = await this.prisma.recipe.findUnique({
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

    if (!recipe.products || recipe.products.length === 0) {
      throw new BadRequestException(
        'Esta receta no tiene ningún producto comercial de elaboración propia asignado en el catálogo. Asigna o crea un producto para esta receta primero.',
      );
    }

    // Identificar el producto objetivo
    const targetProduct = dto.productId
      ? recipe.products.find((p) => p.id === dto.productId)
      : recipe.products[0];

    if (!targetProduct) {
      throw new BadRequestException('El producto comercial seleccionado no está asociado a esta receta.');
    }

    // Calcular deducciones requeridas con conversión de unidades
    const deductions: Array<{
      ingredientId: string;
      name: string;
      currentStock: number;
      deductedQty: number;
      newStock: number;
      stockUnit: string;
    }> = [];

    for (const ri of recipe.ingredients) {
      const ing = ri.ingredients;
      if (!ing) continue;

      const currentStock = Number(ing.stock ?? 0);
      const stockUnit = ing.unit || 'kg';
      const recipeQty = Number(ri.quantity) * dto.quantity;
      const recipeUnit = ri.unit;

      const reqNorm = toBaseUnits(recipeQty, recipeUnit);
      const stockNorm = toBaseUnits(1, stockUnit);

      let deductionInStockUnit = recipeQty;
      if (reqNorm.type === stockNorm.type && stockNorm.value > 0) {
        deductionInStockUnit = reqNorm.value / stockNorm.value;
      }

      if (currentStock < deductionInStockUnit) {
        throw new BadRequestException(
          `Stock insuficiente para el insumo "${ing.name}". Se requieren ${deductionInStockUnit.toFixed(2)} ${stockUnit}, pero solo hay ${currentStock.toFixed(2)} ${stockUnit} en bodega.`,
        );
      }

      deductions.push({
        ingredientId: ing.id,
        name: ing.name,
        currentStock,
        deductedQty: deductionInStockUnit,
        newStock: Math.max(0, currentStock - deductionInStockUnit),
        stockUnit,
      });
    }

    // Unidades de producto a sumar: si el usuario especificó unidades reales producidas, se usa ese valor;
    // de lo contrario, se calcula (rendimiento de la receta * cantidad de tandas)
    const unitsToAdd =
      dto.producedUnits !== undefined && dto.producedUnits > 0
        ? dto.producedUnits
        : Number(recipe.yieldServings || 1) * dto.quantity;

    // Ejecución atómica en base de datos
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Descontar stock de cada ingrediente
      for (const d of deductions) {
        await tx.ingredient.update({
          where: { id: d.ingredientId },
          data: { stock: d.newStock },
        });
      }

      // 2. Incrementar stock del producto terminado
      const currentProdStock = Number(targetProduct.stock ?? 0);
      const newProdStock = currentProdStock + unitsToAdd;
      await tx.product.update({
        where: { id: targetProduct.id },
        data: { stock: newProdStock },
      });

      return {
        success: true,
        message: `¡Producción registrada exitosamente! Se agregaron ${unitsToAdd} ${targetProduct.unit || 'un'} a "${targetProduct.name}".`,
        recipe: {
          id: recipe.id,
          name: recipe.name,
          batches: dto.quantity,
        },
        product: {
          id: targetProduct.id,
          name: targetProduct.name,
          addedStock: unitsToAdd,
          newStock: newProdStock,
          unit: targetProduct.unit || 'un',
        },
        deductedIngredients: deductions.map((d) => ({
          ingredientId: d.ingredientId,
          name: d.name,
          deducted: Number(d.deductedQty.toFixed(3)),
          newStock: Number(d.newStock.toFixed(3)),
          unit: d.stockUnit,
        })),
      };
    });

    return result;
  }
}
