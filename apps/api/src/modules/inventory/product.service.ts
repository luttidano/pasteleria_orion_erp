import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

@Injectable()
export class ProductService {
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
      status: this.computeStatus(stock, minStock),
      createdAt: item.createdAt || item.created_at,
      updatedAt: item.updatedAt || item.updated_at,
    };
  }

  async findAll(productType?: 'manufactured' | 'resale') {
    if (this.prisma.isAvailable) {
      try {
        const where = productType ? { productType } : {};
        const items = await this.prisma.product.findMany({
          where,
          include: {
            recipe: true,
            supplier: true,
            categoryRef: true,
          },
          orderBy: { name: 'asc' },
        });
        return items.map((item) => this.mapProduct(item));
      } catch (err) {
        this.prisma.disable(err instanceof Error ? err.message : String(err));
        console.warn('[ProductService] Prisma findAll falló, recurriendo a Supabase REST:', err);
      }
    }

    // Fallback transparente a Supabase REST
    let query = this.supabase
      .from('product')
      .select('*, recipe:recipe(*), supplier:supplier(*), categoryRef:category(*)')
      .order('name', { ascending: true });

    if (productType) {
      query = query.eq('product_type', productType);
    }

    const { data, error } = await query;
    if (error) {
      throw new BadRequestException(error.message);
    }
    return (data || []).map((row) => this.mapProduct(row));
  }

  async findOne(id: string) {
    if (this.prisma.isAvailable) {
      try {
        const item = await this.prisma.product.findUnique({
          where: { id },
          include: {
            recipe: true,
            supplier: true,
            categoryRef: true,
          },
        });
        if (item) return this.mapProduct(item);
      } catch (err) {
        this.prisma.disable(err instanceof Error ? err.message : String(err));
      }
    }

    const { data, error } = await this.supabase
      .from('product')
      .select('*, recipe:recipe(*), supplier:suppliers(*), categoryRef:category(*)')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }
    return this.mapProduct(data);
  }

  async create(dto: CreateProductDto) {
    if (this.prisma.isAvailable) {
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
            recipeId: dto.recipeId || null,
            supplierId: dto.supplierId || null,
            categoryId: dto.categoryId || null,
            description: dto.description,
            imageUrl: dto.imageUrl,
            icon: dto.icon || '🧁',
          },
        });
        return await this.findOne(created.id);
      } catch (err) {
        this.prisma.disable(err instanceof Error ? err.message : String(err));
      }
    }

    const { data, error } = await this.supabase
      .from('product')
      .insert({
        name: dto.name,
        product_type: dto.productType,
        stock: dto.stock,
        min_stock: dto.minStock,
        unit: dto.unit,
        sale_price: dto.salePrice,
        cost_price: dto.costPrice ?? 0,
        recipe_id: dto.recipeId || null,
        supplier_id: dto.supplierId || null,
        category_id: dto.categoryId || null,
        description: dto.description,
        image_url: dto.imageUrl,
        icon: dto.icon || '🧁',
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException(error.message);
    }
    return await this.findOne(data.id);
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
    if (this.prisma.isAvailable) {
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
            ...(dto.supplierId !== undefined && { supplierId: dto.supplierId || null }),
            ...(dto.categoryId !== undefined && { categoryId: dto.categoryId || null }),
            ...(dto.description !== undefined && { description: dto.description }),
            ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
          },
        });
        return await this.findOne(id);
      } catch (err) {
        this.prisma.disable(err instanceof Error ? err.message : String(err));
      }
    }

    const payload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.productType !== undefined) payload.product_type = dto.productType;
    if (dto.stock !== undefined) payload.stock = dto.stock;
    if (dto.minStock !== undefined) payload.min_stock = dto.minStock;
    if (dto.unit !== undefined) payload.unit = dto.unit;
    if (dto.salePrice !== undefined) payload.sale_price = dto.salePrice;
    if (dto.costPrice !== undefined) payload.cost_price = dto.costPrice;
    if (dto.recipeId !== undefined) payload.recipe_id = dto.recipeId || null;
    if (dto.supplierId !== undefined) payload.supplier_id = dto.supplierId || null;
    if (dto.categoryId !== undefined) payload.category_id = dto.categoryId || null;
    if (dto.description !== undefined) payload.description = dto.description;
    if (dto.imageUrl !== undefined) payload.image_url = dto.imageUrl;
    if (dto.icon !== undefined) payload.icon = dto.icon;

    const { error } = await this.supabase.from('product').update(payload).eq('id', id);
    if (error) {
      throw new BadRequestException(error.message);
    }
    return await this.findOne(id);
  }

  async remove(id: string) {
    await this.findOne(id);
    if (this.prisma.isAvailable) {
      try {
        await this.prisma.product.delete({ where: { id } });
        return { success: true, id };
      } catch (err) {
        this.prisma.disable(err instanceof Error ? err.message : String(err));
      }
    }

    const { error } = await this.supabase.from('product').delete().eq('id', id);
    if (error) {
      throw new BadRequestException(error.message);
    }
    return { success: true, id };
  }
}
