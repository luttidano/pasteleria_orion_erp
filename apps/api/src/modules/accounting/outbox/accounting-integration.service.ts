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
  SupplierPaymentRequestedPayload,
} from './accounting-outbox.types';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../../common/utils/prisma-error.util';
import {
  toChileBusinessDateString,
  parseStrictUtcBounds,
} from '../../../common/utils/chile-time.util';
import { roundMoney } from '../../../common/utils/money.util';
import { SYSTEM_ACCOUNT_CODES } from '../accounting.constants';

const PAYMENT_ASSET_ACCOUNT_MAP: Record<string, string> = {
  efectivo: SYSTEM_ACCOUNT_CODES.CASH,
  debito: SYSTEM_ACCOUNT_CODES.BANK_CARD,
  credito: SYSTEM_ACCOUNT_CODES.BANK_CARD,
  transferencia: SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
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

    const targetAssetCode =
      PAYMENT_ASSET_ACCOUNT_MAP[sale.paymentMethod] ??
      SYSTEM_ACCOUNT_CODES.CASH;
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
        await activeTx.$executeRaw`
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
          where: { isActive: true, isGroup: false, code: targetAssetCode },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            isGroup: false,
            accountType: 'activo',
            code: {
              notIn: [
                SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
              ],
            },
          },
          orderBy: { code: 'asc' },
        })))(),
      (async () =>
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            isGroup: false,
            code: SYSTEM_ACCOUNT_CODES.SALES_REVENUE,
          },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, isGroup: false, accountType: 'ingreso' },
          orderBy: { code: 'asc' },
        })))(),
      (async () =>
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            isGroup: false,
            code: SYSTEM_ACCOUNT_CODES.VAT_DEBIT,
          },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            isGroup: false,
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
        where: {
          isActive: true,
          isGroup: false,
          code: SYSTEM_ACCOUNT_CODES.CASH,
        },
      })) ??
      (await this.prisma.accountingAccount.findFirst({
        where: {
          isActive: true,
          isGroup: false,
          accountType: 'activo',
          code: {
            notIn: [
              SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
              SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
              SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
              SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
            ],
          },
        },
        orderBy: { code: 'asc' },
      }));

    if (!cashAccount) {
      throw new InternalServerErrorException(
        'Falta la cuenta contable de Caja Efectivo (1.1.01.01) para registrar diferencias de arqueo.',
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
          where: {
            isActive: true,
            isGroup: false,
            code: SYSTEM_ACCOUNT_CODES.OTHER_INCOME_SURPLUS,
          },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, isGroup: false, accountType: 'ingreso' },
          orderBy: { code: 'asc' },
        }));
    } else {
      counterAccount =
        (await this.prisma.accountingAccount.findFirst({
          where: {
            isActive: true,
            isGroup: false,
            code: SYSTEM_ACCOUNT_CODES.CASH_SHORTAGE,
          },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, isGroup: false, accountType: 'gasto' },
          orderBy: { code: 'asc' },
        }));
    }

    if (!counterAccount) {
      throw new InternalServerErrorException(
        isOverage
          ? 'Falta una cuenta de Ingresos / Sobrantes de Caja (4.1.02.01) para ajustar el arqueo.'
          : 'Falta una cuenta de Gastos / Faltantes de Caja (6.1.02.01) para ajustar el arqueo.',
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
        await activeTx.$executeRaw`
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
        where: { isActive: true, isGroup: false, code },
      });
      if (account) {
        return account;
      }
    }

    if (fallbackWhere) {
      return db.accountingAccount.findFirst({
        where: { isActive: true, isGroup: false, ...fallbackWhere },
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
        await activeTx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await this.findExistingByOutboxId(activeTx, outboxId);
        if (existing) {
          return existing;
        }

        const debitAccount =
          payload.itemType === 'general_supply'
            ? await this.findActiveAccountByCode(
                activeTx,
                [SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSES],
                { accountType: 'gasto' },
              )
            : payload.itemType === 'product'
              ? await this.findActiveAccountByCode(activeTx, [
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                ])
              : await this.findActiveAccountByCode(activeTx, [
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
            ? (await this.findActiveAccountByCode(activeTx, [
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

        let creditCodes: string[];
        let creditFallback: Prisma.AccountingAccountWhereInput | undefined;
        switch (payload.paymentMethod) {
          case 'credito_proveedor':
            creditCodes = [SYSTEM_ACCOUNT_CODES.SUPPLIERS_PAYABLE];
            creditFallback = { accountType: 'pasivo' };
            break;
          case 'transferencia':
            creditCodes = [
              SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
              SYSTEM_ACCOUNT_CODES.CASH,
            ];
            creditFallback = {
              accountType: 'activo',
              isGroup: false,
              code: {
                notIn: [
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
                ],
              },
            };
            break;
          case 'banco':
          case 'debito':
            creditCodes = [
              SYSTEM_ACCOUNT_CODES.BANK_CARD,
              SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
              SYSTEM_ACCOUNT_CODES.CASH,
            ];
            creditFallback = {
              accountType: 'activo',
              isGroup: false,
              code: {
                notIn: [
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
                ],
              },
            };
            break;
          case 'efectivo':
          default:
            creditCodes = [SYSTEM_ACCOUNT_CODES.CASH];
            creditFallback = {
              accountType: 'activo',
              isGroup: false,
              code: {
                notIn: [
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
                ],
              },
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
        await activeTx.$executeRaw`
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
          this.findActiveAccountByCode(activeTx, [SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY]),
          this.findActiveAccountByCode(activeTx, [SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY]),
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
        await activeTx.$executeRaw`
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
            ? await this.findActiveAccountByCode(activeTx, [
                SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
              ])
            : await this.findActiveAccountByCode(activeTx, [
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
          const surplusAccount = await this.findActiveAccountByCode(
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
              description: payload.reason?.trim() || `Sobrante detectado en conteo físico`,
            },
          ];
        } else {
          const isInternalUse = payload.reasonType === 'internal_use';
          const counterAccount = isInternalUse
            ? await this.findActiveAccountByCode(
                activeTx,
                [SYSTEM_ACCOUNT_CODES.OPERATING_EXPENSES],
                { accountType: 'gasto' },
              )
            : await this.findActiveAccountByCode(
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
        await activeTx.$executeRaw`
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
            this.findActiveAccountByCode(
              activeTx,
              [SYSTEM_ACCOUNT_CODES.COGS_FOOD],
              { accountType: 'costo' },
            ),
            productCostTotal > 0
              ? this.findActiveAccountByCode(activeTx, [
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                ])
              : Promise.resolve(null),
            packagingCostTotal > 0
              ? this.findActiveAccountByCode(activeTx, [
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

  async registerSupplierPayment(
    outboxId: string,
    payload: SupplierPaymentRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    const amount = roundMoney(Number(payload.amount));
    if (amount <= 0) {
      throw new BadRequestException(
        'No se puede contabilizar el pago a proveedor por monto $0.',
      );
    }

    const entryDateStr = toChileBusinessDateString(payload.paymentDate);
    const lockKey = `accounting:outbox:${outboxId}`;

    try {
      return await this.runInTransaction(tx, async (activeTx) => {
        await activeTx.$executeRaw`
          SELECT pg_advisory_xact_lock(hashtext(${lockKey}::text)::bigint)
        `;

        const existing = await this.findExistingByOutboxId(activeTx, outboxId);
        if (existing) {
          return existing;
        }

        // Cuenta DEBE: 2.1.01.01 Proveedores por Pagar (disminuye la obligación)
        const debitAccount = await this.findActiveAccountByCode(
          activeTx,
          [SYSTEM_ACCOUNT_CODES.SUPPLIERS_PAYABLE],
          { accountType: 'pasivo' },
        );

        if (!debitAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta contable 2.1.01.01 (Proveedores por Pagar) para liquidar el pago.',
          );
        }

        // Cuenta HABER: Banco o Caja según método de pago
        let creditCodes: string[];
        let creditFallback: Prisma.AccountingAccountWhereInput | undefined;
        switch (payload.paymentMethod) {
          case 'transferencia':
          case 'banco':
            creditCodes = [
              SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
              SYSTEM_ACCOUNT_CODES.BANK_CARD,
              SYSTEM_ACCOUNT_CODES.CASH,
            ];
            creditFallback = {
              accountType: 'activo',
              isGroup: false,
              code: {
                notIn: [
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
                ],
              },
            };
            break;
          case 'efectivo':
          default:
            creditCodes = [SYSTEM_ACCOUNT_CODES.CASH];
            creditFallback = {
              accountType: 'activo',
              isGroup: false,
              code: {
                notIn: [
                  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
                  SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
                ],
              },
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
            'Falta la cuenta contable de tesorería (Caja o Banco) para registrar la salida del pago a proveedor.',
          );
        }

        await this.periodService.assertPeriodOpen(entryDateStr, activeTx);

        const itemsToCreate = [
          {
            accountId: debitAccount.id,
            debit: amount,
            credit: 0,
            description: `Abono/Pago Fac #${payload.invoiceNumber} - ${payload.supplierName}`,
          },
          {
            accountId: creditAccount.id,
            debit: 0,
            credit: amount,
            description: `Salida de tesorería pago proveedor (${payload.paymentMethod})`,
          },
        ];

        const entry = await activeTx.accountingEntry.create({
          data: {
            entryDate: parseStrictUtcBounds(entryDateStr, 'entryDate').start,
            concept: `Pago a Proveedor: ${payload.supplierName} (Factura #${payload.invoiceNumber})`,
            origin: AccountingEntryOrigin.inventory,
            status: 'active',
            outboxId,
            items: {
              create: itemsToCreate,
            },
          },
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            concept: true,
          },
        });

        if (payload.paymentId) {
          await activeTx.supplierPayment.updateMany({
            where: { id: payload.paymentId, accountingEntryId: null },
            data: { accountingEntryId: entry.id },
          });
        }

        return {
          entryId: entry.id,
          entryNumber: Number(entry.entryNumber),
          entryDate: entry.entryDate.toISOString().slice(0, 10),
          concept: entry.concept,
        };
      });
    } catch (error) {
      if (!tx && isUniqueViolation(error)) {
        const existing = await this.findExistingByOutboxId(
          this.prisma,
          outboxId,
        ).catch(() => null);
        if (existing) {
          return existing;
        }
      }
      rethrowPrismaError(error, {
        fallback: `No se pudo contabilizar el pago a proveedor ${payload.supplierName}.`,
      });
    }
  }
}
