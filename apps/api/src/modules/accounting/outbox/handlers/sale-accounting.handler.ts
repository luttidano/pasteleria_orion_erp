import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingEntryOrigin } from '../../../../common/enums';
import { toChileBusinessDateString } from '../../../../common/utils/chile-time.util';
import { roundMoney } from '../../../../common/utils/money.util';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../../../common/utils/prisma-error.util';
import { InventoryValuationService } from '../../../inventory/valuation/inventory-valuation.service';
import { SYSTEM_ACCOUNT_CODES } from '../../accounting.constants';
import { AccountingPeriodService } from '../../periods/accounting-period.service';
import { TaxCalculatorService } from '../../tax/tax-calculator.service';
import type {
  AccountingEntryCreatedResult,
  OutboxAggregateType,
  PosSaleCogsRequestedPayload,
  RecoveredSaleItemCost,
  SaleCogsEntryCreatedResult,
  SaleIncomeRequestedPayload,
} from '../accounting-outbox.types';
import { AccountingAccountResolverService } from './accounting-account-resolver.service';
import type {
  AccountingEventHandler,
  AccountingHandlerResult,
  OutboxDispatchEvent,
} from './accounting-event-handler.interface';

const PAYMENT_ASSET_ACCOUNT_MAP: Record<string, string> = {
  efectivo: SYSTEM_ACCOUNT_CODES.CASH,
  debito: SYSTEM_ACCOUNT_CODES.BANK_CARD,
  credito: SYSTEM_ACCOUNT_CODES.BANK_CARD,
  transferencia: SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
};

@Injectable()
export class SaleAccountingHandler implements AccountingEventHandler {
  constructor(
    private readonly accountResolver: AccountingAccountResolverService,
    private readonly periodService: AccountingPeriodService,
    private readonly taxCalculator: TaxCalculatorService,
    @Optional()
    private readonly inventoryValuationService?: InventoryValuationService,
  ) {}

  supports(aggregateType: OutboxAggregateType): boolean {
    return aggregateType === 'pos_sale' || aggregateType === 'pos_sale_cogs';
  }

