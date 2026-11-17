import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { IngredientService } from './ingredient.service';
import { CreateIngredientDto } from '../dto/create-ingredient.dto';
import { UpdateIngredientDto } from '../dto/update-ingredient.dto';
import { AdjustStockDto } from '../dto/adjust-stock.dto';
import { AuthGuard } from '../../../common/guards/auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Role } from '../../../common/enums';
import { IdempotencyInterceptor } from '../../../common/interceptors/idempotency.interceptor';

@Controller('ingredients')
@UseGuards(AuthGuard, RolesGuard)
export class IngredientController {
  constructor(private readonly ingredientService: IngredientService) {}

  // Consulta de insumos: permitida para admin, pastelero (baker) y cajero (cashier)
  @Get()
  @Roles(Role.admin, Role.baker, Role.cashier)
  findAll() {
    return this.ingredientService.findAll();
  }

  @Get(':id')
  @Roles(Role.admin, Role.baker, Role.cashier)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientService.findOne(id);
  }

  // Ajuste de stock (ej. registrar uso en cocina o compras): admin y pastelero
  @Post([':id/adjust-stock', ':id/stock'])
  @Roles(Role.admin, Role.baker)
  @UseInterceptors(IdempotencyInterceptor)
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adjustStockDto: AdjustStockDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.ingredientService.adjustStock(id, adjustStockDto, userId);
  }

  // Creación de nuevos insumos: exclusivo de administrador
  @Post()
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  create(@Body() createIngredientDto: CreateIngredientDto) {
    return this.ingredientService.create(createIngredientDto);
  }

  // Edición de insumo: exclusivo de administrador
  @Patch(':id')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIngredientDto: UpdateIngredientDto,
  ) {
    return this.ingredientService.update(id, updateIngredientDto);
  }

  // Eliminación de insumo: exclusivo de administrador
  @Delete(':id')
  @Roles(Role.admin)
  @UseInterceptors(IdempotencyInterceptor)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientService.remove(id);
  }
}
