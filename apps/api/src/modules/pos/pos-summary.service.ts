import { Injectable, InternalServerErrorException } from '@nestjs/common';
import type { PosSalesSummary } from '@repo/types';
import { PrismaService } from '../../database/prisma.service';
import {
  resolveStoreDateRange,
  STORE_TIMEZONE,
} from '../../common/utils/chile-time.util';
import { aggregateSalesTotals } from './pos-totals.helper';

@Injectable()
export class PosSummaryService {
  constructor(private readonly prisma: PrismaService) {}

  async getSalesSummary(from?: string, to?: string): Promise<PosSalesSummary> {
    const { startDate, endDate } = resolveStoreDateRange(
      from,
      to,
      STORE_TIMEZONE,
    );

    try {
      const grouped = await this.prisma.posSale.groupBy({
        by: ['paymentMethod'],
        where: {
          status: 'completada',
          soldAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        _sum: { total: true },
        _count: { _all: true },
      });

      const totals = aggregateSalesTotals(grouped);

      return {
        from: startDate.toISOString(),
        to: endDate.toISOString(),
        ...totals,
      };
    } catch (error) {
      console.error(
        '[PosSummaryService] Error calculando resumen de caja:',
        error,
      );
      throw new InternalServerErrorException(
        'No se pudo calcular el resumen de ventas de caja.',
      );
    }
  }
}
