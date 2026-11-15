import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin } from '../../../common/enums';
import { AccountingPeriodService } from '../periods/accounting-period.service';
import { InventoryValuationService } from '../../inventory/valuation/inventory-valuation.service';
import type {
  AccountingEntryCreatedResult,
  InventoryAdjustmentRequestedPayload,
  InventoryProductionRequestedPayload,
  InventoryPurchaseRequestedPayload,
  PosSaleCogsRequestedPayload,
  RecoveredSaleItemCost,
  SaleCogsEntryCreatedResult,
} from './accounting-outbox.types';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../../common/utils/prisma-error.util';
import { toChileBusinessDateString } from '../../../common/utils/chile-time.util';
import { roundMoney } from '../../../common/utils/money.util';

const PAYMENT_ASSET_ACCOUNT_MAP: Record<string, string> = {
  efectivo: '1101',
  debito: '1102',
  credito: '1102',
  transferencia: '1102',
};

@Injectable()
export class AccountingIntegrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: AccountingPeriodService,
    @Optional()
    private readonly inventoryValuationService?: InventoryValuationService,
  ) {}

  private async runInTransaction<T>(
    tx: Prisma.TransactionClient | undefined,
    callback: (activeTx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (tx) {
      return callback(tx);
    }
    return this.prisma.$transaction(callback);
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

    const targetAssetCode = PAYMENT_ASSET_ACCOUNT_MAP[sale.paymentMethod] ?? '1101';
    const { assetAccount, salesAccount, vatAccount } =
      await this.resolveSaleAccounts(targetAssetCode);

    const total = roundMoney(sale.total);
    let netSales = total;
    let vatAmount = 0;

    if (vatAccount) {
      netSales = roundMoney(total / 1.19);
      vatAmount = roundMoney(total - netSales);
    }

    const itemsToCreate = [
      { accountId: assetAccount.id, debit: total, credit: 0, description: `Ingreso venta ${sale.paymentMethod}` },
      { accountId: salesAccount.id, debit: 0, credit: netSales, description: 'Venta neta productos' },
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
    const lockKey = `accounting:pos_sale:${sale.id}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

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
        const existing = await this.prisma.accountingEntry
          .findFirst({
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

  private async resolveSaleAccounts(targetAssetCode: string) {
    const [assetAccount, salesAccount, vatAccount] = await Promise.all([
      (async () =>
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: targetAssetCode },
        })) ??
        (targetAssetCode !== '1101' && targetAssetCode !== '1102'
          ? await this.prisma.accountingAccount.findFirst({
              where: { isActive: true, code: '1102' },
            })
          : null) ??
        (targetAssetCode !== '1101'
          ? await this.prisma.accountingAccount.findFirst({
              where: { isActive: true, code: '1101' },
            })
          : null) ??
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            accountType: 'activo',
            code: { notIn: ['1105', '1106', '1108'] },
          },
          orderBy: { code: 'asc' },
        })))(),
      (async () =>
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '4101' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, accountType: 'ingreso' },
          orderBy: { code: 'asc' },
        })))(),
      (async () =>
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '2102' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '2105' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            accountType: 'pasivo',
            name: { contains: 'IVA', mode: 'insensitive' },
          },
          orderBy: { code: 'asc' },
        })))(),
    ]);

    if (!assetAccount || !salesAccount) {
      throw new InternalServerErrorException(
        'Faltan cuentas contables básicas (Activo o Ingreso) para registrar la venta.',
      );
    }

    return { assetAccount, salesAccount, vatAccount };
  }

  async registerShiftDifferenceAdjustment(
    params: {
      shiftId: string;
      shiftNumber: number;
      closedAt: string;
      cashDifference: number;
      entryDate?: string;
    },
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const diff = roundMoney(params.cashDifference);
    if (Math.abs(diff) < 0.01) {
      return null;
    }

    const cashAccount =
      (await this.prisma.accountingAccount.findFirst({
        where: { isActive: true, code: '1101' },
      })) ??
      (await this.prisma.accountingAccount.findFirst({
        where: {
          isActive: true,
          accountType: 'activo',
          code: { notIn: ['1105', '1106', '1108'] },
        },
        orderBy: { code: 'asc' },
      }));

    if (!cashAccount) {
      throw new InternalServerErrorException(
        'Falta la cuenta contable de Caja Efectivo (1101) para registrar diferencias de arqueo.',
      );
    }

    const absDiff = roundMoney(Math.abs(diff));
    const isOverage = diff > 0;
    const entryDateStr = params.entryDate
      ? toChileBusinessDateString(params.entryDate)
      : toChileBusinessDateString(params.closedAt);

    let counterAccount;
    if (isOverage) {
      counterAccount =
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '4102' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, accountType: 'ingreso' },
          orderBy: { code: 'asc' },
        }));
    } else {
      counterAccount =
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '6103' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '6102' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, accountType: 'gasto' },
          orderBy: { code: 'asc' },
        }));
    }

    if (!counterAccount) {
      throw new InternalServerErrorException(
        isOverage
          ? 'Falta una cuenta de Ingresos / Sobrantes de Caja (4102) para ajustar el arqueo.'
          : 'Falta una cuenta de Gastos / Faltantes de Caja (6103) para ajustar el arqueo.',
      );
    }

    const itemsToCreate = isOverage
      ? [
          {
            accountId: cashAccount.id,
            debit: absDiff,
            credit: 0,
            description: `Sobrante detectado en arqueo Turno #${params.shiftNumber}`,
          },
          {
            accountId: counterAccount.id,
            debit: 0,
            credit: absDiff,
            description: `Ingreso por sobrante de caja Turno #${params.shiftNumber}`,
          },
        ]
      : [
          {
            accountId: counterAccount.id,
            debit: absDiff,
            credit: 0,
            description: `Faltante detectado en arqueo Turno #${params.shiftNumber}`,
          },
          {
            accountId: cashAccount.id,
            debit: 0,
            credit: absDiff,
            description: `Ajuste faltante en gaveta Turno #${params.shiftNumber}`,
          },
        ];

    const lockKey = `accounting:pos_shift:${params.shiftId}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await activeTx.accountingEntry.findFirst({
          where: { posShiftId: params.shiftId, status: 'active' },
          select: { id: true, entryNumber: true },
        });

        if (existing) {
          return {
            entryId: existing.id,
            entryNumber: Number(existing.entryNumber),
          };
        }

        await this.periodService.assertPeriodOpen(entryDateStr, activeTx);

        const created = await activeTx.accountingEntry.create({
          data: {
            entryDate: new Date(`${entryDateStr}T00:00:00.000Z`),
            concept: isOverage
              ? `Ajuste Arqueo Caja Turno #${params.shiftNumber} (Sobrante)`
              : `Ajuste Arqueo Caja Turno #${params.shiftNumber} (Faltante)`,
            origin: AccountingEntryOrigin.pos,
            status: 'active',
            posShiftId: params.shiftId,
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
        const existing = await this.prisma.accountingEntry
          .findFirst({
            where: { posShiftId: params.shiftId, status: 'active' },
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
        fallback:
          'No se pudo registrar el asiento contable de ajuste por diferencia de caja.',
      });
    }
  }

  private async findActiveAccountByCode(
    db: Prisma.TransactionClient | PrismaService,
    codes: string[],
    fallbackWhere?: Prisma.AccountingAccountWhereInput,
  ) {
    for (const code of codes) {
      const account = await db.accountingAccount.findFirst({
        where: { isActive: true, code },
      });
      if (account) {
        return account;
      }
    }

    if (fallbackWhere) {
      return db.accountingAccount.findFirst({
        where: { isActive: true, ...fallbackWhere },
        orderBy: { code: 'asc' },
      });
    }

    return null;
  }

  private async findExistingByOutboxId(
    db: Prisma.TransactionClient | PrismaService,
    outboxId: string,
  ): Promise<AccountingEntryCreatedResult | null> {
    const existing = await db.accountingEntry.findFirst({
      where: { outboxId, status: 'active' },
      select: { id: true, entryNumber: true },
    });
    if (!existing) {
      return null;
    }
    return {
      entryId: existing.id,
      entryNumber: Number(existing.entryNumber),
    };
  }

  async registerInventoryPurchase(
    outboxId: string,
    payload: InventoryPurchaseRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const totalCost = roundMoney(Number(payload.totalCost));
    if (totalCost <= 0) {
      throw new BadRequestException(
        `No se puede contabilizar la compra de "${payload.itemName}" con costo $0.`,
      );
    }

    const hasInvoice = payload.hasInvoice !== false;
    const netAmount = hasInvoice ? roundMoney(totalCost / 1.19) : totalCost;
    const vatCredit = hasInvoice ? roundMoney(totalCost - netAmount) : 0;
    const entryDateStr = toChileBusinessDateString(payload.occurredAt);
    const lockKey = `accounting:outbox:${outboxId}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await this.findExistingByOutboxId(activeTx, outboxId);
        if (existing) {
          return existing;
        }

        const debitAccount =
          payload.itemType === 'general_supply'
            ? await this.findActiveAccountByCode(activeTx, ['6101'], {
                accountType: 'gasto',
              })
            : payload.itemType === 'product'
              ? await this.findActiveAccountByCode(activeTx, ['1106', '1105'])
              : await this.findActiveAccountByCode(activeTx, ['1105']);

        if (!debitAccount) {
          throw new InternalServerErrorException(
            payload.itemType === 'general_supply'
              ? 'Falta la cuenta de Gastos Operativos (6101) para registrar la compra.'
              : 'Faltan las cuentas de Inventario (1105 / 1106) para registrar la compra.',
          );
        }

        const vatCreditAccount =
          vatCredit > 0
            ? (await this.findActiveAccountByCode(activeTx, ['1108'])) ??
              (await activeTx.accountingAccount.findFirst({
                where: {
                  isActive: true,
                  accountType: 'activo',
                  name: { contains: 'IVA Cr', mode: 'insensitive' },
                },
                orderBy: { code: 'asc' },
              }))
            : null;

        if (vatCredit > 0 && !vatCreditAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta contable 1108 (IVA Crédito Fiscal) para registrar compras con factura.',
          );
        }

        let creditCodes: string[];
        let creditFallback: Prisma.AccountingAccountWhereInput | undefined;
        switch (payload.paymentMethod) {
          case 'credito_proveedor':
            creditCodes = ['2101'];
            creditFallback = { accountType: 'pasivo' };
            break;
          case 'transferencia':
            creditCodes = ['1102', '1104', '1101'];
            creditFallback = {
              accountType: 'activo',
              code: { notIn: ['1105', '1106', '1108'] },
            };
            break;
          case 'banco':
          case 'debito':
            creditCodes = ['1102', '1101'];
            creditFallback = {
              accountType: 'activo',
              code: { notIn: ['1105', '1106', '1108'] },
            };
            break;
          case 'efectivo':
          default:
            creditCodes = ['1101'];
            creditFallback = {
              accountType: 'activo',
              code: { notIn: ['1105', '1106', '1108'] },
            };
            break;
        }

        const creditAccount = await this.findActiveAccountByCode(
          activeTx,
          creditCodes,
          creditFallback,
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
        const existing = await this.findExistingByOutboxId(this.prisma, outboxId).catch(
          () => null,
        );
        if (existing) {
          return existing;
        }
      }
      rethrowPrismaError(error, {
        fallback: 'No se pudo generar el asiento contable de la compra de inventario.',
      });
    }
  }

  async registerProductionTransfer(
    outboxId: string,
    payload: InventoryProductionRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const entryDateStr = toChileBusinessDateString(payload.producedAt);
    const lockKey = `accounting:outbox:${outboxId}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await this.findExistingByOutboxId(activeTx, outboxId);
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
          this.findActiveAccountByCode(activeTx, ['1105']),
          this.findActiveAccountByCode(activeTx, ['1106']),
        ]);

        if (!rawMaterialAccount || !finishedGoodsAccount) {
          throw new InternalServerErrorException(
            'Faltan las cuentas 1105 (Inventario Materias Primas) y 1106 (Inventario Productos Terminados) para contabilizar la producción.',
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
        const existing = await this.findExistingByOutboxId(this.prisma, outboxId).catch(
          () => null,
        );
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
    const lockKey = `accounting:outbox:${outboxId}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await this.findExistingByOutboxId(activeTx, outboxId);
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
            ? await this.findActiveAccountByCode(activeTx, ['1106', '1105'])
            : await this.findActiveAccountByCode(activeTx, ['1105']);

        if (!inventoryAccount) {
          throw new InternalServerErrorException(
            'Faltan las cuentas de Inventario (1105 / 1106) para registrar el ajuste.',
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
          const surplusAccount = await this.findActiveAccountByCode(
            activeTx,
            ['4102'],
            { accountType: 'ingreso' },
          );
          if (!surplusAccount) {
            throw new InternalServerErrorException(
              'Falta cuenta de Sobrantes / Otros Ingresos (4102) para ajustar inventario.',
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
              description: payload.reason?.trim() || `Sobrante detectado en conteo físico`,
            },
          ];
        } else {
          const isInternalUse = payload.reasonType === 'internal_use';
          const counterAccount = isInternalUse
            ? await this.findActiveAccountByCode(activeTx, ['6101'], {
                accountType: 'gasto',
              })
            : await this.findActiveAccountByCode(activeTx, ['6104', '5101'], {
                accountType: 'gasto',
              });

          if (!counterAccount) {
            throw new InternalServerErrorException(
              'Falta cuenta de Merma / Gasto (6104 / 6101 / 5101) para registrar la salida de inventario.',
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
        const existing = await this.findExistingByOutboxId(this.prisma, outboxId).catch(
          () => null,
        );
        if (existing) {
          return existing;
        }
      }
      rethrowPrismaError(error, {
        fallback: 'No se pudo generar el asiento contable de ajuste de inventario.',
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
    const lockKey = `accounting:outbox:${outboxId}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$queryRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await this.findExistingByOutboxId(activeTx, outboxId);
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
            this.findActiveAccountByCode(activeTx, ['5101'], {
              accountType: 'costo',
            }),
            productCostTotal > 0
              ? this.findActiveAccountByCode(activeTx, ['1106', '1105'])
              : Promise.resolve(null),
            packagingCostTotal > 0
              ? this.findActiveAccountByCode(activeTx, ['1105', '1106'])
              : Promise.resolve(null),
          ]);

        if (!cogsAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta 5101 (Costo de Materias Primas / Ventas) para contabilizar el costo de venta.',
          );
        }
        if (productCostTotal > 0 && !finishedGoodsAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta 1106 (Inventario Productos Terminados) para descargar el costo de venta.',
          );
        }
        if (packagingCostTotal > 0 && !rawMaterialsAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta 1105 (Inventario Materias Primas / Empaques) para descargar el costo de empaques vendidos.',
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
        const existing = await this.findExistingByOutboxId(this.prisma, outboxId).catch(
          () => null,
        );
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
