import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EntryService } from './entry.service';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';
import { VoidAccountingEntryDto } from './dto/accounting-period.dto';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class EntryController {
  constructor(private readonly entryService: EntryService) {}

  @Get('entries')
  @Roles(Role.admin)
  findEntries() {
    return this.entryService.findEntries();
  }

  @Post('entries')
  @Roles(Role.admin)
  createEntry(@Body() dto: CreateAccountingEntryDto) {
    return this.entryService.createEntry(dto);
  }

  @Post('entries/:id/void')
  @Roles(Role.admin)
  voidEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidAccountingEntryDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.entryService.voidEntry(id, dto, userId);
  }

  @Get('pending-sales-count')
  @Roles(Role.admin)
  getPendingSalesCount() {
    return this.entryService.getPendingSalesCount();
  }

  @Post('sync-pending-sales')
  @Roles(Role.admin)
  syncPendingSales() {
    return this.entryService.syncPendingSales();
  }
}