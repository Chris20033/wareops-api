import { Module } from '@nestjs/common';
import { BranchesController } from './branches.controller.js';
import { BranchesService } from './branches.service.js';
import { CatalogRepository } from './catalog.repository.js';
import { ProductSuppliersService } from './product-suppliers.service.js';
import { ProductsController } from './products.controller.js';
import { ProductsService } from './products.service.js';
import { SuppliersController } from './suppliers.controller.js';
import { SuppliersService } from './suppliers.service.js';
import { WarehousesController } from './warehouses.controller.js';
import { WarehousesService } from './warehouses.service.js';

@Module({
  controllers: [
    BranchesController,
    WarehousesController,
    ProductsController,
    SuppliersController,
  ],
  providers: [
    CatalogRepository,
    BranchesService,
    WarehousesService,
    ProductsService,
    SuppliersService,
    ProductSuppliersService,
  ],
  exports: [
    CatalogRepository,
    BranchesService,
    WarehousesService,
    ProductsService,
    SuppliersService,
    ProductSuppliersService,
  ],
})
export class CatalogModule {}
