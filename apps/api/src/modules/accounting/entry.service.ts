import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AccountingEntryOrigin } from '../../common/enums';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';
import { VoidAccountingEntryDto } from './dto/accounting-period.dto';
import { AccountingPeriodService } from './accounting-period.service';

@Injectable()
export class EntryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: AccountingPeriodService,
  ) {}

  async findEntries() {
    try {
      const [entries, lockedLookup] = await Promise.all([
        this.prisma.accountingEntry.findMany({
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
        }),
        this.periodService.getLockedLookup(),
      ]);

      return entries.map((entry) => {
        const totalDebit = entry.items.reduce((sum, it) => sum + Number(it.debit), 0);
        const totalCredit = entry.items.reduce((sum, it) => sum + Number(it.credit), 0);
        const entryDateStr = entry.entryDate.toISOString().slice(0, 10);
        const year = entry.entryDate.getUTCFullYear();
        const month = entry.entryDate.getUTCMonth() + 1;
        const isPeriodLocked =
          lockedLookup.closedYears.has(year) ||
          lockedLookup.closedMonthKeys.has(`${year}-${month}`) ||
          Boolean(
            lockedLookup.accountingStartDate &&
              entryDateStr < lockedLookup.accountingStartDate,
          );

        return {
          id: entry.id,
          entryNumber: Number(entry.entryNumber),
          entryDate: entryDateStr,
          concept: entry.concept,
          origin: entry.origin,
          status: entry.status,
          voidedAt: entry.voidedAt ? entry.voidedAt.toISOString() : null,
          voidReason: entry.voidReason ?? null,
          reversedEntryId: entry.reversedEntryId ?? null,
          closingYear: entry.closingYear ?? null,
          isPeriodLocked,
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
      const entry = await this.prisma.$transaction(async (tx) => {
        await this.periodService.assertPeriodOpen(dto.entryDate, tx);

        return tx.accountingEntry.create({
          data: {
            entryDate: new Date(dto.entryDate),
            concept: dto.concept.trim(),
            origin: AccountingEntryOrigin.manual,
            status: 'active',
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
      });

      return {
        id: entry.id,
        entryNumber: Number(entry.entryNumber),
        entryDate: entry.entryDate.toISOString().slice(0, 10),
        concept: entry.concept,
        origin: entry.origin,
        status: entry.status,
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
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[EntryService] Error creando asiento manual:', error);
      throw new InternalServerErrorException('No se pudo registrar el asiento contable.');
    }
  }

  async voidEntry(id: string, dto: VoidAccountingEntryDto, userId?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const original = await tx.accountingEntry.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!original) {
          throw new NotFoundException(`El asiento contable con ID "${id}" no existe.`);
        }

        if (original.status === 'voided') {
          throw new BadRequestException(
            `El asiento #${Number(original.entryNumber)} ya fue anulado previamente.`,
          );
        }

        if (original.origin === AccountingEntryOrigin.reversal) {
          throw new BadRequestException(
            'No se puede anular un contra-asiento de reversión.',
          );
        }

        // Bloqueo estricto si el período mensual o el ejercicio anual está cerrado
        await this.periodService.assertPeriodOpen(original.entryDate, tx);

        if (original.origin === AccountingEntryOrigin.closing) {
          throw new BadRequestException(
            'El asiento de cierre anual se debe reversar desde el submódulo de Cierre de Períodos.',
          );
        }

        const trimmedReason = dto.reason.trim();
        await tx.accountingEntry.update({
          where: { id: original.id },
          data: {
            status: 'voided',
            voidedAt: new Date(),
            voidedById: userId ?? null,
            voidReason: trimmedReason,
          },
        });

        const reversal = await tx.accountingEntry.create({
          data: {
            entryDate: original.entryDate,
            concept: `Anulación Asiento #${Number(original.entryNumber)}: ${trimmedReason}`,
            origin: AccountingEntryOrigin.reversal,
            status: 'active',
            reversedEntryId: original.id,
            items: {
              create: original.items.map((it) => ({
                accountId: it.accountId,
                debit: Number(it.credit),
                credit: Number(it.debit),
                description: it.description
                  ? `Reverso: ${it.description}`
                  : `Reverso asiento #${Number(original.entryNumber)}`,
              })),
            },
          },
          include: {
            items: { include: { account: true } },
          },
        });

        return {
          success: true,
          voidedEntryId: original.id,
          voidedEntryNumber: Number(original.entryNumber),
          reversalEntryId: reversal.id,
          reversalEntryNumber: Number(reversal.entryNumber),
          message: `Asiento #${Number(original.entryNumber)} anulado mediante contra-asiento #${Number(reversal.entryNumber)}.`,
        };
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[EntryService] Error anulando asiento:', error);
      throw new InternalServerErrorException('No se pudo anular el asiento contable.');
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
      where: { posSaleId: sale.id, status: 'active' },
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

    const saleDateStr = sale.soldAt.slice(0, 10);

    try {
      await this.prisma.$transaction(async (tx) => {
        await this.periodService.assertPeriodOpen(saleDateStr, tx);

        await tx.accountingEntry.create({
          data: {
            entryDate: new Date(saleDateStr),
            concept: `Venta POS ${sale.ticketNumber}`,
            origin: AccountingEntryOrigin.pos,
            status: 'active',
            posSaleId: sale.id,
            items: { create: itemsToCreate },
          },
        });
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
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

  async registerShiftDifferenceAdjustment(params: {
    shiftId: string;
    shiftNumber: number;
    closedAt: string;
    cashDifference: number;
    entryDate?: string;
  }): Promise<{ entryId: string; entryNumber: number } | null> {
    const diff = Math.round((params.cashDifference + Number.EPSILON) * 100) / 100;
    if (Math.abs(diff) < 0.01) {
      return null;
    }

    const cashAccount = await this.prisma.accountingAccount.findFirst({
      where: {
        isActive: true,
        OR: [{ code: '1101' }, { accountType: 'activo' }],
      },
      orderBy: { code: 'asc' },
    });

    if (!cashAccount) {
      throw new InternalServerErrorException(
        'Falta la cuenta contable de Caja Efectivo (1101) para registrar diferencias de arqueo.',
      );
    }

    const absDiff = Math.round((Math.abs(diff) + Number.EPSILON) * 100) / 100;
    const isOverage = diff > 0;
    const entryDateStr = params.entryDate || params.closedAt.slice(0, 10);

    let counterAccount;
    if (isOverage) {
      counterAccount =
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '4102' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, accountType: 'ingreso' },
          orderBy: { code: 'asc' },
        }));
    } else {
      counterAccount =
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '6103' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, code: '6102' },
        })) ??
        (await this.prisma.accountingAccount.findFirst({
          where: { isActive: true, accountType: 'gasto' },
          orderBy: { code: 'asc' },
        }));
    }

    if (!counterAccount) {
      throw new InternalServerErrorException(
        isOverage
          ? 'Falta una cuenta de Ingresos / Sobrantes de Caja (4102) para ajustar el arqueo.'
          : 'Falta una cuenta de Gastos / Faltantes de Caja (6103) para ajustar el arqueo.',
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
      const created = await this.prisma.$transaction(async (tx) => {
        await this.periodService.assertPeriodOpen(entryDateStr, tx);

        return tx.accountingEntry.create({
          data: {
            entryDate: new Date(entryDateStr),
            concept: isOverage
              ? `Ajuste Arqueo Caja Turno #${params.shiftNumber} (Sobrante)`
              : `Ajuste Arqueo Caja Turno #${params.shiftNumber} (Faltante)`,
            origin: AccountingEntryOrigin.pos,
            status: 'active',
            items: { create: itemsToCreate },
          },
        });
      });

      return {
        entryId: created.id,
        entryNumber: Number(created.entryNumber),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      console.error('[EntryService] Error registrando ajuste de arqueo:', error);
      throw new InternalServerErrorException(
        'No se pudo registrar el asiento contable de ajuste por diferencia de caja.',
      );
    }
  }
}
