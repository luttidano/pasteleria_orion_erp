import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  InventoryTopValuationItem,
  InventoryValuationReport,
} from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';
import { roundMoney } from '../../../common/utils/money.util';

@Injectable()
export class InventoryValuationService {
  constructor(private readonly prisma: PrismaService) {}

  private computeTopValuation(
    rows: Array<{
      id: string;
      name: string;
      stock: number;
      unit: string;
      unitCost: number;
    }>,
    limit = 8,
  ): { totalValue: number; topItems: InventoryTopValuationItem[] } {
    let totalValue = 0;

    const valued = rows.map((row) => {
      const stockNum = Number(row.stock ?? 0);
      const unitCost = Number(row.unitCost ?? 0);
      const itemValue = roundMoney(stockNum * unitCost);
      totalValue += itemValue;

      return {
        id: row.id,
        name: row.name,
        stock: stockNum,
        unit: row.unit,
        unitCost,
        totalValue: itemValue,
      };
    });

    return {
      totalValue: roundMoney(totalValue),
      topItems: valued.sort((a, b) => b.totalValue - a.totalValue).slice(0, limit),
    };
  }

  /**
   * Valorización física en tiempo real de bodega para reportes financieros:
   * materias primas, empaques y productos terminados / de reventa.
   */
  async getValuationSummary(): Promise<InventoryValuationReport> {
    const [ingredients, packagingList, products, generalSupplies] = await Promise.all([
      this.prisma.ingredient.findMany({
        select: { id: true, name: true, stock: true, unit: true, price: true },
        orderBy: { stock: 'desc' },
      }),
      this.prisma.packaging.findMany({
        select: { id: true, name: true, stock: true, unit: true, costPrice: true },
        orderBy: { stock: 'desc' },
      }),
      this.prisma.product.findMany({
        select: {
          id: true,
          name: true,
          stock: true,
          unit: true,
          costPrice: true,
          salePrice: true,
        },
        orderBy: { stock: 'desc' },
      }),
      this.prisma.generalSupply.findMany({
        select: { id: true, name: true, stock: true, unit: true, costPrice: true },
        orderBy: { stock: 'desc' },
      }),
    ]);

    const rawMaterials = this.computeTopValuation(
      ingredients.map((ing) => ({
        id: ing.id,
        name: ing.name,
        stock: Number(ing.stock ?? 0),
        unit: ing.unit || 'kg',
        unitCost: Number(ing.price ?? 0),
      })),
    );

    const packaging = this.computeTopValuation(
      packagingList.map((pack) => ({
        id: pack.id,
        name: pack.name,
        stock: Number(pack.stock ?? 0),
        unit: pack.unit || 'un',
        unitCost: Number(pack.costPrice ?? 0),
      })),
    );

    const finishedProducts = this.computeTopValuation(
      products.map((prod) => ({
        id: prod.id,
        name: prod.name,
        stock: Number(prod.stock ?? 0),
        unit: prod.unit || 'un',
        unitCost:
          prod.costPrice && Number(prod.costPrice) > 0
            ? Number(prod.costPrice)
            : Number(prod.salePrice ?? 0),
      })),
    );

    const generalSuppliesVal = this.computeTopValuation(
      generalSupplies.map((sup) => ({
        id: sup.id,
        name: sup.name,
        stock: Number(sup.stock ?? 0),
        unit: sup.unit || 'un',
        unitCost: Number(sup.costPrice ?? 0),
      })),
    );

    return {
      totalWarehouseValue: roundMoney(
        rawMaterials.totalValue +
          packaging.totalValue +
          finishedProducts.totalValue +
          generalSuppliesVal.totalValue,
      ),
      rawMaterialsValue: rawMaterials.totalValue,
      packagingValue: packaging.totalValue,
      finishedProductsValue: finishedProducts.totalValue,
      generalSuppliesValue: generalSuppliesVal.totalValue,
      topRawMaterials: rawMaterials.topItems,
      topPackaging: packaging.topItems,
      topProducts: finishedProducts.topItems,
      topGeneralSupplies: generalSuppliesVal.topItems,
    };
  }

  /**
   * Consulta costos unitarios actuales de insumos para resolver eventos contables diferidos.
   */
  async getIngredientUnitCostsInTx(
    tx: Prisma.TransactionClient,
    ingredientIds: string[],
  ): Promise<Map<string, { name: string; unitCost: number }>> {
    if (ingredientIds.length === 0) {
      return new Map();
    }
    const rows = await tx.ingredient.findMany({
      where: { id: { in: ingredientIds } },
      select: { id: true, name: true, price: true },
    });
    return new Map(
      rows.map((r) => [
        r.id,
        { name: r.name, unitCost: roundMoney(Number(r.price ?? 0)) },
      ]),
    );
  }

  /**
   * Consulta costos unitarios actuales de productos y empaques para resolver COGS diferido.
   */
  async getSaleItemUnitCostsInTx(
    tx: Prisma.TransactionClient,
    productIds: string[],
    packagingIds: string[],
  ): Promise<{
    products: Map<string, { name: string; unitCost: number }>;
    packagings: Map<string, { name: string; unitCost: number }>;
  }> {
    const [products, packagings] = await Promise.all([
      productIds.length > 0
        ? tx.product.findMany({
            where: { id: { in: productIds } },
            select: { id: true, name: true, costPrice: true },
          })
        : Promise.resolve([]),
      packagingIds.length > 0
        ? tx.packaging.findMany({
            where: { id: { in: packagingIds } },
            select: { id: true, name: true, costPrice: true },
          })
        : Promise.resolve([]),
    ]);

    return {
      products: new Map(
        products.map((p) => [
          p.id,
          { name: p.name, unitCost: roundMoney(Number(p.costPrice ?? 0)) },
        ]),
      ),
      packagings: new Map(
        packagings.map((pk) => [
          pk.id,
          { name: pk.name, unitCost: roundMoney(Number(pk.costPrice ?? 0)) },
        ]),
      ),
    };
  }

  /**
   * Consulta el costo unitario actual de un ítem específico de inventario.
   */
  async getItemUnitCostInTx(
    tx: Prisma.TransactionClient,
    itemType: 'ingredient' | 'product' | 'packaging' | 'general_supply',
    itemId: string,
  ): Promise<number> {
    if (itemType === 'ingredient') {
      const row = await tx.ingredient.findUnique({
        where: { id: itemId },
        select: { price: true },
      });
      return roundMoney(Number(row?.price ?? 0));
    }
    if (itemType === 'product') {
      const row = await tx.product.findUnique({
        where: { id: itemId },
        select: { costPrice: true },
      });
      return roundMoney(Number(row?.costPrice ?? 0));
    }
    if (itemType === 'packaging') {
      const row = await tx.packaging.findUnique({
        where: { id: itemId },
        select: { costPrice: true },
      });
      return roundMoney(Number(row?.costPrice ?? 0));
    }
    const row = await tx.generalSupply.findUnique({
      where: { id: itemId },
      select: { costPrice: true },
    });
    return roundMoney(Number(row?.costPrice ?? 0));
  }
}
