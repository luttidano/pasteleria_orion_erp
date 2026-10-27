import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

// Normalizador de unidades para comparar stock vs receta
function toBaseUnits(qty: number, unit: string): { value: number; type: 'mass' | 'volume' | 'count' } {
  const u = (unit || '').toLowerCase().trim();
  if (['kg', 'kilos', 'kilogramo', 'kilogramos'].includes(u)) return { value: qty * 1000, type: 'mass' }; // a gramos
  if (['g', 'gr', 'gramo', 'gramos'].includes(u)) return { value: qty, type: 'mass' };
  if (['l', 'lt', 'litro', 'litros'].includes(u)) return { value: qty * 1000, type: 'volume' }; // a ml
  if (['ml', 'cc', 'mililitro', 'mililitros'].includes(u)) return { value: qty, type: 'volume' };
  return { value: qty, type: 'count' }; // unidades, bandejas
}

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

    return {
      id: recipe.id,
      name: recipe.name,
      description: recipe.description,
      yieldServings: recipe.yieldServings ?? recipe.yield_servings ?? 1,
      category: recipe.categoryRef?.name || recipe.category || 'Pastelería',
      categoryId: recipe.categoryId || recipe.category_id,
      imageUrl: recipe.imageUrl ?? recipe.image_url,
      ingredients: formattedIngredients,
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
}
