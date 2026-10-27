import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export type StockStatus = 'suficiente' | 'bajo' | 'agotado';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

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
  }

  async findOne(id: string) {
    const item = await this.prisma.product.findUnique({
      where: { id },
      include: {
        recipe: true,
        supplier: true,
        categoryRef: true,
      },
    });

    if (!item) {
      throw new NotFoundException(`Producto con ID ${id} no encontrado`);
    }

    return this.mapProduct(item);
  }

  async create(dto: CreateProductDto) {
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
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOne(id);
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
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.product.delete({ where: { id } });
    return { success: true, id };
  }
}
