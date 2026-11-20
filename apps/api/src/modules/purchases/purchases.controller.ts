import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PurchasesService } from './purchases.service';
import { CreateSupplierInvoiceDto } from './dto/create-supplier-invoice.dto';
import { RecordSupplierPaymentDto } from './dto/record-supplier-payment.dto';
import { QuerySupplierInvoicesDto } from './dto/query-supplier-invoices.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

@Controller('purchases')
@UseGuards(AuthGuard, RolesGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get('summary')
  @Roles(Role.admin, Role.baker)
  getSummary() {
    return this.purchasesService.getSummary();
  }

  @Get('invoices')
  @Roles(Role.admin, Role.baker)
  getInvoices(@Query() query: QuerySupplierInvoicesDto) {
    return this.purchasesService.getInvoices(query);
  }

  @Post('invoices')
  @Roles(Role.admin, Role.baker)
  createInvoice(
    @Body() dto: CreateSupplierInvoiceDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.purchasesService.createInvoice(dto, userId);
  }

  @Post('invoices/:id/payments')
  @Roles(Role.admin)
  recordPayment(
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @Body() dto: RecordSupplierPaymentDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.purchasesService.recordPayment(invoiceId, dto, userId);
  }

  @Delete('invoices/:id')
  @Roles(Role.admin)
  voidInvoice(
    @Param('id', ParseUUIDPipe) invoiceId: string,
    @CurrentUser('id') userId?: string,
  ) {
    return this.purchasesService.voidInvoice(invoiceId, userId);
  }
}
