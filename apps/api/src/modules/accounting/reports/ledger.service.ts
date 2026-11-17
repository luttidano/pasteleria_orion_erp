import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccountLedgerData, AccountingEntryOrigin, AccountingEntryStatus } from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';
import { parseStrictUtcBounds } from '../../../common/utils/chile-time.util';
import { roundMoney } from '../../../common/utils/money.util';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountLedger(
    accountId: string,
    startDate?: string,
    endDate?: string,
  ): Promise<AccountLedgerData> {
    const normalizedStart = startDate?.trim() || undefined;
    const normalizedEnd = endDate?.trim() || undefined;

    const startBounds = normalizedStart
      ? parseStrictUtcBounds(normalizedStart, 'startDate')
      : null;
    const endBounds = normalizedEnd
      ? parseStrictUtcBounds(normalizedEnd, 'endDate')
      : null;

    if (startBounds && endBounds && startBounds.isoDate > endBounds.isoDate) {
      throw new BadRequestException(
        'La fecha inicial (startDate) no puede ser posterior a la fecha final (endDate).',
      );
    }

    const account = await this.prisma.accountingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Cuenta contable con ID ${accountId} no encontrada.`);
    }

    const isDebitNature = ['activo', 'costo', 'gasto'].includes(account.accountType);

    // Saldo Inicial anterior a startDate calculado nativamente en PostgreSQL
    let initialBalance = 0;
    if (startBounds) {
      const priorAgg = await this.prisma.accountingEntryItem.aggregate({
        where: {
          accountId,
          entry: {
            entryDate: { lt: startBounds.start },
            status: 'active',
          },
        },
        _sum: { debit: true, credit: true },
      });

      const priorDebit = roundMoney(Number(priorAgg._sum.debit ?? 0));
      const priorCredit = roundMoney(Number(priorAgg._sum.credit ?? 0));
      initialBalance = isDebitNature
        ? roundMoney(priorDebit - priorCredit)
        : roundMoney(priorCredit - priorDebit);
    }

    // Filtro del período
    const dateFilter: Prisma.DateTimeFilter = {};
    if (startBounds) dateFilter.gte = startBounds.start;
    if (endBounds) dateFilter.lte = endBounds.end;

    const whereClause: Prisma.AccountingEntryItemWhereInput = { accountId };
    if (startBounds || endBounds) {
      whereClause.entry = { entryDate: dateFilter };
    }

    const items = await this.prisma.accountingEntryItem.findMany({
      where: whereClause,
      include: {
        entry: {
          select: {
            id: true,
            entryNumber: true,
            entryDate: true,
            concept: true,
            origin: true,
            status: true,
          },
        },
      },
      orderBy: [
        { entry: { entryDate: 'asc' } },
        { entry: { entryNumber: 'asc' } },
      ],
    });

    let runningBalance = initialBalance;
    const movements = items.map((it) => {
      const debit = Number(it.debit);
      const credit = Number(it.credit);

      if (isDebitNature) {
        runningBalance += debit - credit;
      } else {
        runningBalance += credit - debit;
      }

      return {
        id: it.id,
        entryId: it.entry.id,
        entryNumber: Number(it.entry.entryNumber),
        entryDate: it.entry.entryDate.toISOString().slice(0, 10),
        concept: it.entry.concept,
        origin: it.entry.origin as AccountingEntryOrigin,
        entryStatus: it.entry.status as AccountingEntryStatus,
        description: it.description,
        debit,
        credit,
        runningBalance: roundMoney(runningBalance),
      };
    });

    const totalPeriodDebit = items.reduce((sum, it) => sum + Number(it.debit), 0);
    const totalPeriodCredit = items.reduce((sum, it) => sum + Number(it.credit), 0);

    return {
      account: {
        id: account.id,
        code: account.code,
        name: account.name,
        accountType: account.accountType,
        nature: isDebitNature ? 'deudora' : 'acreedora',
      },
      period: {
        startDate: startBounds?.isoDate ?? null,
        endDate: endBounds?.isoDate ?? null,
      },
      initialBalance: roundMoney(initialBalance),
      movements,
      totalDebit: roundMoney(totalPeriodDebit),
      totalCredit: roundMoney(totalPeriodCredit),
      finalBalance: roundMoney(runningBalance),
      finalBalanceType: runningBalance >= 0
        ? (isDebitNature ? 'deudor' : 'acreedor')
        : (isDebitNature ? 'acreedor' : 'deudor'),
    };
  }
}