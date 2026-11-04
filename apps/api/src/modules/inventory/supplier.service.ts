import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { SupabaseService } from '../../common/supabase/supabase.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

@Injectable()
export class SupplierService {
  private readonly logger = new Logger(SupplierService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly supabaseService: SupabaseService,
  ) {}

  /**
   * Determina la modalidad de abastecimiento según los datos del proveedor
   */
  private detectSupplyModality(item: any): 'despacho' | 'presencial' {
    const schedule = (item.delivery_schedule || item.deliverySchedule || '').toLowerCase();
    const notes = (item.notes || '').toLowerCase();
    const name = (item.name || '').toLowerCase();
    const icon = item.icon || '';

    if (
      schedule.includes('presencial') ||
      schedule.includes('retiro') ||
      schedule.includes('local') ||
      schedule.includes('mayorista') ||
      notes.includes('presencial') ||
      notes.includes('local') ||
      notes.includes('mayorista') ||
      name.includes('mayorista') ||
      name.includes('vega') ||
      ['🏬', '🏪', '🛒'].includes(icon)
    ) {
      return 'presencial';
    }
    return 'despacho';
  }

  private mapSupplier(item: any) {
    const supplierTypes = item.supplier_types || item.supplierTypes;
    return {
      id: item.id,
      name: item.name,
      phone: item.phone,
      supplierTypes:
        supplierTypes && supplierTypes.length > 0
          ? supplierTypes
          : ['materia_prima'],
      supplyModality: this.detectSupplyModality(item),
      deliverySchedule: item.delivery_schedule || item.deliverySchedule,
      category: item.category,
      approximatePrices: item.approximate_prices || item.approximatePrices,
      contactPerson: item.contact_person || item.contactPerson,
      icon: item.icon || '🚚',
      email: item.email,
      address: item.address,
      notes: item.notes,
      createdAt: item.createdAt
        ? item.createdAt instanceof Date
          ? item.createdAt.toISOString()
          : item.createdAt
        : item.created_at,
      updatedAt: item.updatedAt
        ? item.updatedAt instanceof Date
          ? item.updatedAt.toISOString()
          : item.updatedAt
        : item.updated_at,
      ingredientsCount: item.supplierIngredients?.length ?? 0,
      resaleProductsCount: item.resaleProducts?.length ?? 0,
    };
  }

