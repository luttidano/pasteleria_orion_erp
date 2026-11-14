import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { IdempotencyInterceptor } from '../../common/interceptors/idempotency.interceptor';
import {
  ActiveShiftQueryDto,
  ClosePosShiftDto,
  UpdateOpeningCashDto,
} from './dto/pos-shift.dto';
import { PosShiftService } from './pos-shift.service';

@Controller('pos/shifts')
@UseGuards(AuthGuard, RolesGuard)
export class PosShiftController {
  constructor(private readonly posShiftService: PosShiftService) {}

  @Get('active')
  @Roles(Role.admin, Role.cashier)
  getActiveShiftOverview(@Query() query: ActiveShiftQueryDto) {
    return this.posShiftService.getActiveShiftOverview(query.from, query.to);
  }

  @Put('active/opening-cash')
  @Roles(Role.admin, Role.cashier)
  @UseInterceptors(IdempotencyInterceptor)
  updateOpeningCash(
    @Body() dto: UpdateOpeningCashDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.posShiftService.updateOpeningCash(dto, userId);
  }

  @Post('close')
  @Roles(Role.admin, Role.cashier)
  @UseInterceptors(IdempotencyInterceptor)
  closeShift(
    @Body() dto: ClosePosShiftDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.posShiftService.closeShift(dto, userId);
  }

  @Get()
  @Roles(Role.admin, Role.cashier)
  findShifts() {
    return this.posShiftService.findShifts();
  }
}
