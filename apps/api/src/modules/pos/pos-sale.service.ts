import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PosSaleRecord } from '@repo/types';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { InventoryStockService } from '../inventory/inventory-stock.service';
import { PrismaService } from '../../database/prisma.service';
import { rethrowPrismaError } from '../../common/utils/prisma-error.util';
import { roundMoney } from '../../common/utils/money.util';
import { PosAccountingStatusService } from './pos-accounting-status.service';
import { PosShiftService } from './pos-shift.service';
import { mapSaleRecord } from './pos-totals.helper';

@Injectable()
export class PosSaleService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingOutboxService: AccountingOutboxService,
    private readonly accountingOutboxProcessor: AccountingOutboxProcessorService,
    private readonly posAccountingStatusService: PosAccountingStatusService,
    private readonly inventoryStockService: InventoryStockService,
    private readonly posShiftService: PosShiftService,
  ) {}

  /**
   * Registra una venta y sus productos.
   * Valida inventario con bloqueo pesimista, calcula precios autoritativos en BD
   * y ejecuta la persistencia en una transacción atómica ACID mediante Prisma.
   */
  async createSale(
    dto: CreateSaleDto,
    createdById?: string,
  ): Promise<PosSaleRecord> {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'La venta debe contener al menos un producto.',
      );
    }

    const saleId = randomUUID();
    const ticketNumber = `TK-${Date.now()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    let sale;
    let outboxEventId: string | null = null;
    let cogsOutboxEventId: string | null = null;
    try {
      const txResult = await this.prisma.$transaction(async (tx) => {
        const pricedItems =
          await this.inventoryStockService.reserveAndDeductForSaleInTx(
            tx,
            dto.items,
            {
              saleId,
              ticketNumber,
              createdById,
            },
          );

        const serverTotal = roundMoney(
          pricedItems.reduce((sum, item) => sum + item.lineTotal, 0),
        );
        const serverSubtotal = roundMoney(serverTotal / 1.19);
        const serverTaxAmount = roundMoney(serverTotal - serverSubtotal);

        const activeShift = await this.posShiftService.ensureActiveShiftInTx(
          tx,
          createdById,
        );

        const createdSale = await tx.posSale.create({
          data: {
            id: saleId,
            ticketNumber,
            paymentMethod: dto.paymentMethod,
            subtotal: serverSubtotal,
            taxAmount: serverTaxAmount,
            total: serverTotal,
            status: 'completada',
            accountingStatus: serverTotal > 0 ? 'pending' : 'posted',
            dataOrigin: 'real',
            createdById: createdById ?? null,
            shiftId: activeShift.id,
            items: {
              create: pricedItems.map((item) => ({
                productId: item.productId,
                packagingId: item.packagingId,
                productName: item.productName,
                quantity: item.quantity,
                unitPrice: item.unitPrice,
                unitCost: item.unitCost,
                lineTotal: item.lineTotal,
              })),
            },
          },
          include: {
            items: true,
            createdBy: {
              select: { id: true, name: true, role: true },
            },
          },
        });

        const [outboxEvent, cogsEvent] = await Promise.all([
          serverTotal > 0
            ? this.accountingOutboxService.enqueueSaleInTx(tx, {
                saleId: createdSale.id,
                ticketNumber: createdSale.ticketNumber,
                soldAt: createdSale.soldAt,
                total: serverTotal,
                paymentMethod: createdSale.paymentMethod,
              })
            : Promise.resolve(null),
          typeof this.accountingOutboxService.enqueueSaleCogsInTx === 'function'
            ? this.accountingOutboxService.enqueueSaleCogsInTx(tx, {
                saleId: createdSale.id,
                ticketNumber: createdSale.ticketNumber,
                soldAt: createdSale.soldAt,
                items: (createdSale.items ?? []).map((item: any, idx: number) => ({
                  saleItemId: item.id,
                  productId: item.productId ?? pricedItems[idx]?.productId ?? null,
                  packagingId:
                    item.packagingId ?? pricedItems[idx]?.packagingId ?? null,
                  productName:
                    item.productName ?? pricedItems[idx]?.productName ?? '',
                  quantity: Number(item.quantity ?? pricedItems[idx]?.quantity ?? 0),
                  unitCost: Number(
                    item.unitCost ?? pricedItems[idx]?.unitCost ?? 0,
                  ),
                })),
              })
            : Promise.resolve(null),
        ]);

        return {
          sale: createdSale,
          outboxEventId: outboxEvent?.id ?? null,
          cogsOutboxEventId: cogsEvent?.id ?? null,
        };
      });

      sale = txResult.sale;
      outboxEventId = txResult.outboxEventId;
      cogsOutboxEventId = txResult.cogsOutboxEventId;
    } catch (createError) {
      rethrowPrismaError(createError, {
        checkConstraint:
          'Stock insuficiente para completar la venta solicitada.',
        unique: 'Conflicto de identificador al registrar el ticket de venta.',
        fallback: 'No se pudo registrar la venta ni actualizar el inventario.',
      });
    }

    const authoritativeTotal = roundMoney(Number(sale.total));
    let accountingStatus: 'posted' | 'pending' = 'posted';
    let accountingWarning: string | null = null;

    const accountingEntryCreated = authoritativeTotal > 0;
    if (accountingEntryCreated && outboxEventId) {
      try {
        await this.accountingOutboxProcessor.processEvent(outboxEventId);
        await this.posAccountingStatusService
          .markSalePosted(sale.id)
          .catch(() => undefined);
      } catch (accError) {
        accountingStatus = 'pending';
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar en contabilidad';
        accountingWarning = `Venta registrada en caja. La sincronización contable quedó pendiente: ${errorMsg}`;
        console.warn(
          `[PosSaleService] Venta ${sale.ticketNumber} guardada, pero falló la contabilización:`,
          errorMsg,
        );

        await this.posAccountingStatusService
          .markSalePending(sale.id, errorMsg)
          .catch(() => undefined);
      }
    }

    if (cogsOutboxEventId) {
      try {
        const cogsProcessResult =
          await this.accountingOutboxProcessor.processEvent(cogsOutboxEventId);
        if (cogsProcessResult?.recoveredItemCosts?.length) {
          await this.posAccountingStatusService
            .applyRecoveredItemCosts(cogsProcessResult.recoveredItemCosts)
            .catch(() => undefined);
        }
      } catch (cogsError) {
        const cogsMsg =
          cogsError instanceof Error
            ? cogsError.message
            : 'Error al contabilizar el costo de venta';
        console.warn(
          `[PosSaleService] Venta ${sale.ticketNumber} guardada, pero quedó pendiente el costo de venta (COGS):`,
          cogsMsg,
        );
        accountingWarning = accountingWarning
          ? `${accountingWarning} | Costo de venta pendiente: ${cogsMsg}`
          : `Venta registrada. Costo de venta pendiente en Contabilidad: ${cogsMsg}`;
      }
    }

    return {
      ...mapSaleRecord(sale),
      accountingStatus,
      accountingWarning,
      accountingEntryCreated,
    };
  }

  /**
   * Obtiene las últimas ventas guardadas.
   */
  async findAllSales() {
    try {
      const sales = await this.prisma.posSale.findMany({
        include: {
          items: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          },
        },
        orderBy: { soldAt: 'desc' },
        take: 20,
      });

      return sales.map((sale) => mapSaleRecord(sale));
    } catch (error) {
      console.error('[PosSaleService] Error consultando ventas:', error);
      throw new InternalServerErrorException(
        'No se pudo consultar el historial de ventas.',
      );
    }
  }

  /**
   * Obtiene una venta específica con sus productos.
   */
  async findSaleById(id: string) {
    let sale;
    try {
      sale = await this.prisma.posSale.findUnique({
        where: { id },
        include: {
          items: true,
          createdBy: {
            select: { id: true, name: true, role: true },
          },
        },
      });
    } catch (error) {
      console.error('[PosSaleService] Error consultando venta:', error);
      throw new InternalServerErrorException(
        'No se pudo consultar la venta.',
      );
    }

    if (!sale) {
      throw new NotFoundException('La venta solicitada no existe.');
    }

    return mapSaleRecord(sale);
  }
}
