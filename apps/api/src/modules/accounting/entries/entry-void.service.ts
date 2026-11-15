import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { AccountingEntryOrigin } from '../../../common/enums';
import { VoidAccountingEntryDto } from '../dto/accounting-period.dto';
import { AccountingPeriodService } from '../periods/accounting-period.service';
import { rethrowPrismaError } from '../../../common/utils/prisma-error.util';

@Injectable()
export class EntryVoidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly periodService: AccountingPeriodService,
  ) {}

  /**
   * Anulación formal de asiento contable mediante contrasiento reverso en transacción.
   * Valida que el período contable esté abierto y que el asiento no haya sido previamente anulado.
   */
  async voidEntry(id: string, dto: VoidAccountingEntryDto, userId?: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`
          SELECT id
          FROM public.accounting_entry
          WHERE id = ${id}::uuid
          FOR UPDATE
        `;

        const original = await tx.accountingEntry.findUnique({
          where: { id },
          include: { items: true },
        });

        if (!original) {
          throw new NotFoundException(`El asiento contable con ID "${id}" no existe.`);
        }

        if (original.status === 'voided') {
          throw new ConflictException(
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
        const voided = await tx.accountingEntry.updateMany({
          where: { id: original.id, status: 'active' },
          data: {
            status: 'voided',
            voidedAt: new Date(),
            voidedById: userId ?? null,
            voidReason: trimmedReason,
          },
        });

        if (voided.count === 0) {
          throw new ConflictException(
            `El asiento #${Number(original.entryNumber)} ya fue anulado por otra operación simultánea.`,
          );
        }

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
      rethrowPrismaError(error, {
        fallback: 'No se pudo anular el asiento contable.',
      });
    }
  }
}

