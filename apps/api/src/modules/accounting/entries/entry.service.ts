import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Optional,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin } from '../../../common/enums';
import { CreateAccountingEntryDto } from '../dto/create-accounting-entry.dto';
import { VoidAccountingEntryDto } from '../dto/accounting-period.dto';
import { AccountingPeriodService } from '../periods/accounting-period.service';
import { EntryVoidService } from './entry-void.service';
import { AccountingAccountResolverService } from '../outbox/handlers/accounting-account-resolver.service';
import { InventoryAccountingHandler } from '../outbox/handlers/inventory-accounting.handler';
import { PurchaseAccountingHandler } from '../outbox/handlers/purchase-accounting.handler';
import { SaleAccountingHandler } from '../outbox/handlers/sale-accounting.handler';
import { ShiftAccountingHandler } from '../outbox/handlers/shift-accounting.handler';
import { TaxCalculatorService } from '../tax/tax-calculator.service';
import { InventoryValuationService } from '../../inventory/valuation/inventory-valuation.service';
import type {
  AccountingEntryCreatedResult,
  InventoryAdjustmentRequestedPayload,
  InventoryProductionRequestedPayload,
  InventoryPurchaseRequestedPayload,
  PosSaleCogsRequestedPayload,
  SaleCogsEntryCreatedResult,
  SupplierPaymentRequestedPayload,
} from '../outbox/accounting-outbox.types';
import { rethrowPrismaError } from '../../../common/utils/prisma-error.util';
import { extractYearMonth } from '../../../common/utils/chile-time.util';
import { roundMoney } from '../../../common/utils/money.util';

