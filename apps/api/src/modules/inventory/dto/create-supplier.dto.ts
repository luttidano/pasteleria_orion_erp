import { IsString, IsNotEmpty, IsOptional, IsIn, IsEmail } from 'class-validator';

export class CreateSupplierDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del proveedor o establecimiento es obligatorio.' })
  name: string;

  // Opcional: En compras presenciales/mayoristas muchas veces no se cuenta con teléfono directo
  @IsOptional()
  @IsString()
  phone?: string;

  // Opcional: Si es presencial no hay camión de reparto
  @IsOptional()
  @IsString()
  deliverySchedule?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  approximatePrices?: string;

  @IsOptional()
  @IsString()
  contactPerson?: string;

  @IsOptional()
  @IsString()
  icon?: string;

  @IsOptional()
  @IsEmail({}, { message: 'El correo electrónico no es válido.' })
  email?: string;

  // Muy útil para mayoristas y compras presenciales
  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  // Modalidad operativa del proveedor
  @IsOptional()
  @IsIn(['despacho', 'presencial'], {
    message: 'La modalidad debe ser: despacho o presencial.',
  })
  supplyModality?: 'despacho' | 'presencial';

  @IsOptional()
  @IsIn(['materia_prima', 'reventa', 'ambos'], {
    message: 'El tipo debe ser: materia_prima, reventa o ambos.',
  })
  supplierType?: 'materia_prima' | 'reventa' | 'ambos';
}