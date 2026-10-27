import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

@Injectable()
export class IngredientService {
  constructor(private readonly prisma: PrismaService) {}

  private computeStatus(stock: number, minStock: number): StockStatus {
    if (stock <= 0) return 'agotado';
    if (stock <= minStock) return 'bajo';
    return 'suficiente';
  }

  private mapIngredient(item: any) {
    const stock = Number(item.stock);
    const minStock = Number(item.minStock ?? item.min_stock ?? 0);
    return {
      id: item.id,
      name: item.name,
      categoryId: item.categoryId || item.category_id,
      category: item.categoryRef?.name || item.category || 'General',
      stock,
      minStock,
      unit: item.unit,
      price: item.price !== null && item.price !== undefined ? Number(item.price) : 0,
      icon: item.icon,
      imageUrl: item.imageUrl || item.image_url,
      description: item.description,
      status: this.computeStatus(stock, minStock),
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
    let categoryId = dto.categoryId;
    if (!categoryId && dto.category) {
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
    }

    const created = await this.prisma.ingredient.create({
      data: {
        name: dto.name,
        categoryId: categoryId || null,
        stock: dto.stock,
        minStock: dto.minStock,
        unit: dto.unit,
        price: dto.price ?? 0,
        icon: dto.icon,
        imageUrl: dto.imageUrl,
        description: dto.description,
      },
      include: { categoryRef: true },
    });

    return this.mapIngredient(created);
  }

  async update(id: string, dto: UpdateIngredientDto) {
    await this.findOne(id);

    let categoryId = (dto as any).categoryId;
    if (!categoryId && dto.category) {
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
    }

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

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: updateData,
      include: { categoryRef: true },
    });

    return this.mapIngredient(updated);
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const current = await tx.ingredient.findUnique({
        where: { id },
      });

      if (!current) {
        throw new NotFoundException(`Ingrediente con ID ${id} no encontrado`);
      }

      const currentStock = Number(current.stock);
      const nextStock = Math.max(0, currentStock + dto.delta);

      return tx.ingredient.update({
        where: { id },
        data: { stock: nextStock },
        include: { categoryRef: true },
      });
    });

    return this.mapIngredient(updated);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.ingredient.delete({ where: { id } });
    return { success: true, id };
  }
}
