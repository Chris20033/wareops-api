import { Module } from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryRepository } from './inventory.repository.js';
import { InventoryService } from './inventory.service.js';
import { MovementsController } from './movements.controller.js';

@Module({
  controllers: [InventoryController, MovementsController],
  providers: [
    InventoryService,
    InventoryRepository,
    IdempotencyService,
    AuditService,
  ],
  exports: [InventoryService, InventoryRepository],
})
export class InventoryModule {}
