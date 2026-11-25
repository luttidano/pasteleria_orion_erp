import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { SYSTEM_ACCOUNT_CODES } from '../../accounting.constants';
import type { AccountingEntryCreatedResult } from '../accounting-outbox.types';

const NON_TREASURY_ASSET_CODES = [
  SYSTEM_ACCOUNT_CODES.RAW_MATERIALS_INVENTORY,
  SYSTEM_ACCOUNT_CODES.FINISHED_GOODS_INVENTORY,
  SYSTEM_ACCOUNT_CODES.PACKAGING_INVENTORY,
  SYSTEM_ACCOUNT_CODES.VAT_CREDIT,
];

/**
 * Centraliza resolución de cuentas activas, transacciones y locks distribuidos
 * para los manejadores contables por dominio (SRP).
 */
@Injectable()
export class AccountingAccountResolverService {
  constructor(private readonly prisma: PrismaService) {}

  getPrisma(): PrismaService {
    return this.prisma;
  }

  async runInTransaction<T>(
    tx: Prisma.TransactionClient | undefined,
    callback: (activeTx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    if (tx) {
      return callback(tx);
    }
    return this.prisma.$transaction(callback);
  }

  /**
   * Usa firma de 2 argumentos int4 en pg_advisory_xact_lock para minimizar colisiones
   * frente al hash único de 32 bits.
   */
  async acquireAdvisoryLock(
    tx: Prisma.TransactionClient,
    namespace: string,
    targetId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${namespace}::text), hashtext(${targetId}::text))
    `;
  }

  getTreasuryAssetFallbackWhere(): Prisma.AccountingAccountWhereInput {
    return {
      accountType: 'activo',
      isGroup: false,
      code: {
        notIn: NON_TREASURY_ASSET_CODES,
      },
    };
  }

  async findActiveAccountByCode(
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

  async findExistingByOutboxId(
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

  async resolveSaleAccounts(targetAssetCode: string) {
    const [assetAccount, salesAccount, vatAccount] = await Promise.all([
      this.findActiveAccountByCode(
        this.prisma,
        [targetAssetCode],
        this.getTreasuryAssetFallbackWhere(),
      ),
      this.findActiveAccountByCode(
        this.prisma,
        [SYSTEM_ACCOUNT_CODES.SALES_REVENUE],
        { accountType: 'ingreso' },
      ),
      this.findActiveAccountByCode(
        this.prisma,
        [SYSTEM_ACCOUNT_CODES.VAT_DEBIT],
        {
          accountType: 'pasivo',
          name: { contains: 'IVA', mode: 'insensitive' },
        },
      ),
    ]);

    if (!assetAccount || !salesAccount) {
      throw new InternalServerErrorException(
        'Faltan cuentas contables básicas (Activo o Ingreso) para registrar la venta.',
      );
    }

    return { assetAccount, salesAccount, vatAccount };
  }

  async resolveTreasuryAccountForPayment(
    db: Prisma.TransactionClient | PrismaService,
    paymentMethod: string,
    options?: { allowSupplierCredit?: boolean },
  ) {
    const treasuryFallback = this.getTreasuryAssetFallbackWhere();
    let codes: string[];
    let fallback: Prisma.AccountingAccountWhereInput = treasuryFallback;

    switch (paymentMethod) {
      case 'credito_proveedor':
        if (options?.allowSupplierCredit) {
          codes = [SYSTEM_ACCOUNT_CODES.SUPPLIERS_PAYABLE];
          fallback = { accountType: 'pasivo' };
          break;
        }
        codes = [SYSTEM_ACCOUNT_CODES.CASH];
        break;
      case 'transferencia':
        codes = options?.allowSupplierCredit
          ? [SYSTEM_ACCOUNT_CODES.BANK_TRANSFER, SYSTEM_ACCOUNT_CODES.CASH]
          : [
              SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
              SYSTEM_ACCOUNT_CODES.BANK_CARD,
              SYSTEM_ACCOUNT_CODES.CASH,
            ];
        break;
      case 'banco':
      case 'debito':
        codes = [
          SYSTEM_ACCOUNT_CODES.BANK_CARD,
          SYSTEM_ACCOUNT_CODES.BANK_TRANSFER,
          SYSTEM_ACCOUNT_CODES.CASH,
        ];
        break;
      case 'efectivo':
      default:
        codes = [SYSTEM_ACCOUNT_CODES.CASH];
        break;
    }

    return this.findActiveAccountByCode(db, codes, fallback);
  }
}
