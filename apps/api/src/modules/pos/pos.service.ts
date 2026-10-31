import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CreateSaleDto } from './dto/create-sale.dto';
import { AccountingService } from '../accounting/accounting.service';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accountingService: AccountingService,
  ) {}

  /**
   * Registra una venta y sus productos.
   * Ejecuta la persistencia en una transacción atómica ACID mediante Prisma.
   */
  async createSale(dto: CreateSaleDto) {
    if (!dto.items?.length) {
      throw new BadRequestException(
        'La venta debe contener al menos un producto.',
      );
    }

    // Los precios enviados por el navegador no se consideran confiables.
    // Calculamos el total a partir de las líneas de la venta.
    const items = dto.items.map((item) => {
      const lineTotal = this.roundMoney(item.quantity * item.unitPrice);

      return {
        productId: item.productId ?? null,
        productName: item.productName.trim(),
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal,
      };
    });

    if (items.some((item) => !item.productName)) {
      throw new BadRequestException(
        'Todos los productos deben tener un nombre.',
      );
    }

    const itemsTotal = this.roundMoney(
      items.reduce((sum, item) => sum + item.lineTotal, 0),
    );

    const declaredTotal = this.roundMoney(dto.total);
    const declaredSubtotal = this.roundMoney(dto.subtotal);
    const declaredTax = this.roundMoney(dto.taxAmount);

    if (Math.abs(itemsTotal - declaredTotal) > 0.01) {
      throw new BadRequestException(
        'El total de la venta no coincide con el total de sus productos.',
      );
    }

    if (
      Math.abs(
        this.roundMoney(declaredSubtotal + declaredTax) - declaredTotal,
      ) > 0.01
    ) {
      throw new BadRequestException(
        'El subtotal más el impuesto debe coincidir con el total.',
      );
    }

    // El ticket se genera en el servidor para evitar depender
    // del número que envíe el navegador.
    const ticketNumber = `TK-${Date.now()}-${randomUUID()
      .slice(0, 6)
      .toUpperCase()}`;

    // 1. Guardar la cabecera y el detalle en una transacción ACID atómica nativa de base de datos
    let sale;
    try {
      sale = await this.prisma.posSale.create({
        data: {
          ticketNumber,
          paymentMethod: dto.paymentMethod,
          subtotal: declaredSubtotal,
          taxAmount: declaredTax,
          total: declaredTotal,
          status: 'completada',
          accountingStatus: 'posted',
          dataOrigin: 'demo',
          items: {
            create: items.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: {
          items: true,
        },
      });
    } catch (createError) {
      console.error(
        '[PosService] Error registrando venta de forma atómica:',
        createError,
      );
      throw new InternalServerErrorException('No se pudo registrar la venta.');
    }

    // 2. Registrar el ingreso contable asociado a esta venta (desacoplado y con tolerancia a fallos)
    let accountingStatus: 'posted' | 'pending' = 'posted';
    let accountingWarning: string | null = null;

    const accountingEntryCreated = declaredTotal > 0;
    if (accountingEntryCreated) {
      try {
        await this.accountingService.registerSaleIncome({
          id: sale.id,
          ticketNumber: sale.ticketNumber,
          soldAt: sale.soldAt.toISOString(),
          total: declaredTotal,
          paymentMethod: sale.paymentMethod,
        });
      } catch (accError) {
        accountingStatus = 'pending';
        const errorMsg =
          accError instanceof Error
            ? accError.message
            : 'Error al registrar en contabilidad';
        accountingWarning = `Venta registrada en caja. La sincronización contable quedó pendiente: ${errorMsg}`;
        console.warn(
          `[PosService] Venta ${sale.ticketNumber} guardada, pero falló la contabilización:`,
          errorMsg,
        );

        await this.prisma.posSale.update({
          where: { id: sale.id },
          data: {
            accountingStatus: 'pending',
            accountingError: errorMsg,
          },
        });
      }
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      status: sale.status,
      accountingStatus,
      accountingWarning,
      soldAt: sale.soldAt.toISOString(),
      dataOrigin: sale.dataOrigin,
      accountingEntryCreated,
      items: sale.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        line_total: Number(item.lineTotal),
        saleId: item.saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
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
        },
        orderBy: {
          soldAt: 'desc',
        },
        take: 100,
      });

      return sales.map((sale) => ({
        id: sale.id,
        ticketNumber: sale.ticketNumber,
        paymentMethod: sale.paymentMethod,
        subtotal: Number(sale.subtotal),
        taxAmount: Number(sale.taxAmount),
        total: Number(sale.total),
        status: sale.status,
        accountingStatus: sale.accountingStatus ?? 'posted',
        accountingError: sale.accountingError ?? null,
        soldAt: sale.soldAt.toISOString(),
        dataOrigin: sale.dataOrigin,
        items: sale.items.map((item) => ({
          id: item.id,
          sale_id: item.saleId,
          product_id: item.productId,
          product_name: item.productName,
          quantity: item.quantity,
          unit_price: Number(item.unitPrice),
          line_total: Number(item.lineTotal),
          saleId: item.saleId,
          productId: item.productId,
          productName: item.productName,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.lineTotal),
        })),
      }));
    } catch (error) {
      console.error('[PosService] Error consultando ventas:', error);

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
        },
      });
    } catch (error) {
      console.error('[PosService] Error consultando venta:', error);

      throw new InternalServerErrorException(
        'No se pudo consultar la venta.',
      );
    }

    if (!sale) {
      throw new BadRequestException('La venta solicitada no existe.');
    }

    return {
      id: sale.id,
      ticketNumber: sale.ticketNumber,
      paymentMethod: sale.paymentMethod,
      subtotal: Number(sale.subtotal),
      taxAmount: Number(sale.taxAmount),
      total: Number(sale.total),
      status: sale.status,
      accountingStatus: sale.accountingStatus ?? 'posted',
      accountingError: sale.accountingError ?? null,
      soldAt: sale.soldAt.toISOString(),
      dataOrigin: sale.dataOrigin,
      items: sale.items.map((item) => ({
        id: item.id,
        sale_id: item.saleId,
        product_id: item.productId,
        product_name: item.productName,
        quantity: item.quantity,
        unit_price: Number(item.unitPrice),
        line_total: Number(item.lineTotal),
        saleId: item.saleId,
        productId: item.productId,
        productName: item.productName,
        unitPrice: Number(item.unitPrice),
        lineTotal: Number(item.lineTotal),
      })),
    };
  }

  private roundMoney(value: number): number {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  }
}