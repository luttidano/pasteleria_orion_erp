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

function mapSupabaseIngredient(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    stock: Number(row.stock),
    minStock: Number(row.min_stock !== undefined ? row.min_stock : row.minStock),
    unit: row.unit,
    price: row.price !== null && row.price !== undefined ? Number(row.price) : 0,
    icon: row.icon,
    imageUrl: row.image_url !== undefined ? row.image_url : row.imageUrl,
    description: row.description,
    status: row.status,
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
      return await this.prisma.ingredient.findMany({
        orderBy: { name: 'asc' },
      });
    } catch {
      const { data, error } = await this.supabase
        .from('ingredient')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw new BadRequestException(error.message);
      }
      return (data || []).map(mapSupabaseIngredient);
    }
  }

  async findOne(id: string) {
    try {
      const ingredient = await this.prisma.ingredient.findUnique({
        where: { id },
      });
      if (ingredient) return ingredient;
    } catch {
      // Fallback a Supabase REST
    }

    const { data, error } = await this.supabase
      .from('ingredient')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Ingredient with ID ${id} not found`);
    }

    return mapSupabaseIngredient(data);
  }

  async create(dto: CreateIngredientDto) {
    const status = this.computeStatus(dto.stock, dto.minStock);

    try {
      return await this.prisma.ingredient.create({
        data: {
          name: dto.name,
          category: dto.category,
          stock: dto.stock,
          minStock: dto.minStock,
          unit: dto.unit,
          price: dto.price ?? 0,
          icon: dto.icon,
          imageUrl: dto.imageUrl,
          description: dto.description,
          status,
        },
      });
    } catch {
      const { data, error } = await this.supabase
        .from('ingredient')
        .insert({
          name: dto.name,
          category: dto.category,
          stock: dto.stock,
          min_stock: dto.minStock,
          unit: dto.unit,
          price: dto.price ?? 0,
          icon: dto.icon,
          image_url: dto.imageUrl,
          description: dto.description,
          status,
        })
        .select()
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return mapSupabaseIngredient(data);
    }
  }

  async update(id: string, dto: UpdateIngredientDto) {
    const current = await this.findOne(id);

    const newStock = dto.stock !== undefined ? dto.stock : Number(current.stock);
    const newMinStock = dto.minStock !== undefined ? dto.minStock : Number(current.minStock);
    const status = this.computeStatus(newStock, newMinStock);

    try {
      return await this.prisma.ingredient.update({
        where: { id },
        data: {
          ...dto,
          status,
        },
      });
    } catch {
      const payload: Record<string, any> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (dto.name !== undefined) payload.name = dto.name;
      if (dto.category !== undefined) payload.category = dto.category;
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
        .select()
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return mapSupabaseIngredient(data);
    }
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const ingredient = await this.findOne(id);
    const currentStock = Number(ingredient.stock);
    const nextStock = Math.max(0, currentStock + dto.delta);
    const nextStatus = this.computeStatus(nextStock, Number(ingredient.minStock));

    try {
      return await this.prisma.ingredient.update({
        where: { id },
        data: {
          stock: nextStock,
          status: nextStatus,
        },
      });
    } catch {
      const { data, error } = await this.supabase
        .from('ingredient')
        .update({
          stock: nextStock,
          status: nextStatus,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw new BadRequestException(error.message);
      }
      return mapSupabaseIngredient(data);
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
