import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccountLedger(accountId: string, startDate?: string, endDate?: string) {
    const account = await this.prisma.accountingAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) {
      throw new NotFoundException(`Cuenta contable con ID ${accountId} no encontrada.`);
    }

    const isDebitNature = ['activo', 'costo', 'gasto'].includes(account.accountType);

    // Saldo Inicial anterior a startDate
    let initialBalance = 0;
    if (startDate) {
      const priorItems = await this.prisma.accountingEntryItem.findMany({
        where: {
          accountId,
          entry: { entryDate: { lt: new Date(startDate) } },
        },
        select: { debit: true, credit: true },
      });

      const priorDebit = priorItems.reduce((sum, it) => sum + Number(it.debit), 0);
      const priorCredit = priorItems.reduce((sum, it) => sum + Number(it.credit), 0);
      initialBalance = isDebitNature ? priorDebit - priorCredit : priorCredit - priorDebit;
    }

    // Filtro del período
    const dateFilter: any = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateFilter.lte = end;
    }

    const whereClause: any = { accountId };
    if (startDate || endDate) {
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
        description: it.description,
        debit,
        credit,
        runningBalance: Math.round(runningBalance * 100) / 100,
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
        startDate: startDate || null,
        endDate: endDate || null,
      },
      initialBalance: Math.round(initialBalance * 100) / 100,
      movements,
      totalDebit: Math.round(totalPeriodDebit * 100) / 100,
      totalCredit: Math.round(totalPeriodCredit * 100) / 100,
      finalBalance: Math.round(runningBalance * 100) / 100,
      finalBalanceType: runningBalance >= 0
        ? (isDebitNature ? 'deudor' : 'acreedor')
        : (isDebitNature ? 'acreedor' : 'deudor'),
    };
  }
}