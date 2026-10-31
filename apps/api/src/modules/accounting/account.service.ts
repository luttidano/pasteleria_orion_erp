import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  async findAccounts() {
    try {
      const accounts = await this.prisma.accountingAccount.findMany({
        where: { isActive: true },
        orderBy: { code: 'asc' },
      });

      return accounts.map((acc) => ({
        id: acc.id,
        code: acc.code,
        name: acc.name,
        accountType: acc.accountType,
        isActive: acc.isActive,
      }));
    } catch (error) {
      console.error('[AccountService] Error consultando cuentas:', error);
      throw new InternalServerErrorException('No se pudieron consultar las cuentas contables.');
    }
  }
}