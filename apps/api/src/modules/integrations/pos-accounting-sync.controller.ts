import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { PosAccountingSyncService } from './pos-accounting-sync.service';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class PosAccountingSyncController {
  constructor(private readonly syncService: PosAccountingSyncService) {}

  @Get('pending-sales-count')
  @Roles(Role.admin)
  getPendingSalesCount() {
    return this.syncService.getPendingSalesCount();
  }

  @Post('sync-pending-sales')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  syncPendingSales() {
    return this.syncService.syncPendingSales();
  }
}

