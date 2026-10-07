import { Module } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { RecipeService } from './recipe.service';
import { RecipeController } from './recipe.controller';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';

@Module({
  controllers: [CategoryController, RecipeController, InventoryController],
  providers: [InventoryService, RecipeService, CategoryService],
  exports: [InventoryService, RecipeService, CategoryService],
})
export class InventoryModule {}
