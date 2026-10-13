import { Module } from '@nestjs/common';
import { IngredientService } from './ingredient.service';
import { IngredientController } from './ingredient.controller';
import { RecipeService } from './recipe.service';
import { RecipeController } from './recipe.controller';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';

@Module({
  controllers: [
    CategoryController,
    RecipeController,
    IngredientController,
    ProductController,
  ],
  providers: [
    IngredientService,
    RecipeService,
    CategoryService,
    ProductService,
  ],
  exports: [
    IngredientService,
    RecipeService,
    CategoryService,
    ProductService,
  ],
})
export class InventoryModule {}
