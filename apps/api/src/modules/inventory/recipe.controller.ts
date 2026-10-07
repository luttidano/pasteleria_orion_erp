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
import { RecipeService } from './recipe.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('recipes')
@UseGuards(AuthGuard, RolesGuard)
export class RecipeController {
  constructor(private readonly recipeService: RecipeService) {}

  // Consulta de recetas y disponibilidad: admin y pastelero (baker)
  @Get()
  @Roles(Role.admin, Role.baker)
  findAll() {
    return this.recipeService.findAll();
  }

  @Get(':id')
  @Roles(Role.admin, Role.baker)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipeService.findOne(id);
  }

  // Creación de recetas: exclusivo admin
  @Post()
  @Roles(Role.admin)
  create(@Body() createRecipeDto: CreateRecipeDto) {
    return this.recipeService.create(createRecipeDto);
  }

  // Edición de recetas: exclusivo admin
  @Patch(':id')
  @Roles(Role.admin)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateRecipeDto: UpdateRecipeDto,
  ) {
    return this.recipeService.update(id, updateRecipeDto);
  }

  // Eliminación: exclusivo admin
  @Delete(':id')
  @Roles(Role.admin)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.recipeService.remove(id);
  }
}
