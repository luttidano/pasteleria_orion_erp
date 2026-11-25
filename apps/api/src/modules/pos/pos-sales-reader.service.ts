import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface CompletedPosSaleForTax {
  id: string;
  ticketNumber: string;
  paymentMethod: string;
  total: number;
  soldAt: Date;
}

/**
 * Puerto de lectura desacoplado para exponer ventas completadas del módulo POS
 * sin acoplar otros módulos directamente a la tabla `pos_sale`.
 */
@Injectable()
export class PosSalesReaderService {
  constructor(private readonly prisma: PrismaService) {}

  async findCompletedSalesInRange(
    start: Date,
    end: Date,
  ): Promise<CompletedPosSaleForTax[]> {
    const sales = await this.prisma.posSale.findMany({
      where: {
        status: 'completada',
        soldAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        ticketNumber: true,
        paymentMethod: true,
        total: true,
        soldAt: true,
      },
      orderBy: { soldAt: 'asc' },
    });

    return sales.map((sale) => ({
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      total: Number(sale.total),
      soldAt: sale.soldAt,
    }));
  }
}
