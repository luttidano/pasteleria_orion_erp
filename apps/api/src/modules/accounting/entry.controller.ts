import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Role } from '../../common/enums';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import { EntryService } from './entry.service';
import { EntryVoidService } from './entry-void.service';
import { CreateAccountingEntryDto } from './dto/create-accounting-entry.dto';
import { VoidAccountingEntryDto } from './dto/accounting-period.dto';

@Controller('accounting')
@UseGuards(AuthGuard, RolesGuard)
export class EntryController {
  constructor(
    private readonly entryService: EntryService,
    private readonly entryVoidService: EntryVoidService,
  ) {}

  @Get('entries')
  @Roles(Role.admin)
  findEntries() {
    return this.entryService.findEntries();
  }

  @Post('entries')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  createEntry(@Body() dto: CreateAccountingEntryDto) {
    return this.entryService.createEntry(dto);
  }

  @Post('entries/:id/void')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  voidEntry(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidAccountingEntryDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.entryVoidService.voidEntry(id, dto, userId);
  }
}