  async handle(
    event: OutboxDispatchEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingHandlerResult> {
    if (event.aggregateType === 'pos_sale') {
      const payload = event.payload as unknown as SaleIncomeRequestedPayload;
      return this.registerSaleIncome(
        {
          id: event.aggregateId,
          ticketNumber: payload.ticketNumber,
          soldAt: payload.soldAt,
          total: Number(payload.total),
          paymentMethod: payload.paymentMethod,
        },
        tx,
      );
    }

    const payload = event.payload as unknown as PosSaleCogsRequestedPayload;
    return this.registerSaleCogs(event.id, payload, tx);
  }

  async registerSaleIncome(
    sale: {
      id: string;
      ticketNumber: string;
      soldAt: string;
      total: number;
      paymentMethod: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    if (sale.total <= 0) {
      return null;
    }

    const targetAssetCode =
      PAYMENT_ASSET_ACCOUNT_MAP[sale.paymentMethod] ??
      SYSTEM_ACCOUNT_CODES.CASH;
    const { assetAccount, salesAccount, vatAccount } =
      await this.accountResolver.resolveSaleAccounts(targetAssetCode);

    const breakdown = this.taxCalculator.breakdownFromGross(sale.total, {
      isExempt: !vatAccount,
    });
    const total = breakdown.totalAmount;
    const netSales = breakdown.netAmount;
    const vatAmount = breakdown.vatAmount;

    const itemsToCreate = [
      {
        accountId: assetAccount.id,
        debit: total,
        credit: 0,
        description: `Ingreso venta ${sale.paymentMethod}`,
      },
      {
        accountId: salesAccount.id,
        debit: 0,
        credit: netSales,
        description: 'Venta neta productos',
      },
    ];

    if (vatAmount > 0 && vatAccount) {
      itemsToCreate.push({
        accountId: vatAccount.id,
        debit: 0,
        credit: vatAmount,
        description: '19% IVA Débito Fiscal',
      });
    }

    const saleDateStr = toChileBusinessDateString(sale.soldAt);

    try {
      return await this.accountResolver.runInTransaction(tx, async (activeTx) => {
        await this.accountResolver.acquireAdvisoryLock(
          activeTx,
          'accounting:pos_sale',
          sale.id,
        );

        const existingInTx = await activeTx.accountingEntry.findFirst({
          where: { posSaleId: sale.id, status: 'active' },
          select: { id: true, entryNumber: true },
        });
        if (existingInTx) {
          return {
            entryId: existingInTx.id,
            entryNumber: Number(existingInTx.entryNumber),
          };
        }

        await this.periodService.assertPeriodOpen(saleDateStr, activeTx);

        const created = await activeTx.accountingEntry.create({
          data: {
            entryDate: new Date(`${saleDateStr}T00:00:00.000Z`),
            concept: `Venta POS ${sale.ticketNumber}`,
            origin: AccountingEntryOrigin.pos,
            status: 'active',
            posSaleId: sale.id,
            items: { create: itemsToCreate },
          },
          select: { id: true, entryNumber: true },
        });

        return {
          entryId: created.id,
          entryNumber: Number(created.entryNumber),
        };
      });
    } catch (error) {
      if (!tx && isUniqueViolation(error)) {
        const existing = await this.accountResolver
          .getPrisma()
          .accountingEntry.findFirst({
            where: { posSaleId: sale.id, status: 'active' },
            select: { id: true, entryNumber: true },
          })
          .catch(() => null);
        if (existing) {
          return {
            entryId: existing.id,
            entryNumber: Number(existing.entryNumber),
          };
        }
      }
      rethrowPrismaError(error, {
        fallback: 'No se pudo generar el asiento contable de la venta.',
      });
    }
  }

  async registerSaleCogs(
    outboxId: string,
    payload: PosSaleCogsRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleCogsEntryCreatedResult | null> {
    if (!payload.items || payload.items.length === 0) {
      return null;
    }

    const entryDateStr = toChileBusinessDateString(payload.soldAt);

    try {
      return await this.accountResolver.runInTransaction(tx, async (activeTx) => {
        await this.accountResolver.acquireAdvisoryLock(
          activeTx,
          'accounting:outbox',
          outboxId,
        );

        const existing = await this.accountResolver.findExistingByOutboxId(
          activeTx,
          outboxId,
        );
        if (existing) {
          return existing;
        }

        const missingProductIds = payload.items
          .filter((it) => it.productId && Number(it.unitCost ?? 0) <= 0)
          .map((it) => it.productId as string);
        const missingPackagingIds = payload.items
          .filter((it) => it.packagingId && Number(it.unitCost ?? 0) <= 0)
          .map((it) => it.packagingId as string);

        const refreshedCosts =
          (missingProductIds.length > 0 || missingPackagingIds.length > 0) &&
          this.inventoryValuationService
            ? await this.inventoryValuationService.getSaleItemUnitCostsInTx(
                activeTx,
                missingProductIds,
                missingPackagingIds,
              )
            : { products: new Map(), packagings: new Map() };

        const missingCostNames: string[] = [];
        const recoveredItemCosts: RecoveredSaleItemCost[] = [];
        let productCostTotal = 0;
        let packagingCostTotal = 0;

        for (const line of payload.items) {
          let effectiveUnitCost = roundMoney(Number(line.unitCost ?? 0));
          if (effectiveUnitCost <= 0) {
            if (line.productId) {
              effectiveUnitCost =
                refreshedCosts.products.get(line.productId)?.unitCost ?? 0;
            } else if (line.packagingId) {
              effectiveUnitCost =
                refreshedCosts.packagings.get(line.packagingId)?.unitCost ?? 0;
            }

            if (effectiveUnitCost > 0 && line.saleItemId) {
              recoveredItemCosts.push({
                saleItemId: line.saleItemId,
                unitCost: effectiveUnitCost,
              });
            }
          }

          if (effectiveUnitCost <= 0) {
            missingCostNames.push(line.productName);
            continue;
          }

          const lineCost = roundMoney(effectiveUnitCost * line.quantity);
          if (line.packagingId) {
            packagingCostTotal = roundMoney(packagingCostTotal + lineCost);
          } else {
            productCostTotal = roundMoney(productCostTotal + lineCost);
          }
        }

        if (missingCostNames.length > 0) {
          throw new BadRequestException(
            `Falta configurar el costo unitario (costPrice > 0) para contabilizar el costo de venta de: ${missingCostNames.join(', ')}.`,
          );
        }

        const totalCogs = roundMoney(productCostTotal + packagingCostTotal);
        if (totalCogs <= 0) {
          return null;
        }

        const [cogsAccount, finishedGoodsAccount, rawMaterialsAccount] =
          await Promise.all([
            this.accountResolver.findActiveAccountByCode(
              activeTx,
              [SYSTEM_ACCOUNT_CODES.COGS_FOOD],
              { accountType: 'costo' },
            ),
            productCostTotal > 0
              ? this.accountResolver.findActiveAccountByCode(activeTx, [
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                ])
              : Promise.resolve(null),
            packagingCostTotal > 0
              ? this.accountResolver.findActiveAccountByCode(activeTx, [
                  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                ])
              : Promise.resolve(null),
          ]);

        if (!cogsAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta 5.1.01.01 (Costo de Materias Primas / Ventas) para contabilizar el costo de venta.',
          );
        }
        if (productCostTotal > 0 && !finishedGoodsAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta 1.1.02.02 (Inventario Productos Terminados) para descargar el costo de venta.',
          );
        }
        if (packagingCostTotal > 0 && !rawMaterialsAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta 1.1.02.03 / 1.1.02.01 (Inventario Materias Primas / Empaques) para descargar el costo de empaques vendidos.',
          );
        }

        await this.periodService.assertPeriodOpen(entryDateStr, activeTx);

        const itemsToCreate: Array<{
          accountId: string;
          debit: number;
          credit: number;
          description: string;
        }> = [
          {
            accountId: cogsAccount.id,
            debit: totalCogs,
            credit: 0,
            description: `Costo de venta reconocido ticket ${payload.ticketNumber}`,
          },
        ];

        if (productCostTotal > 0 && finishedGoodsAccount) {
          itemsToCreate.push({
            accountId: finishedGoodsAccount.id,
            debit: 0,
            credit: productCostTotal,
            description: `Salida inventario productos vendidos (${payload.ticketNumber})`,
          });
        }

        if (packagingCostTotal > 0 && rawMaterialsAccount) {
          itemsToCreate.push({
            accountId: rawMaterialsAccount.id,
            debit: 0,
            credit: packagingCostTotal,
            description: `Salida inventario empaques despachados (${payload.ticketNumber})`,
          });
        }

        const created = await activeTx.accountingEntry.create({
          data: {
            entryDate: new Date(`${entryDateStr}T00:00:00.000Z`),
            concept: `Costo de Venta POS ${payload.ticketNumber}`,
            origin: AccountingEntryOrigin.inventory,
            status: 'active',
            outboxId,
            items: { create: itemsToCreate },
          },
          select: { id: true, entryNumber: true },
        });

        return {
          entryId: created.id,
          entryNumber: Number(created.entryNumber),
          ...(recoveredItemCosts.length > 0 ? { recoveredItemCosts } : {}),
        };
      });
    } catch (error) {
      if (!tx && isUniqueViolation(error)) {
        const existing = await this.accountResolver
          .findExistingByOutboxId(this.accountResolver.getPrisma(), outboxId)
          .catch(() => null);
        if (existing) {
          return existing;
        }
      }
      rethrowPrismaError(error, {
        fallback: 'No se pudo generar el asiento contable de costo de venta POS.',
      });
    }
  }
}
