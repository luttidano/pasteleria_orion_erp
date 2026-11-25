import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AccountingEntryOrigin } from '../../../../common/enums';
import { toChileBusinessDateString } from '../../../../common/utils/chile-time.util';
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
  ShiftDifferenceRequestedPayload,
} from '../accounting-outbox.types';
import { AccountingAccountResolverService } from './accounting-account-resolver.service';
import type {
  AccountingEventHandler,
  AccountingHandlerResult,
  OutboxDispatchEvent,
} from './accounting-event-handler.interface';

@Injectable()
export class ShiftAccountingHandler implements AccountingEventHandler {
  constructor(
    private readonly accountResolver: AccountingAccountResolverService,
    private readonly periodService: AccountingPeriodService,
  ) {}

  supports(aggregateType: OutboxAggregateType): boolean {
    return aggregateType === 'pos_shift';
  }

  async handle(
    event: OutboxDispatchEvent,
    tx?: Prisma.TransactionClient,
  ): Promise<AccountingHandlerResult> {
    const payload = event.payload as unknown as ShiftDifferenceRequestedPayload;
    return this.registerShiftDifferenceAdjustment(
      {
        shiftId: event.aggregateId,
        shiftNumber: Number(payload.shiftNumber),
        closedAt: payload.closedAt,
        cashDifference: Number(payload.cashDifference),
        entryDate: payload.entryDate,
      },
      tx,
    );
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

    const prisma = this.accountResolver.getPrisma();
    const cashAccount = await this.accountResolver.findActiveAccountByCode(
      prisma,
      [SYSTEM_ACCOUNT_CODES.CASH],
      this.accountResolver.getTreasuryAssetFallbackWhere(),
    );

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

    const counterAccount = isOverage
      ? await this.accountResolver.findActiveAccountByCode(
          prisma,
          [SYSTEM_ACCOUNT_CODES.OTHER_INCOME_SURPLUS],
          { accountType: 'ingreso' },
        )
      : await this.accountResolver.findActiveAccountByCode(
          prisma,
          [SYSTEM_ACCOUNT_CODES.CASH_SHORTAGE],
          { accountType: 'gasto' },
        );

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

    try {
      return await this.accountResolver.runInTransaction(tx, async (activeTx) => {
        await this.accountResolver.acquireAdvisoryLock(
          activeTx,
          'accounting:pos_shift',
          params.shiftId,
        );

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
        const existing = await prisma.accountingEntry
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
          'No se pudo generar el asiento de ajuste por diferencia de caja.',
      });
    }
  }
}
