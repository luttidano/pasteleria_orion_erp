import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
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
  private supabase: SupabaseClient;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {
    const supabaseUrl =
      this.configService.get<string>('VITE_SUPABASE_URL') ||
      this.configService.get<string>('SUPABASE_URL') ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      '';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY') ||
      this.configService.get<string>('VITE_SUPABASE_ANON_KEY') ||
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

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
    try {
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
    } catch {
      // Fallback a Supabase REST
      const { data, error } = await this.supabase
        .from('recipe')
        .select('*, categoryRef:category(*), ingredients:recipe_ingredient(*, ingredients:ingredient(*))')
        .order('name', { ascending: true });

      if (error) throw new BadRequestException(error.message);
      return (data || []).map((r) => this.enrichWithAvailability(r));
    }
  }

  async findOne(id: string) {
    try {
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
      if (recipe) return this.enrichWithAvailability(recipe);
    } catch {
      // Fallback
    }

    const { data, error } = await this.supabase
      .from('recipe')
      .select('*, categoryRef:category(*), ingredients:recipe_ingredient(*, ingredients:ingredient(*))')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) throw new NotFoundException(`Receta con ID ${id} no encontrada`);
    return this.enrichWithAvailability(data);
  }

  async create(createRecipeDto: CreateRecipeDto) {
    const { ingredients, ...recipeData } = createRecipeDto;

    let categoryId = recipeData.categoryId;
    if (!categoryId && recipeData.category) {
      try {
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
      } catch {
        // Fallback
      }
    }

    try {
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
                ingredients: true
              }
            }
          }
        });
      })
       
      return this.enrichWithAvailability(newRecipe);
    } catch {
      // Fallback a Supabase REST
      const { data: recipeRecord, error: recipeErr } = await this.supabase
        .from('recipe')
        .insert({
          name: recipeData.name,
          description: recipeData.description,
          yield_servings: recipeData.yieldServings || 1,
          category_id: categoryId,
          image_url: recipeData.imageUrl,
        })
        .select()
        .single();

      if (recipeErr) throw new BadRequestException(recipeErr.message);

      if (ingredients && ingredients.length > 0) {
        const rows = ingredients.map((item) => ({
          recipe_id: recipeRecord.id,
          ingredient_id: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
        }));
        await this.supabase.from('recipe_ingredient').insert(rows);
      }

      return this.findOne(recipeRecord.id);
    }
  }

  async update(id: string, updateRecipeDto: UpdateRecipeDto) {
    const { ingredients, ...recipeData } = updateRecipeDto;

    let categoryId = recipeData.categoryId;
    if (!categoryId && recipeData.category) {
      try {
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
      } catch {
        // Fallback
      }
    }

    const updatePayload: Record<string, any> = {};
    if (recipeData.name !== undefined) updatePayload.name = recipeData.name;
    if (recipeData.description !== undefined) updatePayload.description = recipeData.description;
    if (recipeData.yieldServings !== undefined) updatePayload.yieldServings = recipeData.yieldServings;
    if (categoryId !== undefined) updatePayload.categoryId = categoryId;
    if (recipeData.imageUrl !== undefined) updatePayload.imageUrl = recipeData.imageUrl;

    try {
      await this.prisma.recipe.update({
        where: { id },
        data: updatePayload,
      });

      if (ingredients) {
        await this.prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });
        await this.prisma.recipeIngredient.createMany({
          data: ingredients.map((item) => ({
            recipeId: id,
            ingredientId: item.ingredientId,
            quantity: item.quantity,
            unit: item.unit,
          })),
        });
      }

      return this.findOne(id);
    } catch {
      // Fallback Supabase
      const { error } = await this.supabase
        .from('recipe')
        .update({
          name: recipeData.name,
          description: recipeData.description,
          yield_servings: recipeData.yieldServings,
          category_id: categoryId,
          image_url: recipeData.imageUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw new BadRequestException(error.message);

      if (ingredients) {
        await this.supabase.from('recipe_ingredient').delete().eq('recipe_id', id);
        const rows = ingredients.map((item) => ({
          recipe_id: id,
          ingredient_id: item.ingredientId,
          quantity: item.quantity,
          unit: item.unit,
        }));
        await this.supabase.from('recipe_ingredient').insert(rows);
      }

      return this.findOne(id);
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.recipe.delete({ where: { id } });
      return { message: 'Receta eliminada correctamente', id };
    } catch {
      const { error } = await this.supabase.from('recipe').delete().eq('id', id);
      if (error) throw new BadRequestException(error.message);
      return { message: 'Receta eliminada correctamente', id };
    }
  }
}
