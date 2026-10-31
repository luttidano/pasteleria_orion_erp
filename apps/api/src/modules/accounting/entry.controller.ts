import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EntryService } from './entry.service';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';

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