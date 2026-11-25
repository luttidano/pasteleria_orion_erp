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
  InventoryAdjustmentRequestedPayload,
  InventoryProductionRequestedPayload,
  InventoryPurchaseRequestedPayload,
  OutboxAggregateType,
} from '../accounting-outbox.types';
import { AccountingAccountResolverService } from './accounting-account-resolver.service';
import type {
  AccountingEventHandler,
  AccountingHandlerResult,
  OutboxDispatchEvent,
} from './accounting-event-handler.interface';

@Injectable()
export class InventoryAccountingHandler implements AccountingEventHandler {
  constructor(
    private readonly accountResolver: AccountingAccountResolverService,
    private readonly periodService: AccountingPeriodService,
    private readonly taxCalculator: TaxCalculatorService,
    @Optional()
    private readonly inventoryValuationService?: InventoryValuationService,
  ) {}

  supports(aggregateType: OutboxAggregateType): boolean {
    return (
      aggregateType === 'inventory_purchase' ||
      aggregateType === 'inventory_production' ||
      aggregateType === 'inventory_adjustment'
    );
  }

  async handle(
    event: OutboxDispatchEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingHandlerResult> {
    if (event.aggregateType === 'inventory_purchase') {
      return this.registerInventoryPurchase(
        event.id,
        event.payload as unknown as InventoryPurchaseRequestedPayload,
        tx,
      );
    }
    if (event.aggregateType === 'inventory_production') {
      return this.registerProductionTransfer(
        event.id,
        event.payload as unknown as InventoryProductionRequestedPayload,
        tx,
      );
    }
    return this.registerInventoryAdjustment(
      event.id,
      event.payload as unknown as InventoryAdjustmentRequestedPayload,
      tx,
    );
  }

  async registerInventoryPurchase(
    outboxId: string,
    payload: InventoryPurchaseRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const rawTotal = roundMoney(Number(payload.totalCost));
    if (rawTotal <= 0) {
      throw new BadRequestException(
        `No se puede contabilizar la compra de "${payload.itemName}" con costo $0.`,
      );
    }

    const hasInvoice = payload.hasInvoice !== false;
    const breakdown = this.taxCalculator.breakdownFromGross(rawTotal, {
      isExempt: !hasInvoice,
    });
    const totalCost = breakdown.totalAmount;
    const netAmount = breakdown.netAmount;
    const vatCredit = breakdown.vatAmount;
    const entryDateStr = toChileBusinessDateString(payload.occurredAt);

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

        const debitAccount =
          payload.itemType === 'general_supply'
            ? await this.accountResolver.findActiveAccountByCode(
                activeTx,
                [SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSES],
                { accountType: 'gasto' },
              )
            : payload.itemType === 'product'
              ? await this.accountResolver.findActiveAccountByCode(activeTx, [
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                ])
              : await this.accountResolver.findActiveAccountByCode(activeTx, [
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                ]);

        if (!debitAccount) {
          throw new InternalServerErrorException(
            payload.itemType === 'general_supply'
              ? 'Falta la cuenta de Gastos Operacionales (6.1.01.01) para registrar la compra.'
              : 'Faltan las cuentas de Inventario (1.1.02.01 / 1.1.02.02) para registrar la compra.',
          );
        }

        const vatCreditAccount =
          vatCredit > 0
            ? (await this.accountResolver.findActiveAccountByCode(activeTx, [
                SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
              ])) ??
              (await activeTx.accountingAccount.findFirst({
                where: {
                  isActive: true,
                  isGroup: false,
                  accountType: 'activo',
                  name: { contains: 'IVA Cr', mode: 'insensitive' },
                },
                orderBy: { code: 'asc' },
              }))
            : null;

        if (vatCredit > 0 && !vatCreditAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta contable 1.1.03.01 (IVA Crédito Fiscal) para registrar compras con factura.',
          );
        }

        const creditAccount =
          await this.accountResolver.resolveTreasuryAccountForPayment(
            activeTx,
            payload.paymentMethod,
            { allowSupplierCredit: true },
          );

        if (!creditAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta contable de pago o proveedor para registrar la compra.',
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
            accountId: debitAccount.id,
            debit: netAmount,
            credit: 0,
            description:
              payload.itemType === 'general_supply'
                ? `Gasto compra ${payload.quantity} ${payload.unit} de ${payload.itemName}`
                : `Ingreso inventario ${payload.quantity} ${payload.unit} de ${payload.itemName}`,
          },
        ];

