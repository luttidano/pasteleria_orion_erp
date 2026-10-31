import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class BalanceService {
  constructor(private readonly prisma: PrismaService) {}

  async getBalance() {
    try {
      const accounts = await this.prisma.accountingAccount.findMany({
        where: { isActive: true },
        include: { entryItems: true },
        orderBy: { code: 'asc' },
      });

      return accounts.map((acc) => {
        const totalDebit = acc.entryItems.reduce((sum, it) => sum + Number(it.debit), 0);
        const totalCredit = acc.entryItems.reduce((sum, it) => sum + Number(it.credit), 0);

        const debitBalance = totalDebit > totalCredit ? totalDebit - totalCredit : 0;
        const creditBalance = totalCredit > totalDebit ? totalCredit - totalDebit : 0;

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