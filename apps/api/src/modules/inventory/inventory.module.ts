import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { IngredientService } from './ingredients/ingredient.service';
import { IngredientController } from './ingredients/ingredient.controller';
import { RecipeService } from './recipes/recipe.service';
import { RecipeProductionService } from './recipes/recipe-production.service';
import { RecipeController } from './recipes/recipe.controller';
import { CategoryService } from './categories/category.service';
import { CategoryController } from './categories/category.controller';
import { ProductService } from './products/product.service';
import { ProductController } from './products/product.controller';
import { SupplierService } from './suppliers/supplier.service';
import { SupplierController } from './suppliers/supplier.controller';
import { PackagingService } from './packaging/packaging.service';
import { PackagingController } from './packaging/packaging.controller';
import { GeneralSupplyService } from './supplies/general-supply.service';
import { GeneralSupplyController } from './supplies/general-supply.controller';
import { InventoryStockService } from './stock/inventory-stock.service';
import { InventoryValuationModule } from './valuation/inventory-valuation.module';
import { StockMovementService } from './stock/stock-movement.service';
import { InventoryStockController } from './stock/inventory-stock.controller';

@Module({
  imports: [InventoryValuationModule, AccountingModule],
  controllers: [
    CategoryController,
    RecipeController,
    IngredientController,
    ProductController,
    SupplierController,
    PackagingController,
    GeneralSupplyController,
    InventoryStockController,
  ],
  providers: [
    IngredientService,
    RecipeService,
    RecipeProductionService,
    CategoryService,
    ProductService,
    SupplierService,
    PackagingService,
    GeneralSupplyService,
    InventoryStockService,
    StockMovementService,
  ],
  exports: [
    InventoryStockService,
    InventoryValuationModule,
    StockMovementService,
    RecipeProductionService,
  ],
})
export class InventoryModule {}
