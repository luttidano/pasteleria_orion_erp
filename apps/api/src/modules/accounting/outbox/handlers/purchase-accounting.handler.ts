import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingEntryOrigin } from '../../../../common/enums';
import {
  parseStrictUtcBounds,
  toChileBusinessDateString,
} from '../../../../common/utils/chile-time.util';
import { roundMoney } from '../../../../common/utils/money.util';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../../../common/utils/prisma-error.util';
import { SYSTEM_ACCOUNT_CODES } from '../../accounting.constants';
import { AccountingPeriodService } from '../../periods/accounting-period.service';
import type {
  AccountingEntryCreatedResult,
  OutboxAggregateType,
  SupplierPaymentRequestedPayload,
} from '../accounting-outbox.types';
import { AccountingAccountResolverService } from './accounting-account-resolver.service';
import type {
  AccountingEventHandler,
  AccountingHandlerResult,
  OutboxDispatchEvent,
} from './accounting-event-handler.interface';

@Injectable()
export class PurchaseAccountingHandler implements AccountingEventHandler {
  constructor(
    private readonly accountResolver: AccountingAccountResolverService,
    private readonly periodService: AccountingPeriodService,
  ) {}

  supports(aggregateType: OutboxAggregateType): boolean {
    return aggregateType === 'supplier_payment';
  }

  async handle(
    event: OutboxDispatchEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingHandlerResult> {
    return this.registerSupplierPayment(
      event.id,
      event.payload as unknown as SupplierPaymentRequestedPayload,
      tx,
    );
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

        const debitAccount = await this.accountResolver.findActiveAccountByCode(
          activeTx,
          [SYSTEM_ACCOUNT_CODES.SUPPLIERS_PAYABLE],
          { accountType: 'pasivo' },
        );

        if (!debitAccount) {
          throw new InternalServerErrorException(
            'Falta la cuenta contable 2.1.01.01 (Proveedores por Pagar) para liquidar el pago.',
          );
        }

        const creditAccount =
          await this.accountResolver.resolveTreasuryAccountForPayment(
            activeTx,
            payload.paymentMethod,
            { allowSupplierCredit: false },
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
        const existing = await this.accountResolver
          .findExistingByOutboxId(this.accountResolver.getPrisma(), outboxId)
          .catch(() => null);
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
