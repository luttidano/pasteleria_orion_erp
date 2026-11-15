import {
  BadRequestException,
  ConflictException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  resolveSecondaryPackagingPrice,
  roundMoney,
} from '../../../common/utils/money.util';
import { StockMovementService } from './stock-movement.service';

export interface SaleStockRequestItem {
  productId?: string | null;
  packagingId?: string | null;
  quantity: number;
}

export interface PricedSaleLine {
  productId: string | null;
  packagingId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
  lineTotal: number;
}

export interface SaleStockDeductionContext {
  saleId?: string;
  ticketNumber?: string;
  createdById?: string;
}

@Injectable()
export class InventoryStockService {
  constructor(
    @Optional() private readonly stockMovementService?: StockMovementService,
  ) {}

  /**
   * Reserva, valida precios autoritativos en base de datos, descuenta atómicamente
   * el inventario de productos y empaques secundarios dentro de una transacción Prisma
   * y registra las salidas en el Kardex (`stock_movement`).
   */
  async reserveAndDeductForSaleInTx(
    tx: Prisma.TransactionClient,
    items: SaleStockRequestItem[],
    context?: SaleStockDeductionContext,
  ): Promise<PricedSaleLine[]> {
    if (!items || items.length === 0) {
      throw new BadRequestException(
        'La venta debe contener al menos un producto o empaque.',
      );
    }

    const productTotals = new Map<string, number>();
    const packagingTotals = new Map<string, number>();

    for (const item of items) {
      const hasProduct = Boolean(item.productId);
      const hasPackaging = Boolean(item.packagingId);

      if (hasProduct === hasPackaging) {
        throw new BadRequestException(
          'Cada línea de venta debe referenciar exclusivamente un productId o un packagingId.',
        );
      }

      if (!Number.isInteger(item.quantity) || item.quantity <= 0) {
        throw new BadRequestException(
          'La cantidad de cada ítem debe ser un entero positivo.',
        );
      }

      if (item.productId) {
        productTotals.set(
          item.productId,
          (productTotals.get(item.productId) ?? 0) + item.quantity,
        );
      } else if (item.packagingId) {
        packagingTotals.set(
          item.packagingId,
          (packagingTotals.get(item.packagingId) ?? 0) + item.quantity,
        );
      }
    }

    const sortedProductIds = Array.from(productTotals.keys()).sort();
    const sortedPackagingIds = Array.from(packagingTotals.keys()).sort();

    // Adquirir bloqueos pesimistas en orden lexicográfico por UUID para prevenir deadlocks
    if (sortedProductIds.length > 0) {
      await tx.$queryRaw`
        SELECT id
        FROM public.product
        WHERE id IN (${Prisma.join(sortedProductIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY id
        FOR UPDATE
      `;
    }

    if (sortedPackagingIds.length > 0) {
      await tx.$queryRaw`
        SELECT id
        FROM public.packaging
        WHERE id IN (${Prisma.join(sortedPackagingIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY id
        FOR UPDATE
      `;
    }

    const [products, packagings] = await Promise.all([
      sortedProductIds.length > 0
        ? tx.product.findMany({
            where: { id: { in: sortedProductIds } },
            select: {
              id: true,
              name: true,
              stock: true,
              unit: true,
              salePrice: true,
              costPrice: true,
            },
          })
        : Promise.resolve([]),
      sortedPackagingIds.length > 0
        ? tx.packaging.findMany({
            where: { id: { in: sortedPackagingIds } },
            select: {
              id: true,
              name: true,
              packageType: true,
              stock: true,
              unit: true,
              costPrice: true,
              salePrice: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const productMap = new Map(products.map((p) => [p.id, p]));
    const packagingMap = new Map(packagings.map((p) => [p.id, p]));

    for (const productId of sortedProductIds) {
      const product = productMap.get(productId);
      if (!product) {
        throw new BadRequestException(
          `El producto con ID "${productId}" no fue encontrado en el catálogo.`,
        );
      }

      const requiredQty = productTotals.get(productId)!;
      const availableStock = Number(product.stock ?? 0);
      if (availableStock < requiredQty) {
        throw new ConflictException(
          `Stock insuficiente para "${product.name}". Disponible: ${availableStock}, solicitado: ${requiredQty}.`,
        );
      }

      const dbPrice = Number(product.salePrice ?? 0);
      if (!Number.isFinite(dbPrice) || dbPrice < 0) {
        throw new BadRequestException(
          `El producto "${product.name}" tiene un precio inválido en el catálogo.`,
        );
      }
    }

    for (const packagingId of sortedPackagingIds) {
      const pkg = packagingMap.get(packagingId);
      if (!pkg) {
        throw new BadRequestException(
          `El empaque con ID "${packagingId}" no fue encontrado en el catálogo.`,
        );
      }

      if (pkg.packageType !== 'secundario') {
        throw new BadRequestException(
          `El empaque "${pkg.name}" no está habilitado para venta en mostrador (debe ser secundario).`,
        );
      }

      const requiredQty = packagingTotals.get(packagingId)!;
      const availableStock = Number(pkg.stock ?? 0);
      if (availableStock < requiredQty) {
        throw new ConflictException(
          `Stock insuficiente para el empaque "${pkg.name}". Disponible: ${availableStock}, solicitado: ${requiredQty}.`,
        );
      }
    }

    // Descuento condicional atómico garantizado bajo restricción CHECK (stock >= 0) + Kardex
    for (const productId of sortedProductIds) {
      const requiredQty = productTotals.get(productId)!;
      const product = productMap.get(productId)!;
      const stockBefore = Number(product.stock ?? 0);
      const unitCost = roundMoney(Number(product.costPrice ?? 0));

      const updated = await tx.product.updateMany({
        where: {
          id: productId,
          stock: { gte: requiredQty },
        },
        data: {
          stock: { decrement: requiredQty },
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          `Stock insuficiente o modificado concurrentemente para "${product.name}".`,
        );
      }

      if (this.stockMovementService) {
        await this.stockMovementService.recordInTx(tx, {
          itemType: 'product',
          itemId: product.id,
          itemName: product.name,
          movementType: 'sale',
          quantityDelta: -requiredQty,
          unit: product.unit || 'un',
          stockBefore,
          stockAfter: Math.max(0, stockBefore - requiredQty),
          unitCost,
          totalCost: roundMoney(requiredQty * unitCost),
          referenceType: 'pos_sale',
          referenceId: context?.saleId,
          reason: context?.ticketNumber
            ? `Venta POS ${context.ticketNumber}`
            : 'Venta POS',
          createdById: context?.createdById,
        });
      }
    }

    for (const packagingId of sortedPackagingIds) {
      const requiredQty = packagingTotals.get(packagingId)!;
      const pkg = packagingMap.get(packagingId)!;
      const stockBefore = Number(pkg.stock ?? 0);
      const unitCost = roundMoney(Number(pkg.costPrice ?? 0));

      const updated = await tx.packaging.updateMany({
        where: {
          id: packagingId,
          stock: { gte: requiredQty },
        },
        data: {
          stock: { decrement: requiredQty },
          updatedAt: new Date(),
        },
      });

      if (updated.count === 0) {
        throw new ConflictException(
          `Stock insuficiente o modificado concurrentemente para el empaque "${pkg.name}".`,
        );
      }

      if (this.stockMovementService) {
        await this.stockMovementService.recordInTx(tx, {
          itemType: 'packaging',
          itemId: pkg.id,
          itemName: pkg.name,
          movementType: 'sale',
          quantityDelta: -requiredQty,
          unit: pkg.unit || 'un',
          stockBefore,
          stockAfter: Math.max(0, stockBefore - requiredQty),
          unitCost,
          totalCost: roundMoney(requiredQty * unitCost),
          referenceType: 'pos_sale',
          referenceId: context?.saleId,
          reason: context?.ticketNumber
            ? `Venta POS ${context.ticketNumber}`
            : 'Venta POS',
          createdById: context?.createdById,
        });
      }
    }

    return items.map((item) => {
      if (item.productId) {
        const product = productMap.get(item.productId)!;
        const unitPrice = roundMoney(Number(product.salePrice ?? 0));
        const unitCost = roundMoney(Number(product.costPrice ?? 0));
        return {
          productId: product.id,
          packagingId: null,
          productName: product.name,
          quantity: item.quantity,
          unitPrice,
          unitCost,
          lineTotal: roundMoney(unitPrice * item.quantity),
        };
      }

      const pkg = packagingMap.get(item.packagingId!)!;
      const configuredPrice = roundMoney(Number(pkg.salePrice ?? 0));
      const unitPrice =
        configuredPrice > 0
          ? configuredPrice
          : resolveSecondaryPackagingPrice(pkg.name);
      const unitCost = roundMoney(Number(pkg.costPrice ?? 0));
      return {
        productId: null,
        packagingId: pkg.id,
        productName: pkg.name,
        quantity: item.quantity,
        unitPrice,
        unitCost,
        lineTotal: roundMoney(unitPrice * item.quantity),
      };
    });
  }
}
