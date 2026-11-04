import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { EntryService } from '../accounting/entry.service';
import { PrismaService } from '../../database/prisma.service';
import { toBaseUnits } from '../../common/utils/unit-converter';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entryService: EntryService,
  ) {}

  /**
   * Registra una venta y sus productos.
   * Ejecuta la persistencia en una transacción atómica ACID mediante Prisma.
   */
  async createSale(dto: CreateSaleDto, createdById?: string) {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'La venta debe contener al menos un producto.',
      );
    }

    // Los precios enviados por el navegador no se consideran confiables.
    // Calculamos el total a partir de las líneas de la venta.
    const items = dto.items.map((item) => {
      const lineTotal = this.roundMoney(item.quantity * item.unitPrice);

      return {
        productId: item.productId,
        productName: item.productName.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      };
    });

    if (items.some((item) => !item.productName)) {
      throw new BadRequestException(
        'Todos los productos deben tener un nombre.',
      );
    }

    const itemsTotal = this.roundMoney(
      items.reduce((sum, item) => sum + item.lineTotal, 0),
    );

    const declaredTotal = this.roundMoney(dto.total);
    const declaredSubtotal = this.roundMoney(dto.subtotal);
    const declaredTax = this.roundMoney(dto.taxAmount);

    if (Math.abs(itemsTotal - declaredTotal) > 0.01) {
      throw new BadRequestException(
        'El total de la venta no coincide con el total de sus productos.',
      );
    }

    if (
      Math.abs(
        this.roundMoney(declaredSubtotal + declaredTax) - declaredTotal,
      ) > 0.01
    ) {
      throw new BadRequestException(
        'El subtotal más el impuesto debe coincidir con el total.',
      );
    }

    // El ticket se genera en el servidor para evitar depender
    // del número que envíe el navegador.
    const ticketNumber = `TK-${Date.now()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    // 1. Guardar la cabecera y el detalle en una transacción ACID y descontar stock
    let sale;
    try {
      sale = await this.prisma.$transaction(async (tx) => {
        // Descontar inventario de los productos reales vendidos y sus recetas
        const ingredientDeductionsMap = new Map<
          string,
          {
            ingredientId: string;
            ingredientName: string;
            totalDeduction: number;
            stockUnit: string;
            currentStock: number;
          }
        >();

        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
            include: {
              recipe: {
                include: {
                  ingredients: {
                    include: {
                      ingredients: true,
                    },
                  },
                },
              },
            },
          });

          if (!product) {
            throw new BadRequestException(
              `El producto "${item.productName}" no fue encontrado en el catálogo.`,
            );
          }

          if (Number(product.stock) < item.quantity) {
            throw new BadRequestException(
              `Stock insuficiente para "${product.name}". Disponible: ${product.stock}, solicitado: ${item.quantity}.`,
            );
          }

          // Descontar existencias del producto comercial
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                decrement: item.quantity,
              },
            },
          });

          // Si el producto es de elaboración propia (manufactured), descontar insumos de su receta
          if (
            product.productType === 'manufactured' &&
            product.recipe?.ingredients?.length
          ) {
            const yieldServings = Math.max(1, product.recipe.yieldServings || 1);

            for (const ri of product.recipe.ingredients) {
              const ing = ri.ingredients;
              if (!ing) continue;

              const currentStock = Number(ing.stock ?? 0);
              const stockUnit = ing.unit || 'kg';
              const recipeQtyForSale =
                (Number(ri.quantity) / yieldServings) * item.quantity;
              const recipeUnit = ri.unit;

              const reqNorm = toBaseUnits(recipeQtyForSale, recipeUnit);
              const stockNorm = toBaseUnits(1, stockUnit);

              let deductionInStockUnit = recipeQtyForSale;
              if (reqNorm.type === stockNorm.type && stockNorm.value > 0) {
                deductionInStockUnit = reqNorm.value / stockNorm.value;
              }

              const existing = ingredientDeductionsMap.get(ing.id);
              if (existing) {
                existing.totalDeduction += deductionInStockUnit;
              } else {
                ingredientDeductionsMap.set(ing.id, {
                  ingredientId: ing.id,
                  ingredientName: ing.name,
                  totalDeduction: deductionInStockUnit,
                  stockUnit,
                  currentStock,
                });
              }
            }
          }
        }

        // Aplicar deducciones acumuladas de ingredientes en bodega
        for (const deduction of ingredientDeductionsMap.values()) {
          const roundedDeduction = Number(deduction.totalDeduction.toFixed(3));
          const newStock = Math.max(
            0,
            Number((deduction.currentStock - roundedDeduction).toFixed(3)),
          );

          await tx.ingredient.update({
            where: { id: deduction.ingredientId },
            data: {
              stock: newStock,
            },
          });
        }

        return tx.posSale.create({
          data: {
            ticketNumber,
            paymentMethod: dto.paymentMethod,
            subtotal: declaredSubtotal,
            taxAmount: declaredTax,
            total: declaredTotal,
            status: 'completada',
            accountingStatus: 'posted',
            dataOrigin: 'real',
            createdById: createdById ?? null,
            items: {
              create: items.map((item) => ({
                productId: item.productId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            createdBy: {
              select: { id: true, name: true, role: true },
            },
          },
        });
      });
    } catch (createError) {
      if (createError instanceof BadRequestException) {
        throw createError;
      }
      console.error(
        '[PosService] Error registrando venta de forma atómica:',
        createError,
      );
      throw new InternalServerErrorException(
        'No se pudo registrar la venta ni actualizar el inventario.',
      );
    }

    // 2. Registrar el ingreso contable asociado a esta venta (desacoplado y con tolerancia a fallos)
    let accountingStatus: 'posted' | 'pending' = 'posted';
    let accountingWarning: string | null = null;

    const accountingEntryCreated = declaredTotal > 0;
    if (accountingEntryCreated) {
      try {
        await this.entryService.registerSaleIncome({
          id: sale.id,
          ticketNumber: sale.ticketNumber,
          soldAt: sale.soldAt.toISOString(),
          total: declaredTotal,
          paymentMethod: sale.paymentMethod,
        });
      } catch (accError) {
        accountingStatus = 'pending';
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar en contabilidad';
        accountingWarning = `Venta registrada en caja. La sincronización contable quedó pendiente: ${errorMsg}`;
        console.warn(
          `[PosService] Venta ${sale.ticketNumber} guardada, pero falló la contabilización:`,
          errorMsg,
        );

        await this.prisma.posSale.update({
          where: { id: sale.id },
          data: {
            accountingStatus: 'pending',
            accountingError: errorMsg,
          },
        });
      }
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      status: sale.status,
      accountingStatus,
      accountingWarning,
      soldAt: sale.soldAt.toISOString(),
      dataOrigin: sale.dataOrigin,
      cashierName: sale.createdBy?.name || 'Cajero no asignado',
      cashierRole: sale.createdBy?.role || 'cashier',
      accountingEntryCreated,
      items: sale.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        line_total: Number(item.lineTotal),
        saleId: item.saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  /**
   * Obtiene las últimas ventas guardadas.
   */
  async findAllSales() {
    try {
      const sales = await this.prisma.posSale.findMany({
        include: {
          items: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          }
        },
        orderBy: { soldAt: 'desc' },
        take: 20,
      });

      return sales.map((sale) => ({
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        paymentMethod: sale.paymentMethod,
        subtotal: Number(sale.subtotal),
        taxAmount: Number(sale.taxAmount),
        total: Number(sale.total),
        status: sale.status,
        accountingStatus: sale.accountingStatus ?? 'posted',
        accountingError: sale.accountingError ?? null,
        soldAt: sale.soldAt.toISOString(),
        dataOrigin: sale.dataOrigin,
        cashierName: sale.createdBy?.name || 'Cajero no asignado',
        cashierRole: sale.createdBy?.role || 'cashier',
        items: sale.items.map((item) => ({
          id: item.id,
          sale_id: item.saleId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          line_total: Number(item.lineTotal),
          saleId: item.saleId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      }));
    } catch (error) {
      console.error('[PosService] Error consultando ventas:', error);

      throw new InternalServerErrorException(
        'No se pudo consultar el historial de ventas.',
      );
    }
  }

  /**
   * Obtiene una venta específica con sus productos.
   */
  async findSaleById(id: string) {
    let sale;
    try {
      sale = await this.prisma.posSale.findUnique({
        where: { id },
        include: {
          items: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });
    } catch (error) {
      console.error('[PosService] Error consultando venta:', error);

      throw new InternalServerErrorException(
        'No se pudo consultar la venta.',
      );
    }

    if (!sale) {
      throw new BadRequestException('La venta solicitada no existe.');
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      status: sale.status,
      accountingStatus: sale.accountingStatus ?? 'posted',
      accountingError: sale.accountingError ?? null,
      soldAt: sale.soldAt.toISOString(),
      dataOrigin: sale.dataOrigin,
      cashierName: sale.createdBy?.name || 'Cajero no asignado',
      cashierRole: sale.createdBy?.role || 'cashier',
      items: sale.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        line_total: Number(item.lineTotal),
        saleId: item.saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}