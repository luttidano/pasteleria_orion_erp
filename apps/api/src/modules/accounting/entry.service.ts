import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';

@Injectable()
export class EntryService {
  constructor(private readonly prisma: PrismaService) {}

  async findEntries() {
    try {
      const entries = await this.prisma.accountingEntry.findMany({
        include: {
          items: {
            include: { account: true },
            orderBy: { debit: 'desc' },
          },
          posSale: true,
        },
        orderBy: [
          { entryDate: 'desc' },
          { entryNumber: 'desc' },
        ],
        take: 100,
      });

      return entries.map((entry) => {
        const totalDebit = entry.items.reduce((sum, it) => sum + Number(it.debit), 0);
        const totalCredit = entry.items.reduce((sum, it) => sum + Number(it.credit), 0);

        return {
          id: entry.id,
          entryNumber: Number(entry.entryNumber),
          entryDate: entry.entryDate.toISOString().slice(0, 10),
          concept: entry.concept,
          origin: entry.origin,
          ticketNumber: entry.posSale?.ticketNumber || null,
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
      console.error('[EntryService] Error consultando asientos:', error);
      throw new InternalServerErrorException('No se pudieron consultar los asientos del libro diario.');
    }
  }

  async createEntry(dto: CreateAccountingEntryDto) {
    if (!dto.items || dto.items.length < 2) {
      throw new BadRequestException('Un asiento contable debe tener al menos dos líneas.');
    }

    const totalDebit = dto.items.reduce((sum, it) => sum + Number(it.debit || 0), 0);
    const totalCredit = dto.items.reduce((sum, it) => sum + Number(it.credit || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new BadRequestException(
        `El asiento está descuadrado: Total Debe ($${totalDebit}) debe ser igual al Total Haber ($${totalCredit}).`,
      );
    }

    try {
      const entry = await this.prisma.accountingEntry.create({
        data: {
          entryDate: new Date(dto.entryDate),
          concept: dto.concept.trim(),
          origin: 'manual',
          items: {
            create: dto.items.map((it) => ({
              accountId: it.accountId,
              debit: Math.round(Number(it.debit || 0) * 100) / 100,
              credit: Math.round(Number(it.credit || 0) * 100) / 100,
              description: it.description || null,
            })),
          },
        },
        include: {
          items: { include: { account: true } },
        },
      });

      return {
        id: entry.id,
        entryNumber: Number(entry.entryNumber),
        entryDate: entry.entryDate.toISOString().slice(0, 10),
        concept: entry.concept,
        origin: entry.origin,
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
      console.error('[EntryService] Error creando asiento manual:', error);
      throw new InternalServerErrorException('No se pudo registrar el asiento contable.');
    }
  }

  async registerSaleIncome(sale: {
    id: string;
    ticketNumber: string;
    soldAt: string;
    total: number;
    paymentMethod: string;
  }): Promise<void> {
    if (sale.total <= 0) return;

    const existing = await this.prisma.accountingEntry.findFirst({
      where: { posSaleId: sale.id },
      select: { id: true },
    });
    if (existing) return;

    const isCash = sale.paymentMethod === 'efectivo';
    const targetAssetCode = isCash ? '1101' : '1102';

    const assetAccount = await this.prisma.accountingAccount.findFirst({
      where: {
        isActive: true,
        OR: [{ code: targetAssetCode }, { accountType: 'activo' }],
      },
      orderBy: { code: 'asc' },
    });

    const salesAccount = await this.prisma.accountingAccount.findFirst({
      where: {
        isActive: true,
        OR: [{ code: '4101' }, { accountType: 'ingreso' }],
      },
      orderBy: { code: 'asc' },
    });

    const vatAccount = await this.prisma.accountingAccount.findFirst({
      where: {
        isActive: true,
        OR: [{ code: '2105' }, { accountType: 'pasivo' }],
      },
      orderBy: { code: 'asc' },
    });

    if (!assetAccount || !salesAccount) {
      throw new InternalServerErrorException(
        'Faltan cuentas contables básicas (Activo o Ingreso) para registrar la venta.',
      );
    }

    const total = Math.round(sale.total * 100) / 100;
    let netSales = total;
    let vatAmount = 0;

    if (vatAccount) {
      netSales = Math.round((total / 1.19) * 100) / 100;
      vatAmount = Math.round((total - netSales) * 100) / 100;
    }

    const itemsToCreate = [
      { accountId: assetAccount.id, debit: total, credit: 0, description: `Ingreso venta ${sale.paymentMethod}` },
      { accountId: salesAccount.id, debit: 0, credit: netSales, description: 'Venta neta productos' },
    ];

    if (vatAmount > 0 && vatAccount) {
      itemsToCreate.push({
        accountId: vatAccount.id,
        debit: 0,
        credit: vatAmount,
        description: '19% IVA Débito Fiscal',
      });
    }

    try {
      await this.prisma.accountingEntry.create({
        data: {
          entryDate: new Date(sale.soldAt.slice(0, 10)),
          concept: `Venta POS ${sale.ticketNumber}`,
          origin: 'pos',
          posSaleId: sale.id,
          items: { create: itemsToCreate },
        },
      });
    } catch (error) {
      console.error('[EntryService] Error registrando asiento POS:', error);
      throw new InternalServerErrorException('No se pudo generar el asiento contable de la venta.');
    }
  }

  async getPendingSalesCount(): Promise<{ pendingCount: number }> {
    try {
      const pendingCount = await this.prisma.posSale.count({
        where: { accountingStatus: 'pending' },
      });
      return { pendingCount };
    } catch {
      return { pendingCount: 0 };
    }
  }

  async syncPendingSales(): Promise<{ synced: number; failed: number }> {
    const pendingSales = await this.prisma.posSale.findMany({
      where: { accountingStatus: 'pending' },
      orderBy: { soldAt: 'asc' },
    });

    let synced = 0;
    let failed = 0;

    for (const sale of pendingSales) {
      try {
        await this.registerSaleIncome({
          id: sale.id,
          ticketNumber: sale.ticketNumber,
          soldAt: sale.soldAt.toISOString(),
          total: Number(sale.total),
          paymentMethod: sale.paymentMethod,
        });

        await this.prisma.posSale.update({
          where: { id: sale.id },
          data: { accountingStatus: 'posted', accountingError: null },
        });

        synced++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Error al sincronizar.';
        await this.prisma.posSale.update({
          where: { id: sale.id },
          data: { accountingError: errorMsg },
        });
        failed++;
      }
    }

    return { synced, failed };
  }
}