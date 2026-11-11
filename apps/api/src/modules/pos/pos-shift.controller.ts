import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import {
  ActiveShiftQueryDto,
  ClosePosShiftDto,
  UpdateOpeningCashDto,
} from './dto/pos-shift.dto';
import { PosService } from './pos.service';

@Controller('pos/shifts')
@UseGuards(AuthGuard, RolesGuard)
export class PosShiftController {
  constructor(private readonly posService: PosService) {}

  @Get('active')
  @Roles(Role.admin, Role.cashier)
  getActiveShiftOverview(@Query() query: ActiveShiftQueryDto) {
    return this.posService.getActiveShiftOverview(query.from, query.to);
  }

  @Put('active/opening-cash')
  @Roles(Role.admin, Role.cashier)
  updateOpeningCash(
    @Body() dto: UpdateOpeningCashDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.posService.updateOpeningCash(dto, userId);
  }

  @Post('close')
  @Roles(Role.admin, Role.cashier)
  closeShift(
    @Body() dto: ClosePosShiftDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.posService.closeShift(dto, userId);
  }

  @Get()
  @Roles(Role.admin, Role.cashier)
  findShifts() {
    return this.posService.findShifts();
  }
}

