import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { PosSaleRecord } from '@repo/types';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { TaxCalculatorService } from '../accounting/tax/tax-calculator.service';
import { InventoryStockService } from '../inventory/stock/inventory-stock.service';
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
    @Optional()
    private readonly taxCalculator?: TaxCalculatorService,
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

        const rawServerTotal = roundMoney(
          pricedItems.reduce((sum, item) => sum + item.lineTotal, 0),
        );
        const taxBreakdown = (
          this.taxCalculator ?? new TaxCalculatorService()
        ).breakdownFromGross(rawServerTotal);
        const serverTotal = taxBreakdown.totalAmount;
        const serverSubtotal = taxBreakdown.netAmount;
        const serverTaxAmount = taxBreakdown.vatAmount;

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
      }, { maxWait: 10000, timeout: 15000 });

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
    const accountingEntryCreated = authoritativeTotal > 0;
    const accountingStatus: 'posted' | 'pending' = accountingEntryCreated
      ? 'pending'
      : 'posted';

    if ((accountingEntryCreated && outboxEventId) || cogsOutboxEventId) {
      void this.dispatchSaleAccountingInBackground({
        saleId: sale.id,
        ticketNumber: sale.ticketNumber,
        outboxEventId: accountingEntryCreated ? outboxEventId : null,
        cogsOutboxEventId,
      });
    }

    return {
      ...mapSaleRecord(sale),
      accountingStatus,
      accountingWarning: null,
      accountingEntryCreated,
    };
  }

  /**
   * Procesa los asientos de ingreso y COGS inmediatamente tras el commit en segundo plano
   * para no retener la respuesta HTTP del cajero esperando múltiples round-trips contables.
   */
  private async dispatchSaleAccountingInBackground(params: {
    saleId: string;
    ticketNumber: string;
    outboxEventId: string | null;
    cogsOutboxEventId: string | null;
  }): Promise<void> {
    if (params.outboxEventId) {
      try {
        await this.accountingOutboxProcessor.processEvent(params.outboxEventId);
        await this.posAccountingStatusService
          .markSalePosted(params.saleId)
          .catch(() => undefined);
      } catch (accError) {
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar en contabilidad';
        console.warn(
          `[PosSaleService] Venta ${params.ticketNumber} guardada, contabilización quedó pendiente en outbox:`,
          errorMsg,
        );
        await this.posAccountingStatusService
          .markSalePending(params.saleId, errorMsg)
          .catch(() => undefined);
      }
    }

    if (params.cogsOutboxEventId) {
      try {
        const cogsProcessResult =
          await this.accountingOutboxProcessor.processEvent(
            params.cogsOutboxEventId,
          );
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
          `[PosSaleService] Venta ${params.ticketNumber} guardada, COGS quedó pendiente en outbox:`,
          cogsMsg,
        );
      }
    }
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
