import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AccountingSettings } from '@repo/types';
import { PrismaService } from '../../../database/prisma.service';
import { extractUtcDate, toUtcDateOnly } from '../../../common/utils/chile-time.util';
import { AccountingOutboxService } from '../outbox/accounting-outbox.service';
import { UpdateAccountingSettingsDto } from '../dto/accounting-period.dto';

@Injectable()
export class AccountingSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: AccountingOutboxService,
  ) {}

  async getSettings(
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<AccountingSettings> {
    const settings = await db.accountingSettings.findUnique({
      where: { id: 'default' },
      include: { updatedBy: { select: { id: true, name: true } } },
    });

    return {
      accountingStartDate: settings?.accountingStartDate
        ? settings.accountingStartDate.toISOString().slice(0, 10)
        : null,
      updatedAt: settings?.updatedAt ? settings.updatedAt.toISOString() : null,
      updatedBy: settings?.updatedBy ?? null,
    };
  }

  async getStartDateUtc(
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ minDateUtc: Date | null; startIso: string | null }> {
    const settings = await db.accountingSettings.findUnique({
      where: { id: 'default' },
      select: { accountingStartDate: true },
    });

    if (!settings?.accountingStartDate) {
      return { minDateUtc: null, startIso: null };
    }

    const minDateUtc = toUtcDateOnly(settings.accountingStartDate);
    return {
      minDateUtc,
      startIso: minDateUtc.toISOString().slice(0, 10),
    };
  }

  async updateSettings(
    dto: UpdateAccountingSettingsDto,
    userId?: string,
  ): Promise<AccountingSettings> {
    const parsedStart = dto.accountingStartDate
      ? extractUtcDate(dto.accountingStartDate)
      : null;

    return this.prisma.$transaction(async (tx) => {
      if (parsedStart) {
        const [earlierEntry, earlierPendingEvent] = await Promise.all([
          tx.accountingEntry.findFirst({
            where: {
              status: 'active',
              entryDate: { lt: parsedStart.dateUtc },
            },
            orderBy: { entryDate: 'asc' },
            select: { entryNumber: true, entryDate: true },
          }),
          this.outboxService.findEarliestPendingBefore(parsedStart.dateUtc, tx),
        ]);

        if (earlierEntry) {
          throw new ConflictException(
            `No puedes fijar el inicio contable en ${parsedStart.isoDate} porque ya existe el asiento activo #${Number(earlierEntry.entryNumber)} con fecha ${earlierEntry.entryDate.toISOString().slice(0, 10)}.`,
          );
        }

        if (earlierPendingEvent) {
          throw new ConflictException(
            `No puedes fijar el inicio contable en ${parsedStart.isoDate} porque existe el evento POS pendiente ${earlierPendingEvent.referenceCode} (${earlierPendingEvent.businessDate.toISOString().slice(0, 10)}).`,
          );
        }
      }

      const saved = await tx.accountingSettings.upsert({
        where: { id: 'default' },
        create: {
          id: 'default',
          accountingStartDate: parsedStart ? parsedStart.dateUtc : null,
          updatedById: userId ?? null,
        },
        update: {
          accountingStartDate: parsedStart ? parsedStart.dateUtc : null,
          updatedById: userId ?? null,
        },
        include: { updatedBy: { select: { id: true, name: true } } },
      });

      return {
        accountingStartDate: saved.accountingStartDate
          ? saved.accountingStartDate.toISOString().slice(0, 10)
          : null,
        updatedAt: saved.updatedAt.toISOString(),
        updatedBy: saved.updatedBy ?? null,
      };
    });
  }
}
