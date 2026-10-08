import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../../database/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { CategoryType } from '@prisma/client';

@Injectable()
export class CategoryService {
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

  async findAll(type?: CategoryType) {
    const where = type ? { type } : {};
    if (this.prisma.isAvailable) {
      try {
        return await this.prisma.category.findMany({
          where,
          orderBy: { name: 'asc' },
        });
      } catch (err) {
        this.prisma.disable(err instanceof Error ? err.message : String(err));
      }
    }

    let query = this.supabase.from('category').select('*').order('name', { ascending: true });
    if (type) {
      query = query.eq('type', type);
    }
    const { data, error } = await query;
    if (error) throw new BadRequestException(error.message);
    return data || [];
  }

  async findOne(id: string) {
    if (this.prisma.isAvailable) {
      try {
        const category = await this.prisma.category.findUnique({ where: { id } });
        if (category) return category;
      } catch {
        // Fallback
      }
    }

    const { data, error } = await this.supabase
      .from('category')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) throw new NotFoundException(`Categoría no encontrada`);
    return data;
  }

  async create(dto: CreateCategoryDto) {
    if (this.prisma.isAvailable) {
      try {
        return await this.prisma.category.create({ data: dto });
      } catch {
        // Fallback
      }
    }

    const { data, error } = await this.supabase
      .from('category')
      .insert(dto)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    if (this.prisma.isAvailable) {
      try {
        return await this.prisma.category.update({
          where: { id },
          data: dto,
        });
      } catch {
        // Fallback
      }
    }

    const { data, error } = await this.supabase
      .from('category')
      .update(dto)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new BadRequestException(error.message);
    return data;
  }

  async remove(id: string) {
    if (this.prisma.isAvailable) {
      try {
        await this.prisma.category.delete({ where: { id } });
        return { message: 'Categoría eliminada', id };
      } catch {
        // Fallback
      }
    }

    const { error } = await this.supabase.from('category').delete().eq('id', id);
    if (error) throw new BadRequestException(error.message);
    return { message: 'Categoría eliminada', id };
  }
}
