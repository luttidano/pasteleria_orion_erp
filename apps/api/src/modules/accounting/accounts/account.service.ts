import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { AccountTreeNode } from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findAccounts() {
    try {
      const accounts = await this.prisma.accountingAccount.findMany({
        where: { isActive: true },
        orderBy: [{ path: 'asc' }, { code: 'asc' }],
      });

      return accounts.map((acc) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        parentId: acc.parentId ?? null,
        path: acc.path,
        level: acc.level,
        isGroup: acc.isGroup,
        normalBalance: acc.normalBalance,
        isActive: acc.isActive,
      }));
    } catch (error) {
      console.error('[AccountService] Error consultando cuentas:', error);
      throw new InternalServerErrorException('No se pudieron consultar las cuentas contables.');
    }
  }

  async getAccountTree(): Promise<AccountTreeNode[]> {
    const accounts = await this.findAccounts();
    const map = new Map<string, AccountTreeNode>();

    accounts.forEach((acc) => {
      map.set(acc.id, { ...acc, children: [] });
    });

    const roots: AccountTreeNode[] = [];
    accounts.forEach((acc) => {
      const node = map.get(acc.id)!;
      if (acc.parentId && map.has(acc.parentId)) {
        map.get(acc.parentId)!.children!.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }
}
