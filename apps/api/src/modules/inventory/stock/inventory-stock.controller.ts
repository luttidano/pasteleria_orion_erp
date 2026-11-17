import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { InventoryStockService } from './inventory-stock.service';
import type { InventoryStockAlertsSummary } from '@repo/types';
import { Role } from '../../../common/enums';

@Controller('inventory/stock')
@UseGuards(AuthGuard, RolesGuard)
export class InventoryStockController {
    constructor(private readonly stockService: InventoryStockService) {}

    @Get('alerts')
    @Roles(Role.admin, Role.baker, Role.cashier)
    async getStockAlerts(): Promise<InventoryStockAlertsSummary> {
        return this.stockService.getAlertCounts();
    }
}