        if (vatCredit > 0 && vatCreditAccount) {
          itemsToCreate.push({
            accountId: vatCreditAccount.id,
            debit: vatCredit,
            credit: 0,
            description: '19% IVA Crédito Fiscal factura de compra',
          });
        }

        itemsToCreate.push({
          accountId: creditAccount.id,
          debit: 0,
          credit: totalCost,
          description: `Pago / obligación compra (${payload.paymentMethod})`,
        });

        const created = await activeTx.accountingEntry.create({
          data: {
            entryDate: new Date(`${entryDateStr}T00:00:00.000Z`),
            concept: `Compra Inventario: ${payload.itemName} (${payload.quantity} ${payload.unit})`,
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
        fallback:
          'No se pudo generar el asiento contable de la compra de inventario.',
      });
    }
  }

  async registerProductionTransfer(
    outboxId: string,
    payload: InventoryProductionRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const entryDateStr = toChileBusinessDateString(payload.producedAt);

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

        let resolvedTotalCost = roundMoney(Number(payload.totalCost ?? 0));
        const missingList = payload.missingCostIngredients ?? [];

        if (missingList.length > 0 || resolvedTotalCost <= 0) {
          if (missingList.length > 0 && this.inventoryValuationService) {
            const refreshedPrices =
              await this.inventoryValuationService.getIngredientUnitCostsInTx(
                activeTx,
                missingList.map((m) => m.ingredientId),
              );

            const stillMissing: string[] = [];
            let recoveredCost = 0;
            for (const missing of missingList) {
              const found = refreshedPrices.get(missing.ingredientId);
              if (!found || found.unitCost <= 0) {
                stillMissing.push(missing.name);
              } else {
                recoveredCost = roundMoney(
                  recoveredCost + roundMoney(missing.deductedQty * found.unitCost),
                );
              }
            }

            if (stillMissing.length > 0) {
              throw new BadRequestException(
                `Falta configurar el precio unitario en catálogo para los insumos: ${stillMissing.join(', ')}.`,
              );
            }
            resolvedTotalCost = roundMoney(resolvedTotalCost + recoveredCost);
          } else if (missingList.length > 0) {
            throw new BadRequestException(
              `Falta configurar el precio unitario en catálogo para los insumos: ${missingList.map((m) => m.name).join(', ')}.`,
            );
          }
        }

        if (resolvedTotalCost <= 0) {
          throw new BadRequestException(
            `No se puede contabilizar la producción de "${payload.productName}" con costo $0. Configura el precio unitario de sus insumos.`,
          );
        }

        const [rawMaterialAccount, finishedGoodsAccount] = await Promise.all([
          this.accountResolver.findActiveAccountByCode(activeTx, [
            SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
          ]),
          this.accountResolver.findActiveAccountByCode(activeTx, [
            SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
          ]),
        ]);

        if (!rawMaterialAccount || !finishedGoodsAccount) {
          throw new InternalServerErrorException(
            'Faltan las cuentas 1.1.02.01 (Inventario Materias Primas) y 1.1.02.02 (Inventario Productos Terminados) para contabilizar la producción.',
          );
        }

        await this.periodService.assertPeriodOpen(entryDateStr, activeTx);

        const created = await activeTx.accountingEntry.create({
          data: {
            entryDate: new Date(`${entryDateStr}T00:00:00.000Z`),
            concept: `Producción Receta "${payload.recipeName}" → ${payload.productName} (${payload.unitsProduced} u.)`,
            origin: AccountingEntryOrigin.inventory,
            status: 'active',
            outboxId,
            items: {
              create: [
                {
                  accountId: finishedGoodsAccount.id,
                  debit: resolvedTotalCost,
                  credit: 0,
                  description: `Alta producto terminado (${payload.unitsProduced} u. de ${payload.productName})`,
                },
                {
                  accountId: rawMaterialAccount.id,
                  debit: 0,
                  credit: resolvedTotalCost,
                  description: `Consumo materias primas en ${payload.batches} tanda(s) de ${payload.recipeName}`,
                },
              ],
            },
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
          .findExistingByOutboxId(this.accountResolver.getPrisma(), outboxId)
          .catch(() => null);
        if (existing) {
          return existing;
        }
      }
      rethrowPrismaError(error, {
        fallback: 'No se pudo generar el asiento contable de producción.',
      });
    }
  }

  async registerInventoryAdjustment(
    outboxId: string,
    payload: InventoryAdjustmentRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const entryDateStr = toChileBusinessDateString(payload.occurredAt);

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

        let resolvedTotalCost = roundMoney(Number(payload.totalCost ?? 0));
        if (resolvedTotalCost <= 0 && this.inventoryValuationService) {
          const refreshedUnitCost =
            await this.inventoryValuationService.getItemUnitCostInTx(
              activeTx,
              payload.itemType,
              payload.itemId,
            );
          if (refreshedUnitCost > 0) {
            resolvedTotalCost = roundMoney(
              Math.abs(Number(payload.quantityDelta)) * refreshedUnitCost,
            );
          }
        }

        if (resolvedTotalCost <= 0) {
          throw new BadRequestException(
            `Falta configurar el costo unitario de "${payload.itemName}" para contabilizar el ajuste de inventario.`,
          );
        }

        const inventoryAccount =
          payload.itemType === 'product'
            ? await this.accountResolver.findActiveAccountByCode(activeTx, [
                SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
              ])
            : await this.accountResolver.findActiveAccountByCode(activeTx, [
                SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
              ]);

        if (!inventoryAccount) {
          throw new InternalServerErrorException(
            'Faltan las cuentas de Inventario (1.1.02.01 / 1.1.02.02) para registrar el ajuste.',
          );
        }

        const isSurplus = payload.reasonType === 'recount_surplus';
        let itemsToCreate: Array<{
          accountId: string;
          debit: number;
          credit: number;
          description: string;
        }>;
        let conceptPrefix: string;

        if (isSurplus) {
          const surplusAccount =
            await this.accountResolver.findActiveAccountByCode(
              activeTx,
              [SYSTEM_ACCOUNT_CODES.OTHER_INCOME_SURPLUS],
              { accountType: 'ingreso' },
            );
          if (!surplusAccount) {
            throw new InternalServerErrorException(
              'Falta cuenta de Sobrantes / Otros Ingresos (4.1.02.01) para ajustar inventario.',
            );
          }
          conceptPrefix = 'Sobrante Inventario';
          itemsToCreate = [
            {
              accountId: inventoryAccount.id,
              debit: resolvedTotalCost,
              credit: 0,
              description: `Ajuste positivo (${payload.quantityDelta} ${payload.unit}) ${payload.itemName}`,
            },
            {
              accountId: surplusAccount.id,
              debit: 0,
              credit: resolvedTotalCost,
              description:
                payload.reason?.trim() || 'Sobrante detectado en conteo físico',
            },
          ];
        } else {
          const isInternalUse = payload.reasonType === 'internal_use';
          const counterAccount = isInternalUse
            ? await this.accountResolver.findActiveAccountByCode(
                activeTx,
                [SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSES],
                { accountType: 'gasto' },
              )
            : await this.accountResolver.findActiveAccountByCode(
                activeTx,
                [
                  SYSTEM_ACCOUNT_CODES.WASTE_SHORTAGE,
                  SYSTEM_ACCOUNT_CODES.COGS_FOOD,
                ],
                { accountType: 'gasto' },
              );

          if (!counterAccount) {
            throw new InternalServerErrorException(
              'Falta cuenta de Merma / Gasto (6.1.02.02 / 6.1.01.01) para registrar la salida de inventario.',
            );
          }

          conceptPrefix =
            payload.reasonType === 'waste'
              ? 'Merma Inventario'
              : isInternalUse
                ? 'Consumo Interno'
                : 'Faltante Inventario';

          itemsToCreate = [
            {
              accountId: counterAccount.id,
              debit: resolvedTotalCost,
              credit: 0,
              description:
                payload.reason?.trim() ||
                `${conceptPrefix}: ${Math.abs(payload.quantityDelta)} ${payload.unit} de ${payload.itemName}`,
            },
            {
              accountId: inventoryAccount.id,
              debit: 0,
              credit: resolvedTotalCost,
              description: `Salida de bodega (${payload.itemName})`,
            },
          ];
        }

        await this.periodService.assertPeriodOpen(entryDateStr, activeTx);

        const created = await activeTx.accountingEntry.create({
          data: {
            entryDate: new Date(`${entryDateStr}T00:00:00.000Z`),
            concept: `${conceptPrefix}: ${payload.itemName} (${payload.quantityDelta > 0 ? '+' : ''}${payload.quantityDelta} ${payload.unit})`,
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
        fallback:
          'No se pudo generar el asiento contable de ajuste de inventario.',
      });
    }
  }
}
