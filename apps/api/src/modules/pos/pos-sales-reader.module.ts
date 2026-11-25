import { Module } from '@nestjs/common';
import { PosSalesReaderService } from './pos-sales-reader.service';

/**
 * Submódulo liviano de lectura POS para evitar dependencias circulares con Contabilidad.
 */
@Module({
  providers: [PosSalesReaderService],
  exports: [PosSalesReaderService],
})
export class PosSalesReaderModule {}
