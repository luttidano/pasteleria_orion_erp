import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryType } from '../../common/enums';
import { rethrowPrismaError } from '../../common/utils/prisma-error.util';

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async resolveCategoryIdInTx(
    tx: Prisma.TransactionClient,
    categoryId: string | undefined,
    categoryName: string | undefined,
    type: 'ingredient' | 'recipe' | 'pos',
  ): Promise<string | undefined> {
    if (categoryId || !categoryName) {
      return categoryId;
    }

    const existing = await tx.category.findFirst({
      where: { name: categoryName, type },
    });
    if (existing) {
      return existing.id;
    }

    const created = await tx.category.create({
      data: { name: categoryName, type },
    });
    return created.id;
  }

  async findAll(type?: CategoryType) {
    const where = type ? { type } : {};
    return this.prisma.category.findMany({
      where,
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const category = await this.prisma.category.findUnique({ where: { id } });
    if (!category) {
      throw new NotFoundException(`Categoría no encontrada`);
    }
    return category;
  }

  async create(dto: CreateCategoryDto) {
    try {
      return await this.prisma.category.create({ data: dto });
    } catch (error) {
      rethrowPrismaError(error, {
        unique: 'Ya existe una categoría con ese nombre y tipo.',
      });
    }
  }

  async update(id: string, dto: UpdateCategoryDto) {
    await this.findOne(id);
    try {
      return await this.prisma.category.update({
        where: { id },
        data: dto,
      });
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Categoría no encontrada.',
        unique: 'Ya existe una categoría con ese nombre y tipo.',
      });
    }
  }

  async remove(id: string) {
    await this.findOne(id);
    try {
      await this.prisma.category.delete({ where: { id } });
      return { message: 'Categoría eliminada', id };
    } catch (error) {
      rethrowPrismaError(error, {
        notFound: 'Categoría no encontrada.',
        foreignKeyStatus: 'conflict',
      });
    }
  }
}
