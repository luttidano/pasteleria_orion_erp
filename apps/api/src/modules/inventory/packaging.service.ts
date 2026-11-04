import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CreatePackagingDto } from './dto/create-packaging.dto';
import { UpdatePackagingDto } from './dto/update-packaging.dto';

@Injectable()
export class PackagingService {
  private readonly logger = new Logger(PackagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  private mapPackaging(p: any) {
    const stock = Number(p.stock || 0);
    const minStock = Number(p.minStock ?? p.min_stock ?? 0);
    let status: 'suficiente' | 'bajo' | 'agotado' = 'suficiente';
    if (stock <= 0) status = 'agotado';
    else if (stock <= minStock) status = 'bajo';

    const supplier = p.supplier
      ? {
          id: p.supplier.id,
          name: p.supplier.name,
          phone: p.supplier.phone,
          deliverySchedule: p.supplier.delivery_schedule || p.supplier.deliverySchedule,
          category: p.supplier.category,
          supplierTypes: p.supplier.supplier_types || p.supplier.supplierTypes || ['empaque'],
          contactPerson: p.supplier.contact_person || p.supplier.contactPerson,
          icon: p.supplier.icon,
        }
      : null;

    return {
      id: p.id,
      name: p.name,
      packageType: p.package_type || p.packageType,
      category: p.category,
      stock,
      minStock,
      unit: p.unit || 'un',
      costPrice:
        p.cost_price !== null && p.cost_price !== undefined
          ? Number(p.cost_price)
          : p.costPrice
            ? Number(p.costPrice)
            : 0,
      supplierId: p.supplier_id || p.supplierId,
      supplier,
      icon: p.icon || '📦',
      description: p.description,
      status,
      createdAt: p.createdAt
        ? p.createdAt instanceof Date
          ? p.createdAt.toISOString()
          : p.createdAt
        : p.created_at,
      updatedAt: p.updatedAt
        ? p.updatedAt instanceof Date
          ? p.updatedAt.toISOString()
          : p.updatedAt
        : p.updated_at,
    };
  }

  async findAll(type?: string) {
    if (this.prisma.isAvailable) {
      try {
        const where: any = {};
        if (type && (type === 'primario' || type === 'secundario')) {
          where.packageType = type;
        }

        const items = await this.prisma.packaging.findMany({
          where,
          include: { supplier: true },
          orderBy: [{ packageType: 'asc' }, { name: 'asc' }],
        });

        return items.map((p) => this.mapPackaging(p));
      } catch (err: any) {
        this.logger.warn(`Error en Prisma findAll empaques: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    try {
      let query = this.supabaseService.client
        .from('packaging')
        .select('*, supplier:supplier(*)')
        .order('package_type', { ascending: true })
        .order('name', { ascending: true });

      if (type && (type === 'primario' || type === 'secundario')) {
        query = query.eq('package_type', type);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((p: any) => this.mapPackaging(p));
    } catch (err: any) {
      this.logger.error(`Error en fallback Supabase findAll empaques: ${err?.message || err}`);
      return [];
    }
  }

  async findOne(id: string) {
    if (this.prisma.isAvailable) {
      try {
        const item = await this.prisma.packaging.findUnique({
          where: { id },
          include: { supplier: true },
        });
        if (item) return this.mapPackaging(item);
      } catch (err: any) {
        this.logger.warn(`Error en Prisma findOne empaque: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('packaging')
        .select('*, supplier:supplier(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new NotFoundException(`Empaque con ID "${id}" no encontrado.`);
      return this.mapPackaging(data);
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Empaque con ID "${id}" no encontrado.`);
    }
  }

  async create(dto: CreatePackagingDto) {
    if (this.prisma.isAvailable) {
      try {
        const created = await this.prisma.packaging.create({
          data: {
            name: dto.name,
            packageType: dto.packageType,
            category: dto.category,
            stock: dto.stock,
            minStock: dto.minStock,
            unit: dto.unit || 'un',
            costPrice: dto.costPrice ?? 0,
            supplierId: dto.supplierId || null,
            icon: dto.icon || '📦',
            description: dto.description || null,
          },
          include: { supplier: true },
        });
        return this.mapPackaging(created);
      } catch (err: any) {
        this.logger.warn(`Error en Prisma create empaque: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    const { data: created, error } = await this.supabaseService.client
      .from('packaging')
      .insert({
        name: dto.name,
        package_type: dto.packageType,
        category: dto.category,
        stock: dto.stock,
        min_stock: dto.minStock,
        unit: dto.unit || 'un',
        cost_price: dto.costPrice ?? 0,
        supplier_id: dto.supplierId || null,
        icon: dto.icon || '📦',
        description: dto.description || null,
      })
      .select('*, supplier:supplier(*)')
      .single();

    if (error) throw error;
    return this.mapPackaging(created);
  }

  async update(id: string, dto: UpdatePackagingDto) {
    if (this.prisma.isAvailable) {
      try {
        const updated = await this.prisma.packaging.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name }),
            ...(dto.packageType !== undefined && { packageType: dto.packageType }),
            ...(dto.category !== undefined && { category: dto.category }),
            ...(dto.stock !== undefined && { stock: dto.stock }),
            ...(dto.minStock !== undefined && { minStock: dto.minStock }),
            ...(dto.unit !== undefined && { unit: dto.unit }),
            ...(dto.costPrice !== undefined && { costPrice: dto.costPrice }),
            ...(dto.supplierId !== undefined && { supplierId: dto.supplierId || null }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
            ...(dto.description !== undefined && { description: dto.description }),
            updatedAt: new Date(),
          },
          include: { supplier: true },
        });
        return this.mapPackaging(updated);
      } catch (err: any) {
        this.logger.warn(`Error en Prisma update empaque: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    const payload: any = { updated_at: new Date().toISOString() };
    if (dto.name !== undefined) payload.name = dto.name;
    if (dto.packageType !== undefined) payload.package_type = dto.packageType;
    if (dto.category !== undefined) payload.category = dto.category;
    if (dto.stock !== undefined) payload.stock = dto.stock;
    if (dto.minStock !== undefined) payload.min_stock = dto.minStock;
    if (dto.unit !== undefined) payload.unit = dto.unit;
    if (dto.costPrice !== undefined) payload.cost_price = dto.costPrice;
    if (dto.supplierId !== undefined) payload.supplier_id = dto.supplierId || null;
    if (dto.icon !== undefined) payload.icon = dto.icon;
    if (dto.description !== undefined) payload.description = dto.description;

    const { data: updated, error } = await this.supabaseService.client
      .from('packaging')
      .update(payload)
      .eq('id', id)
      .select('*, supplier:supplier(*)')
      .single();

    if (error) throw error;
    return this.mapPackaging(updated);
  }

  async adjustStock(id: string, delta: number) {
    if (this.prisma.isAvailable) {
      try {
        const current = await this.findOne(id);
        const newStock = Math.max(0, current.stock + delta);
        const updated = await this.prisma.packaging.update({
          where: { id },
          data: {
            stock: newStock,
            updatedAt: new Date(),
          },
          include: { supplier: true },
        });
        return this.mapPackaging(updated);
      } catch (err: any) {
        this.logger.warn(`Error en Prisma adjustStock: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    const current = await this.findOne(id);
    const newStock = Math.max(0, current.stock + delta);
    const { data: updated, error } = await this.supabaseService.client
      .from('packaging')
      .update({ stock: newStock, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*, supplier:supplier(*)')
      .single();

    if (error) throw error;
    return this.mapPackaging(updated);
  }

  async remove(id: string) {
    if (this.prisma.isAvailable) {
      try {
        await this.prisma.packaging.delete({ where: { id } });
        return { success: true, message: 'Empaque eliminado correctamente.' };
      } catch (err: any) {
        this.logger.warn(`Error en Prisma delete empaque: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    const { error } = await this.supabaseService.client.from('packaging').delete().eq('id', id);
    if (error) throw error;
    return { success: true, message: 'Empaque eliminado correctamente.' };
  }
}
