import { Module } from '@nestjs/common';
import { IngredientService } from './ingredient.service';
import { IngredientController } from './ingredient.controller';
import { RecipeService } from './recipe.service';
import { RecipeController } from './recipe.controller';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { ProductService } from './product.service';
import { ProductController } from './product.controller';
import { SupplierService } from './supplier.service';
import { SupplierController } from './supplier.controller';
import { PackagingService } from './packaging.service';
import { PackagingController } from './packaging.controller';
@Module({
  controllers: [
    CategoryController,
    RecipeController,
    IngredientController,
    ProductController,
    SupplierController,
    PackagingController
  ],
  providers: [
    IngredientService,
    RecipeService,
    CategoryService,
    ProductService,
    SupplierService,
    PackagingService
  ],
  exports: [
    IngredientService,
    RecipeService,
    CategoryService,
    ProductService,
    SupplierService,
    PackagingService
  ],
})
export class InventoryModule {}
