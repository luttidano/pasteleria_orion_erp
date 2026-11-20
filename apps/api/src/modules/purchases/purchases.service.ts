import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccountingOutboxService } from '../accounting/outbox/accounting-outbox.service';
import { AccountingOutboxProcessorService } from '../accounting/outbox/accounting-outbox-processor.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { QuerySupplierInvoicesDto } from './dto/query-supplier-invoices.dto';
import { roundMoney } from '../../common/utils/money.util';
import {
  getZonedDateString,
  parseStrictUtcBounds,
  STORE_TIMEZONE,
} from '../../common/utils/chile-time.util';
import {
  isUniqueViolation,
  rethrowPrismaError,
} from '../../common/utils/prisma-error.util';
import type {
  AccountsPayableSummary,
  SupplierInvoice,
} from '@repo/types';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outboxService: AccountingOutboxService,
    private readonly outboxProcessor: AccountingOutboxProcessorService,
  ) {}

  async getInvoices(
    query?: QuerySupplierInvoicesDto,
  ): Promise<SupplierInvoice[]> {
    const where: Prisma.SupplierInvoiceWhereInput = {};

    if (query?.supplierId) {
      where.supplierId = query.supplierId;
    }

    if (query?.status && query.status !== 'all') {
      where.status = query.status;
    }

    if (query?.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { invoiceNumber: { contains: term, mode: 'insensitive' } },
        { supplier: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    const rows = await this.prisma.supplierInvoice.findMany({
      where,
      include: {
        supplier: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            contactPerson: true,
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
        },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });

    return rows.map((row) => {
      const totalAmount = roundMoney(Number(row.totalAmount));
      const paidAmount = roundMoney(Number(row.paidAmount));
      const remainingAmount = roundMoney(Math.max(0, totalAmount - paidAmount));

      return {
        id: row.id,
        supplierId: row.supplierId,
        invoiceNumber: row.invoiceNumber,
        issueDate: row.issueDate.toISOString().slice(0, 10),
        dueDate: row.dueDate.toISOString().slice(0, 10),
        totalAmount,
        paidAmount,
        remainingAmount,
        status: row.status as SupplierInvoice['status'],
        hasInvoice: row.hasInvoice,
        notes: row.notes,
        createdById: row.createdById,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
        supplier: row.supplier,
        payments: row.payments.map((p) => ({
          id: p.id,
          invoiceId: p.invoiceId,
          paymentDate: p.paymentDate.toISOString().slice(0, 10),
          amount: roundMoney(Number(p.amount)),
          paymentMethod: p.paymentMethod as any,
          reference: p.reference,
          notes: p.notes,
          accountingEntryId: p.accountingEntryId,
          createdById: p.createdById,
          createdAt: p.createdAt.toISOString(),
        })),
      };
    });
  }

  async getSummary(): Promise<AccountsPayableSummary> {
    const todayStr = getZonedDateString(new Date(), STORE_TIMEZONE);
    const todayDate = parseStrictUtcBounds(todayStr, 'today').start;
    const sevenDaysLater = new Date(
      todayDate.getTime() + 7 * 24 * 60 * 60 * 1000,
    );

    const pendingInvoices = await this.prisma.supplierInvoice.findMany({
      where: {
        status: { in: ['pending', 'partial'] },
      },
      select: {
        dueDate: true,
        totalAmount: true,
        paidAmount: true,
      },
    });

    let totalDebt = 0;
    let overdueDebt = 0;
    let upcomingDebt = 0;
    let currentDebt = 0;
    let overdueInvoicesCount = 0;

    for (const inv of pendingInvoices) {
      const remaining = roundMoney(
        Math.max(0, Number(inv.totalAmount) - Number(inv.paidAmount)),
      );
      if (remaining <= 0) continue;

      totalDebt = roundMoney(totalDebt + remaining);
      const dueTime = new Date(inv.dueDate).getTime();

      if (dueTime < todayDate.getTime()) {
        overdueDebt = roundMoney(overdueDebt + remaining);
        overdueInvoicesCount++;
      } else if (dueTime <= sevenDaysLater.getTime()) {
        upcomingDebt = roundMoney(upcomingDebt + remaining);
      } else {
        currentDebt = roundMoney(currentDebt + remaining);
      }
    }

    return {
      totalDebt,
      overdueDebt,
      upcomingDebt,
      currentDebt,
      pendingInvoicesCount: pendingInvoices.length,
      overdueInvoicesCount,
    };
  }

  async createInvoice(
    dto: CreateSupplierInvoiceDto,
    userId?: string,
  ): Promise<SupplierInvoice> {
    const supplier = await this.prisma.supplier.findUnique({
      where: { id: dto.supplierId },
      select: { id: true, name: true },
    });

    if (!supplier) {
      throw new NotFoundException('El proveedor especificado no existe.');
    }

    const todayStr = getZonedDateString(new Date(), STORE_TIMEZONE);
    const issueDateStr = dto.issueDate?.trim() || todayStr;
    const issueDate = parseStrictUtcBounds(issueDateStr, 'issueDate').start;
    const dueDate = parseStrictUtcBounds(dto.dueDate, 'dueDate').start;

    if (dueDate < issueDate) {
      throw new BadRequestException(
        'La fecha de vencimiento no puede ser anterior a la fecha de emisión.',
      );
    }

    const totalAmount = roundMoney(dto.totalAmount);
    if (totalAmount <= 0) {
      throw new BadRequestException('El monto total debe ser mayor a 0.');
    }

    try {
      const created = await this.prisma.supplierInvoice.create({
        data: {
          supplierId: dto.supplierId,
          invoiceNumber: dto.invoiceNumber.trim().toUpperCase(),
          issueDate,
          dueDate,
          totalAmount,
          paidAmount: 0,
          status: 'pending',
          hasInvoice: dto.hasInvoice !== false,
          notes: dto.notes?.trim() || null,
          createdById: userId ?? null,
        },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              phone: true,
              email: true,
              contactPerson: true,
            },
          },
        },
      });

      return {
        id: created.id,
        supplierId: created.supplierId,
        invoiceNumber: created.invoiceNumber,
        issueDate: created.issueDate.toISOString().slice(0, 10),
        dueDate: created.dueDate.toISOString().slice(0, 10),
        totalAmount,
        paidAmount: 0,
        remainingAmount: totalAmount,
        status: 'pending',
        hasInvoice: created.hasInvoice,
        notes: created.notes,
        createdById: created.createdById,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
        supplier: created.supplier,
        payments: [],
      };
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Ya existe una factura registrada con el número "${dto.invoiceNumber.trim().toUpperCase()}" para este proveedor.`,
        );
      }
      rethrowPrismaError(error, {
        fallback: 'No se pudo crear la factura de proveedor.',
      });
    }
  }

  async recordPayment(
    invoiceId: string,
    dto: RecordSupplierPaymentDto,
    userId?: string,
  ) {
    const paymentAmount = roundMoney(dto.amount);
    if (paymentAmount <= 0) {
      throw new BadRequestException('El monto del abono debe ser mayor a 0.');
    }

    const todayStr = getZonedDateString(new Date(), STORE_TIMEZONE);
    const paymentDateStr = dto.paymentDate?.trim() || todayStr;
    const paymentDate = parseStrictUtcBounds(
      paymentDateStr,
      'paymentDate',
    ).start;

    const txResult = await this.prisma.$transaction(async (tx) => {
      // Bloqueo consultivo de concurrencia para evitar doble pago simultáneo
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext('supplier_invoice:' || ${invoiceId}::text)::bigint)
      `;

      const invoice = await tx.supplierInvoice.findUnique({
        where: { id: invoiceId },
        include: {
          supplier: { select: { id: true, name: true } },
        },
      });

      if (!invoice) {
        throw new NotFoundException('La factura de proveedor no existe.');
      }

      if (invoice.status === 'paid') {
        throw new ConflictException(
          'Esta factura ya se encuentra totalmente pagada.',
        );
      }

      if (invoice.status === 'voided') {
        throw new ConflictException('No se pueden abonar facturas anuladas.');
      }

      const currentTotal = roundMoney(Number(invoice.totalAmount));
      const currentPaid = roundMoney(Number(invoice.paidAmount));
      const remainingBalance = roundMoney(currentTotal - currentPaid);

      if (paymentAmount > remainingBalance) {
        throw new BadRequestException(
          `El monto ingresado ($${paymentAmount.toLocaleString('es-CL')}) supera el saldo pendiente de la factura ($${remainingBalance.toLocaleString('es-CL')}).`,
        );
      }

      const newPaidAmount = roundMoney(currentPaid + paymentAmount);
      const newStatus = newPaidAmount >= currentTotal ? 'paid' : 'partial';

      // 1. Crear registro de pago
      const payment = await tx.supplierPayment.create({
        data: {
          invoiceId,
          paymentDate,
          amount: paymentAmount,
          paymentMethod: dto.paymentMethod,
          reference: dto.reference?.trim() || null,
          notes: dto.notes?.trim() || null,
          createdById: userId ?? null,
        },
      });

      // 2. Actualizar factura
      const updatedInvoice = await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          paidAmount: newPaidAmount,
          status: newStatus,
        },
      });

      // 3. Encolar evento outbox para contabilizar la salida de tesorería y reducción del pasivo 2101
      const outbox = await this.outboxService.enqueueSupplierPaymentInTx(tx, {
        paymentId: payment.id,
        invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        supplierId: invoice.supplierId,
        supplierName: invoice.supplier.name,
        amount: paymentAmount,
        paymentMethod: dto.paymentMethod,
        paymentDate,
        reference: dto.reference?.trim(),
        notes: dto.notes?.trim(),
      });

      return {
        payment,
        updatedInvoice,
        outboxId: outbox.id,
        paymentAmount,
        newPaidAmount,
        currentTotal,
        newStatus,
      };
    });

    let accountingEntryId: string | null = null;
    let accountingWarning: string | null = null;

    try {
      const processResult = await this.outboxProcessor.processEvent(
        txResult.outboxId,
      );
      accountingEntryId = processResult.entryId ?? null;
    } catch (accError) {
      const errorMsg =
        accError instanceof Error
          ? accError.message
          : 'Error al contabilizar pago de proveedor';
      accountingWarning = `Abono registrado en Cuentas por Pagar. La sincronización contable quedó diferida: ${errorMsg}`;
      console.warn(
        `[PurchasesService] Abono a factura ${txResult.payment.invoiceId} guardado, pero falló la contabilización:`,
        errorMsg,
      );
    }

    return {
      success: true,
      payment: {
        id: txResult.payment.id,
        invoiceId: txResult.payment.invoiceId,
        amount: txResult.paymentAmount,
        paymentMethod: txResult.payment.paymentMethod,
        paymentDate: txResult.payment.paymentDate.toISOString().slice(0, 10),
        reference: txResult.payment.reference,
        accountingEntryId,
      },
      invoice: {
        id: txResult.updatedInvoice.id,
        paidAmount: txResult.newPaidAmount,
        remainingAmount: roundMoney(
          txResult.currentTotal - txResult.newPaidAmount,
        ),
        status: txResult.newStatus,
      },
      accountingWarning,
    };
  }

  async voidInvoice(invoiceId: string, userId?: string) {
    return await this.prisma.$transaction(async (tx) => {
      const invoice = await tx.supplierInvoice.findUnique({
        where: { id: invoiceId },
      });

      if (!invoice) {
        throw new NotFoundException('La factura no existe.');
      }

      if (Number(invoice.paidAmount) > 0) {
        throw new ConflictException(
          'No es posible anular una factura que ya cuenta con pagos o abonos registrados.',
        );
      }

      const voided = await tx.supplierInvoice.update({
        where: { id: invoiceId },
        data: {
          status: 'voided',
        },
      });

      return {
        success: true,
        invoiceId: voided.id,
        status: 'voided',
        message: 'Factura anulada correctamente.',
      };
    });
  }
}
