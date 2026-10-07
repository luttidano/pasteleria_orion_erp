import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

function mapSupabaseIngredient(row: any, computeStatusFn: (s:number, m: number) => StockStatus) {
  const stock = Number(row.stock);
  const minStock = Number(row.min_stock !== undefined ? row.min_stock : row.minStock); 
  return {
    id: row.id,
    name: row.name,
    categoryId: row.category_id || row.categoryId,
    category: row.categoryRef?.name || row.category?.name || 'General',
    stock,
    minStock,
    unit: row.unit,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : 0,
    icon: row.icon,
    imageUrl: row.image_url !== undefined ? row.image_url : row.imageUrl,
    description: row.description,
    status: computeStatusFn(stock, minStock),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

@Injectable()
export class InventoryService {
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

  private computeStatus(stock: number, minStock: number): StockStatus {
    if (stock <= 0) return 'agotado';
    if (stock <= minStock) return 'bajo';
    return 'suficiente';
  }

  async findAll() {
    try {
      const items = await this.prisma.ingredient.findMany({
        include: { categoryRef: true},
        orderBy: {name: 'asc'},
      });
      return items.map((item) => ({
        ...item,
        stock: Number(item.stock),
        minStock: Number(item.minStock),
        price: Number(item.price),
        category: item.categoryRef?.name || 'General',
        status: this.computeStatus(Number(item.stock), Number(item.minStock))
      }));
    } catch {
      const { data, error } = await this.supabase
        .from('ingredient')
        .select('*, categoryRef:category(*)')
        .order('name', { ascending: true });

      if (error) {
        throw new BadRequestException(error.message);
      }
      return (data || []).map((row) => mapSupabaseIngredient(row, this.computeStatus.bind(this)));
    }
  }

  async findOne(id: string) {
    try {
      const item = await this.prisma.ingredient.findUnique({
        where: { id },
        include: { categoryRef: true },
      });
      if (item) {
        return {
          ...item,
          stock: Number(item.stock),
          minStock: Number(item.minStock),
          price: item.price !== null && item.price !== undefined ? Number(item.price) : 0,
          category: item.categoryRef?.name || 'General',
          status: this.computeStatus(Number(item.stock), Number(item.minStock)),
        };
      }
    } catch {
      // Fallback a Supabase REST
    }

    const { data, error } = await this.supabase
      .from('ingredient')
      .select('*, categoryRef:category(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Ingredient with ID ${id} not found`);
    }

    return mapSupabaseIngredient(data, this.computeStatus.bind(this));
  }

  async create(dto: CreateIngredientDto) {
    let categoryId = (dto as any).categoryId;
    if (!categoryId && dto.category) {
      try {
        const cat = await this.prisma.category.findFirst({
          where: { name: dto.category, type: 'ingredient' },
        });
        if (cat) {
          categoryId = cat.id;
        } else {
          const newCat = await this.prisma.category.create({
            data: { name: dto.category, type: 'ingredient' },
          });
          categoryId = newCat.id;
        }
      } catch {
        // Fallback si falla
      }
    }

    try {
      const created = await this.prisma.ingredient.create({
        data: {
          name: dto.name,
          categoryId,
          stock: dto.stock,
          minStock: dto.minStock,
          unit: dto.unit,
          price: dto.price ?? 0,
          icon: dto.icon,
          imageUrl: dto.imageUrl,
          description: dto.description,
        },
      });
      return await this.findOne(created.id);
    } catch {
      const { data, error } = await this.supabase
        .from('ingredient')
        .insert({
          name: dto.name,
          category_id: categoryId,
          stock: dto.stock,
          min_stock: dto.minStock,
          unit: dto.unit,
          price: dto.price ?? 0,
          icon: dto.icon,
          image_url: dto.imageUrl,
          description: dto.description,
        })
        .select('*, categoryRef:category(*)')
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return mapSupabaseIngredient(data, this.computeStatus.bind(this));
    }
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.findOne(id);

    let categoryId = (dto as any).categoryId;
    if (!categoryId && dto.category) {
      try {
        const cat = await this.prisma.category.findFirst({
          where: { name: dto.category, type: 'ingredient' },
        });
        if (cat) {
          categoryId = cat.id;
        } else {
          const newCat = await this.prisma.category.create({
            data: { name: dto.category, type: 'ingredient' },
          });
          categoryId = newCat.id;
        }
      } catch {
        // Fallback
      }
    }

    try {
      const updateData: Record<string, any> = {};
      if (dto.name !== undefined) updateData.name = dto.name;
      if (categoryId !== undefined) updateData.categoryId = categoryId;
      if (dto.stock !== undefined) updateData.stock = dto.stock;
      if (dto.minStock !== undefined) updateData.minStock = dto.minStock;
      if (dto.unit !== undefined) updateData.unit = dto.unit;
      if (dto.price !== undefined) updateData.price = dto.price;
      if (dto.icon !== undefined) updateData.icon = dto.icon;
      if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
      if (dto.description !== undefined) updateData.description = dto.description;

      await this.prisma.ingredient.update({
        where: { id },
        data: updateData,
      });
      return await this.findOne(id);
    } catch {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (dto.name !== undefined) payload.name = dto.name;
      if (categoryId !== undefined) payload.category_id = categoryId;
      if (dto.stock !== undefined) payload.stock = dto.stock;
      if (dto.minStock !== undefined) payload.min_stock = dto.minStock;
      if (dto.unit !== undefined) payload.unit = dto.unit;
      if (dto.price !== undefined) payload.price = dto.price;
      if (dto.icon !== undefined) payload.icon = dto.icon;
      if (dto.imageUrl !== undefined) payload.image_url = dto.imageUrl;
      if (dto.description !== undefined) payload.description = dto.description;

      const { data, error } = await this.supabase
        .from('ingredient')
        .update(payload)
        .eq('id', id)
        .select('*, categoryRef:category(*)')
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return mapSupabaseIngredient(data, this.computeStatus.bind(this));
    }
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const ingredient = await this.findOne(id);
    const currentStock = Number(ingredient.stock);
    const nextStock = Math.max(0, currentStock + dto.delta);

    try {
      await this.prisma.ingredient.update({
        where: { id },
        data: {
          stock: nextStock,
        },
      });
      return await this.findOne(id);
    } catch {
      const { data, error } = await this.supabase
        .from('ingredient')
        .update({
          stock: nextStock,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*, categoryRef:category(*)')
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return mapSupabaseIngredient(data, this.computeStatus.bind(this));
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      return await this.prisma.ingredient.delete({
        where: { id },
      });
    } catch {
      const { error } = await this.supabase.from('ingredient').delete().eq('id', id);
      if (error) {
        throw new BadRequestException(error.message);
      }
      return { success: true, id };
    }
  }
}
