import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { roundMoney } from '../../../common/utils/money.util';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance() {
    try {
      const [accounts, grouped] = await Promise.all([
        this.prisma.accountingAccount.findMany({
          where: { isActive: true },
          orderBy: { code: 'asc' },
        }),
        this.prisma.accountingEntryItem.groupBy({
          by: ['accountId'],
          where: {
            entry: { status: 'active' },
          },
          _sum: {
            debit: true,
            credit: true,
          },
        }),
      ]);

      const totalsByAccount = new Map<string, { totalDebit: number; totalCredit: number }>();
      for (const row of grouped) {
        totalsByAccount.set(row.accountId, {
          totalDebit: roundMoney(Number(row._sum.debit ?? 0)),
          totalCredit: roundMoney(Number(row._sum.credit ?? 0)),
        });
      }

      return accounts.map((acc) => {
        const totals = totalsByAccount.get(acc.id) ?? { totalDebit: 0, totalCredit: 0 };
        const totalDebit = totals.totalDebit;
        const totalCredit = totals.totalCredit;

        const debitBalance = totalDebit > totalCredit ? roundMoney(totalDebit - totalCredit) : 0;
        const creditBalance = totalCredit > totalDebit ? roundMoney(totalCredit - totalDebit) : 0;

        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          accountType: acc.accountType,
          totalDebit,
          totalCredit,
          debitBalance,
          creditBalance,
        };
      });
    } catch (error) {
      console.error('[BalanceService] Error calculando balance:', error);
      throw new InternalServerErrorException('No se pudo calcular el balance contable.');
    }
  }
}
