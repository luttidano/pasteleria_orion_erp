import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class QuerySupplierInvoicesDto {
  @IsOptional()
  @IsUUID('4', { message: 'supplierId debe ser un UUID válido.' })
  supplierId?: string;

  @IsOptional()
  @IsIn(['all', 'pending', 'partial', 'paid', 'voided'], {
    message: 'status debe ser "all", "pending", "partial", "paid" o "voided".',
  })
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;
}
