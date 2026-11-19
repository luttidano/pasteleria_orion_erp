import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums';
import {
  CurrentUser,
  type AuthenticatedUser,
} from '../../common/decorators/current-user.decorator';

@Controller('auth')
export class AuthController {
  @Get('me')
  @Roles(Role.admin, Role.baker, Role.cashier)
  @UseGuards(AuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): AuthenticatedUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email ?? null,
      role: user.role,
    };
  }
}