  async findAll(type?: string) {
    if (this.prisma.isAvailable) {
      try {
        const where: any = {};
        if (type) {
          where.supplierTypes = {
            has: type,
          };
        }
        const suppliers = await this.prisma.supplier.findMany({
          where,
          include: {
            supplierIngredients: true,
            resaleProducts: true,
          },
          orderBy: { name: 'asc' },
        });

        return suppliers.map((s) => this.mapSupplier(s));
      } catch (error: any) {
        this.logger.warn(`Error en Prisma findAll proveedores: ${error?.message || error}. Fallback a Supabase.`);
      }
    }

    try {
      let query = this.supabaseService.client
        .from('supplier')
        .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
        .order('name', { ascending: true });

      if (type) {
        query = query.contains('supplier_types', [type]);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((s: any) => this.mapSupplier(s));
    } catch (err: any) {
      this.logger.error(`Error en fallback Supabase findAll proveedores: ${err?.message || err}`);
      return [];
    }
  }

  async findOne(id: string) {
    if (this.prisma.isAvailable) {
      try {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id },
          include: {
            supplierIngredients: {
              include: { ingredient: true },
            },
            resaleProducts: true,
          },
        });

        if (supplier) return this.mapSupplier(supplier);
      } catch (err: any) {
        this.logger.warn(`Error en Prisma findOne proveedor: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    try {
      const { data, error } = await this.supabaseService.client
        .from('supplier')
        .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new NotFoundException(`Proveedor con ID ${id} no encontrado.`);
      return this.mapSupplier(data);
    } catch (err: any) {
      if (err instanceof NotFoundException) throw err;
      throw new NotFoundException(`Proveedor con ID ${id} no encontrado.`);
    }
  }

  async create(dto: CreateSupplierDto) {
    const isPresencial = dto.supplyModality === 'presencial';
    const phone = dto.phone?.trim() || 'Sin registrar';
    const deliverySchedule =
      dto.deliverySchedule?.trim() ||
      (isPresencial ? 'Compra presencial / Retiro en local' : 'A coordinar / Pedido directo');
    const category = dto.category?.trim() || 'General';
    const approximatePrices = dto.approximatePrices?.trim() || 'A consultar en establecimiento';
    const icon = dto.icon || (isPresencial ? '🏬' : '🚚');
    const supplierTypes = dto.supplierTypes || ['materia_prima'];

    if (this.prisma.isAvailable) {
      try {
        const created = await this.prisma.supplier.create({
          data: {
            name: dto.name.trim(),
            phone,
            deliverySchedule,
            category,
            approximatePrices,
            contactPerson: dto.contactPerson?.trim() || null,
            icon,
            email: dto.email?.trim() || null,
            address: dto.address?.trim() || null,
            notes: dto.notes?.trim() || null,
            supplierTypes,
          },
        });

        return this.mapSupplier(created);
      } catch (error) {
        this.logger.warn('[SupplierService] Error Prisma registrando proveedor, fallback Supabase:', error);
      }
    }

    try {
      const { data: created, error } = await this.supabaseService.client
        .from('supplier')
        .insert({
          name: dto.name.trim(),
          phone,
          delivery_schedule: deliverySchedule,
          category,
          approximate_prices: approximatePrices,
          contact_person: dto.contactPerson?.trim() || null,
          icon,
          email: dto.email?.trim() || null,
          address: dto.address?.trim() || null,
          notes: dto.notes?.trim() || null,
          supplier_types: supplierTypes,
        })
        .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
        .single();

      if (error) throw error;
      return this.mapSupplier(created);
    } catch (error) {
      console.error('[SupplierService] Error registrando proveedor:', error);
      throw new InternalServerErrorException('No se pudo registrar el proveedor.');
    }
  }

  async update(id: string, dto: UpdateSupplierDto) {
    if (this.prisma.isAvailable) {
      try {
        const updated = await this.prisma.supplier.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: dto.name.trim() }),
            ...(dto.phone !== undefined && { phone: dto.phone.trim() || 'Sin registrar' }),
            ...(dto.deliverySchedule !== undefined && { deliverySchedule: dto.deliverySchedule.trim() }),
            ...(dto.category !== undefined && { category: dto.category.trim() }),
            ...(dto.approximatePrices !== undefined && { approximatePrices: dto.approximatePrices.trim() }),
            ...(dto.contactPerson !== undefined && { contactPerson: dto.contactPerson?.trim() || null }),
            ...(dto.icon !== undefined && { icon: dto.icon }),
            ...(dto.email !== undefined && { email: dto.email?.trim() || null }),
            ...(dto.address !== undefined && { address: dto.address?.trim() || null }),
            ...(dto.notes !== undefined && { notes: dto.notes?.trim() || null }),
            ...(dto.supplierTypes !== undefined && { supplierTypes: dto.supplierTypes }),
            updatedAt: new Date(),
          },
        });

        return this.mapSupplier(updated);
      } catch (error) {
        this.logger.warn('[SupplierService] Error Prisma actualizando proveedor, fallback Supabase:', error);
      }
    }

    try {
      const payload: Record<string, any> = { updated_at: new Date().toISOString() };
      if (dto.name !== undefined) payload.name = dto.name.trim();
      if (dto.phone !== undefined) payload.phone = dto.phone.trim() || 'Sin registrar';
      if (dto.deliverySchedule !== undefined) payload.delivery_schedule = dto.deliverySchedule.trim();
      if (dto.category !== undefined) payload.category = dto.category.trim();
      if (dto.approximatePrices !== undefined) payload.approximate_prices = dto.approximatePrices.trim();
      if (dto.contactPerson !== undefined) payload.contact_person = dto.contactPerson?.trim() || null;
      if (dto.icon !== undefined) payload.icon = dto.icon;
      if (dto.email !== undefined) payload.email = dto.email?.trim() || null;
      if (dto.address !== undefined) payload.address = dto.address?.trim() || null;
      if (dto.notes !== undefined) payload.notes = dto.notes?.trim() || null;
      if (dto.supplierTypes !== undefined) payload.supplier_types = dto.supplierTypes;

      const { data: updated, error } = await this.supabaseService.client
        .from('supplier')
        .update(payload)
        .eq('id', id)
        .select('*, supplierIngredients:supplier_ingredient(*), resaleProducts:product(*)')
        .single();

      if (error) throw error;
      return this.mapSupplier(updated);
    } catch (error) {
      console.error('[SupplierService] Error actualizando proveedor:', error);
      throw new InternalServerErrorException('No se pudo actualizar el proveedor.');
    }
  }

  async remove(id: string) {
    if (this.prisma.isAvailable) {
      try {
        const supplier = await this.prisma.supplier.findUnique({
          where: { id },
          include: {
            resaleProducts: true,
          },
        });

        if (!supplier) {
          throw new NotFoundException(`Proveedor con ID ${id} no encontrado.`);
        }

        if (supplier.resaleProducts.length > 0) {
          throw new BadRequestException(
            `No se puede eliminar: el proveedor tiene ${supplier.resaleProducts.length} producto(s) de reventa asociados.`,
          );
        }

        await this.prisma.supplier.delete({
          where: { id },
        });

        return { success: true, id };
      } catch (err: any) {
        if (err instanceof BadRequestException || err instanceof NotFoundException) throw err;
        this.logger.warn(`Error en Prisma remove proveedor: ${err?.message || err}. Fallback a Supabase.`);
      }
    }

    const { error } = await this.supabaseService.client.from('supplier').delete().eq('id', id);
    if (error) throw error;
    return { success: true, id };
  }
}