@Injectable()
export class EntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: AccountingPeriodService,
    @Optional()
    private readonly inventoryValuationService?: InventoryValuationService,
    @Optional()
    private readonly entryVoidService?: EntryVoidService,
    @Optional()
    private readonly accountResolver?: AccountingAccountResolverService,
    @Optional()
    private readonly taxCalculator?: TaxCalculatorService,
    @Optional()
    private readonly saleHandler?: SaleAccountingHandler,
    @Optional()
    private readonly shiftHandler?: ShiftAccountingHandler,
    @Optional()
    private readonly inventoryHandler?: InventoryAccountingHandler,
    @Optional()
    private readonly purchaseHandler?: PurchaseAccountingHandler,
  ) {}

  async findEntries() {
    try {
      const [entries, lockedLookup] = await Promise.all([
        this.prisma.accountingEntry.findMany({
          include: {
            items: {
              include: { account: true },
              orderBy: { debit: 'desc' },
            },
          },
          orderBy: [
            { entryDate: 'desc' },
            { entryNumber: 'desc' },
          ],
          take: 100,
        }),
        this.periodService.getLockedLookup(),
      ]);

      return entries.map((entry) => {
        const totalDebit = entry.items.reduce((sum, it) => sum + Number(it.debit), 0);
        const totalCredit = entry.items.reduce((sum, it) => sum + Number(it.credit), 0);
        const entryDateStr = entry.entryDate.toISOString().slice(0, 10);
        const year = entry.entryDate.getUTCFullYear();
        const month = entry.entryDate.getUTCMonth() + 1;
        const isPeriodLocked =
          lockedLookup.closedYears.has(year) ||
          lockedLookup.closedMonthKeys.has(`${year}-${month}`) ||
          Boolean(
            lockedLookup.accountingStartDate &&
              entryDateStr < lockedLookup.accountingStartDate,
          );
        const ticketNumber =
          entry.origin === AccountingEntryOrigin.pos &&
          entry.posSaleId &&
          entry.concept.startsWith('Venta POS ')
            ? entry.concept.slice('Venta POS '.length)
            : null;

        return {
          id: entry.id,
          entryNumber: Number(entry.entryNumber),
          entryDate: entryDateStr,
          concept: entry.concept,
          origin: entry.origin,
          status: entry.status,
          voidedAt: entry.voidedAt ? entry.voidedAt.toISOString() : null,
          voidReason: entry.voidReason ?? null,
          reversedEntryId: entry.reversedEntryId ?? null,
          closingYear: entry.closingYear ?? null,
          isPeriodLocked,
          ticketNumber,
          totalAmount: totalDebit,
          isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
          createdAt: entry.createdAt.toISOString(),
          items: entry.items.map((it) => ({
            id: it.id,
            accountId: it.accountId,
            accountCode: it.account.code,
            accountName: it.account.name,
            accountType: it.account.accountType,
            debit: Number(it.debit),
            credit: Number(it.credit),
            description: it.description,
          })),
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[EntryService] Error consultando asientos:', error);
      throw new InternalServerErrorException('No se pudieron consultar los asientos del libro diario.');
    }
  }

  async createEntry(dto: CreateAccountingEntryDto) {
    if (!dto.items || dto.items.length < 2) {
      throw new BadRequestException('Un asiento contable debe tener al menos dos líneas.');
    }

    extractYearMonth(dto.entryDate);

    const normalizedItems = dto.items.map((it) => ({
      accountId: it.accountId,
      debit: roundMoney(Number(it.debit || 0)),
      credit: roundMoney(Number(it.credit || 0)),
      description: it.description?.trim() || null,
    }));

    if (normalizedItems.some((it) => it.debit === 0 && it.credit === 0)) {
      throw new BadRequestException(
        'Cada línea del asiento contable debe tener un monto en Debe o en Haber mayor a cero.',
      );
    }

    const totalDebit = roundMoney(
      normalizedItems.reduce((sum, it) => sum + it.debit, 0),
    );
    const totalCredit = roundMoney(
      normalizedItems.reduce((sum, it) => sum + it.credit, 0),
    );

    if (totalDebit <= 0 || totalCredit <= 0) {
      throw new BadRequestException(
        'El asiento contable debe registrar montos totales mayores a cero.',
      );
    }

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `El asiento está descuadrado: Total Debe ($${totalDebit}) debe ser igual al Total Haber ($${totalCredit}).`,
      );
    }

    try {
      const entry = await this.prisma.$transaction(async (tx) => {
        await this.periodService.assertPeriodOpen(dto.entryDate, tx);

        const accountIds = normalizedItems.map((it) => it.accountId);
        const groupAccounts = await tx.accountingAccount.findMany({
          where: {
            id: { in: accountIds },
            isGroup: true,
          },
          select: { code: true, name: true },
        });

        if (groupAccounts.length > 0) {
          const names = groupAccounts.map((a) => `[${a.code}] ${a.name}`).join(', ');
          throw new BadRequestException(
            `No se pueden registrar asientos en cuentas totalizadoras o agrupadoras: ${names}. Selecciona subcuentas imputables de detalle.`,
          );
        }

        return tx.accountingEntry.create({
          data: {
            entryDate: new Date(`${dto.entryDate}T00:00:00.000Z`),
            concept: dto.concept.trim(),
            origin: AccountingEntryOrigin.manual,
            status: 'active',
            items: {
              create: normalizedItems,
            },
          },
          include: {
            items: { include: { account: true } },
          },
        });
      });

      return {
        id: entry.id,
        entryNumber: Number(entry.entryNumber),
        entryDate: entry.entryDate.toISOString().slice(0, 10),
        concept: entry.concept,
        origin: entry.origin,
        status: entry.status,
        totalAmount: totalDebit,
        items: entry.items.map((it) => ({
          id: it.id,
          accountId: it.accountId,
          accountCode: it.account.code,
          accountName: it.account.name,
          debit: Number(it.debit),
          credit: Number(it.credit),
        })),
      };
    } catch (error) {
      rethrowPrismaError(error, {
        foreignKey: 'Una o más cuentas contables especificadas no existen.',
        fallback: 'No se pudo registrar el asiento contable.',
      });
    }
  }

  async voidEntry(id: string, dto: VoidAccountingEntryDto, userId?: string) {
    const voidService =
      this.entryVoidService ??
      new EntryVoidService(this.prisma, this.periodService);
    return voidService.voidEntry(id, dto, userId);
  }

  private getAccountResolver(): AccountingAccountResolverService {
    return (
      this.accountResolver ?? new AccountingAccountResolverService(this.prisma)
    );
  }

  private getTaxCalculator(): TaxCalculatorService {
    return this.taxCalculator ?? new TaxCalculatorService();
  }

  private getSaleHandler(): SaleAccountingHandler {
    return (
      this.saleHandler ??
      new SaleAccountingHandler(
        this.getAccountResolver(),
        this.periodService,
        this.getTaxCalculator(),
        this.inventoryValuationService,
      )
    );
  }

  private getShiftHandler(): ShiftAccountingHandler {
    return (
      this.shiftHandler ??
      new ShiftAccountingHandler(this.getAccountResolver(), this.periodService)
    );
  }

  private getInventoryHandler(): InventoryAccountingHandler {
    return (
      this.inventoryHandler ??
      new InventoryAccountingHandler(
        this.getAccountResolver(),
        this.periodService,
        this.getTaxCalculator(),
        this.inventoryValuationService,
      )
    );
  }

  private getPurchaseHandler(): PurchaseAccountingHandler {
    return (
      this.purchaseHandler ??
      new PurchaseAccountingHandler(
        this.getAccountResolver(),
        this.periodService,
      )
    );
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
    return this.getSaleHandler().registerSaleIncome(sale, tx);
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
    return this.getShiftHandler().registerShiftDifferenceAdjustment(params, tx);
  }

  async registerInventoryPurchase(
    outboxId: string,
    payload: InventoryPurchaseRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    return this.getInventoryHandler().registerInventoryPurchase(outboxId, payload, tx);
  }

  async registerProductionTransfer(
    outboxId: string,
    payload: InventoryProductionRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    return this.getInventoryHandler().registerProductionTransfer(outboxId, payload, tx);
  }

  async registerInventoryAdjustment(
    outboxId: string,
    payload: InventoryAdjustmentRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    return this.getInventoryHandler().registerInventoryAdjustment(outboxId, payload, tx);
  }

  async registerSaleCogs(
    outboxId: string,
    payload: PosSaleCogsRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<SaleCogsEntryCreatedResult | null> {
    return this.getSaleHandler().registerSaleCogs(outboxId, payload, tx);
  }

  async registerSupplierPayment(
    outboxId: string,
    payload: SupplierPaymentRequestedPayload,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingEntryCreatedResult | null> {
    return this.getPurchaseHandler().registerSupplierPayment(outboxId, payload, tx);
  }
}
