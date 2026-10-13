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
} from '@nestjs/common';
import { IngredientService } from './ingredient.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

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
  adjustStock(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() adjustStockDto: AdjustStockDto,
  ) {
    return this.ingredientService.adjustStock(id, adjustStockDto);
  }

  // Creación de nuevos insumos: exclusivo de administrador
  @Post()
  @Roles(Role.admin)
  create(@Body() createIngredientDto: CreateIngredientDto) {
    return this.ingredientService.create(createIngredientDto);
  }

  // Edición de insumo: exclusivo de administrador
  @Patch(':id')
  @Roles(Role.admin)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateIngredientDto: UpdateIngredientDto,
  ) {
    return this.ingredientService.update(id, updateIngredientDto);
  }

  // Eliminación de insumo: exclusivo de administrador
  @Delete(':id')
  @Roles(Role.admin)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.ingredientService.remove(id);
  }
}

