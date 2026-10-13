import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../common/audit/audit.service.js';
import { createPaginatedResult } from '../../common/http/pagination.dto.js';
import { IdempotencyService } from '../../common/idempotency/idempotency.service.js';
import { PrismaService } from '../../database/prisma.service.js';
import {
  InventoryOperationType,
  Prisma,
} from '../../generated/prisma/client.js';
import type {
  ConfigureMinimumStockDto,
  UpdateMinimumStockDto,
} from './dto/update-minimum-stock.dto.js';
import type { InventoryAdjustmentDto } from './dto/inventory-adjustment.dto.js';
import type { InventoryEntryDto } from './dto/inventory-entry.dto.js';
import type { InventoryExitDto } from './dto/inventory-exit.dto.js';
import type { InventoryQueryDto } from './dto/inventory-query.dto.js';
import type { MovementsQueryDto } from './dto/movements-query.dto.js';
import {
  toInventoryBalanceResponse,
  toInventoryMovementResponse,
} from './inventory.mapper.js';
import { InventoryRepository } from './inventory.repository.js';
import {
  INVENTORY_BALANCE_SELECTOR,
  INVENTORY_MOVEMENT_SELECTOR,
} from './inventory.selectors.js';

export class ConcurrentModificationInternalError extends Error {
  constructor() {
    super('Conditional update failed due to concurrent modification');
    this.name = 'ConcurrentModificationInternalError';
  }
}

@Injectable()
export class InventoryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: InventoryRepository,
    private readonly idempotencyService: IdempotencyService,
    private readonly auditService: AuditService,
  ) {}

  private async runWithSerializableRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = 3,
  ): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await this.prisma.client.$transaction(
          async (tx) => {
            return await operation(tx);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            timeout: 10_000,
          },
        );
      } catch (error) {
        const isConflict =
          (error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2034') ||
          error instanceof ConcurrentModificationInternalError;

        if (isConflict && attempt < maxRetries) {
          attempt++;
          const jitter = Math.random() * 25;
          await new Promise((resolve) =>
            setTimeout(resolve, attempt * 25 + jitter),
          );
          continue;
        }

        if (isConflict) {
          throw new ConflictException({
            code: 'CONCURRENT_MODIFICATION',
            message:
              'Conflicto de concurrencia al actualizar el inventario tras varios reintentos.',
          });
        }

        throw error;
      }
    }
  }

  private async validateWarehouseAndProduct(
    tx: Prisma.TransactionClient,
    organizationId: string,
    warehouseId: string,
    productId: string,
  ): Promise<{
    warehouseName: string;
    productSku: string;
    productName: string;
  }> {
    const warehouse = await tx.warehouse.findFirst({
      where: {
        id: warehouseId,
        branch: {
          organizationId,
        },
      },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El almacén especificado no existe o está inactivo.',
      });
    }

    const product = await tx.product.findFirst({
      where: {
        id: productId,
        organizationId,
      },
      select: {
        id: true,
        sku: true,
        name: true,
        isActive: true,
      },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El producto especificado no existe o está inactivo.',
      });
    }

    return {
      warehouseName: warehouse.name,
      productSku: product.sku,
      productName: product.name,
    };
  }

  async recordEntry(
    organizationId: string,
    actorMembershipId: string,
    actorUserId: string,
    requestId: string,
    dto: InventoryEntryDto,
    idempotencyKey: string,
  ) {
    if (dto.quantity <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La cantidad debe ser un entero positivo.',
      });
    }

    const requestHash = this.idempotencyService.computeHash(
      'POST',
      '/api/v1/inventory/entries',
      organizationId,
      dto,
    );

    const existingIdempotency = await this.idempotencyService.findRecord(
      this.prisma.client,
      organizationId,
      idempotencyKey,
    );

    if (existingIdempotency) {
      this.idempotencyService.validateHash(
        existingIdempotency.requestHash,
        requestHash,
      );
      return existingIdempotency.responseBody;
    }

    return this.runWithSerializableRetry(async (tx) => {
      // Re-comprobar idempotencia dentro de la transacción por si hubo una carrera
      const inTxIdempotency = await this.idempotencyService.findRecord(
        tx,
        organizationId,
        idempotencyKey,
      );
      if (inTxIdempotency) {
        this.idempotencyService.validateHash(
          inTxIdempotency.requestHash,
          requestHash,
        );
        return inTxIdempotency.responseBody;
      }

      await this.validateWarehouseAndProduct(
        tx,
        organizationId,
        dto.warehouseId,
        dto.productId,
      );

      if (dto.supplierId) {
        const supplier = await tx.supplier.findFirst({
          where: {
            id: dto.supplierId,
            organizationId,
          },
          select: { id: true, isActive: true },
        });

        if (!supplier || !supplier.isActive) {
          throw new NotFoundException({
            code: 'RESOURCE_NOT_FOUND',
            message: 'El proveedor especificado no existe o está inactivo.',
          });
        }
      }

      let balance = await tx.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
      });

      let previousOnHand = 0;
      let newOnHand = dto.quantity;

      if (!balance) {
        balance = await tx.inventoryBalance.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            onHand: newOnHand,
            reserved: 0,
            minimumStock: 0,
          },
        });
      } else {
        previousOnHand = balance.onHand;
        newOnHand = previousOnHand + dto.quantity;

        const updateResult = await tx.inventoryBalance.updateMany({
          where: {
            id: balance.id,
            onHand: balance.onHand,
            reserved: balance.reserved,
          },
          data: {
            onHand: newOnHand,
          },
        });

        if (updateResult.count === 0) {
          throw new ConcurrentModificationInternalError();
        }
      }

      const operation = await tx.inventoryOperation.create({
        data: {
          actorMembershipId,
          type: InventoryOperationType.ENTRY,
          reason: dto.reason?.trim() || null,
          externalReference: dto.externalReference?.trim() || null,
          entry: dto.supplierId
            ? {
                create: {
                  supplierId: dto.supplierId,
                },
              }
            : undefined,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          operationId: operation.id,
          balanceId: balance.id,
          onHandDelta: dto.quantity,
          reservedDelta: 0,
        },
        select: INVENTORY_MOVEMENT_SELECTOR,
      });

      await this.auditService.recordEvent(tx, {
        organizationId,
        actorUserId,
        action: 'inventory.entry',
        entityType: 'InventoryBalance',
        entityId: balance.id,
        requestId,
        changes: [
          {
            field: 'onHand',
            oldValue: previousOnHand,
            newValue: newOnHand,
          },
        ],
      });

      const responsePayload = toInventoryMovementResponse(movement);

      await this.idempotencyService.saveRecord(tx, {
        organizationId,
        key: idempotencyKey,
        requestHash,
        method: 'POST',
        route: '/api/v1/inventory/entries',
        responseStatus: 201,
        responseBody: responsePayload,
        resourceType: 'InventoryMovement',
        resourceId: movement.id,
      });

      return responsePayload;
    });
  }

  async recordExit(
    organizationId: string,
    actorMembershipId: string,
    actorUserId: string,
    requestId: string,
    dto: InventoryExitDto,
    idempotencyKey: string,
  ) {
    if (dto.quantity <= 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'La cantidad debe ser un entero positivo.',
      });
    }

    if (!dto.reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'El motivo es obligatorio en una salida de inventario.',
      });
    }

    const requestHash = this.idempotencyService.computeHash(
      'POST',
      '/api/v1/inventory/exits',
      organizationId,
      dto,
    );

    const existingIdempotency = await this.idempotencyService.findRecord(
      this.prisma.client,
      organizationId,
      idempotencyKey,
    );

    if (existingIdempotency) {
      this.idempotencyService.validateHash(
        existingIdempotency.requestHash,
        requestHash,
      );
      return existingIdempotency.responseBody;
    }

    return this.runWithSerializableRetry(async (tx) => {
      const inTxIdempotency = await this.idempotencyService.findRecord(
        tx,
        organizationId,
        idempotencyKey,
      );
      if (inTxIdempotency) {
        this.idempotencyService.validateHash(
          inTxIdempotency.requestHash,
          requestHash,
        );
        return inTxIdempotency.responseBody;
      }

      await this.validateWarehouseAndProduct(
        tx,
        organizationId,
        dto.warehouseId,
        dto.productId,
      );

      const balance = await tx.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
      });

      if (!balance) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'No hay existencia disponible suficiente.',
          details: {
            available: 0,
            requested: dto.quantity,
          },
        });
      }

      const available = balance.onHand - balance.reserved;
      if (available < dto.quantity) {
        throw new ConflictException({
          code: 'INSUFFICIENT_STOCK',
          message: 'No hay existencia disponible suficiente.',
          details: {
            available,
            requested: dto.quantity,
          },
        });
      }

      const previousOnHand = balance.onHand;
      const newOnHand = previousOnHand - dto.quantity;

      const updateResult = await tx.inventoryBalance.updateMany({
        where: {
          id: balance.id,
          onHand: balance.onHand,
          reserved: balance.reserved,
        },
        data: {
          onHand: newOnHand,
        },
      });

      if (updateResult.count === 0) {
        throw new ConcurrentModificationInternalError();
      }

      const operation = await tx.inventoryOperation.create({
        data: {
          actorMembershipId,
          type: InventoryOperationType.EXIT,
          reason: dto.reason.trim(),
          externalReference: dto.externalReference?.trim() || null,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          operationId: operation.id,
          balanceId: balance.id,
          onHandDelta: -dto.quantity,
          reservedDelta: 0,
        },
        select: INVENTORY_MOVEMENT_SELECTOR,
      });

      await this.auditService.recordEvent(tx, {
        organizationId,
        actorUserId,
        action: 'inventory.exit',
        entityType: 'InventoryBalance',
        entityId: balance.id,
        requestId,
        changes: [
          {
            field: 'onHand',
            oldValue: previousOnHand,
            newValue: newOnHand,
          },
        ],
      });

      const responsePayload = toInventoryMovementResponse(movement);

      await this.idempotencyService.saveRecord(tx, {
        organizationId,
        key: idempotencyKey,
        requestHash,
        method: 'POST',
        route: '/api/v1/inventory/exits',
        responseStatus: 201,
        responseBody: responsePayload,
        resourceType: 'InventoryMovement',
        resourceId: movement.id,
      });

      return responsePayload;
    });
  }

  async recordAdjustment(
    organizationId: string,
    actorMembershipId: string,
    actorUserId: string,
    requestId: string,
    dto: InventoryAdjustmentDto,
    idempotencyKey: string,
  ) {
    if (dto.delta === 0) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'El delta de ajuste no puede ser cero.',
      });
    }

    if (!dto.reason?.trim()) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'El motivo es obligatorio en un ajuste de inventario.',
      });
    }

    const requestHash = this.idempotencyService.computeHash(
      'POST',
      '/api/v1/inventory/adjustments',
      organizationId,
      dto,
    );

    const existingIdempotency = await this.idempotencyService.findRecord(
      this.prisma.client,
      organizationId,
      idempotencyKey,
    );

    if (existingIdempotency) {
      this.idempotencyService.validateHash(
        existingIdempotency.requestHash,
        requestHash,
      );
      return existingIdempotency.responseBody;
    }

    return this.runWithSerializableRetry(async (tx) => {
      const inTxIdempotency = await this.idempotencyService.findRecord(
        tx,
        organizationId,
        idempotencyKey,
      );
      if (inTxIdempotency) {
        this.idempotencyService.validateHash(
          inTxIdempotency.requestHash,
          requestHash,
        );
        return inTxIdempotency.responseBody;
      }

      await this.validateWarehouseAndProduct(
        tx,
        organizationId,
        dto.warehouseId,
        dto.productId,
      );

      let balance = await tx.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
      });

      let previousOnHand = 0;
      let newOnHand: number;

      if (!balance) {
        if (dto.delta < 0) {
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message:
              'No es posible realizar un ajuste negativo sobre un saldo inexistente.',
            details: {
              available: 0,
              requested: Math.abs(dto.delta),
            },
          });
        }

        balance = await tx.inventoryBalance.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            onHand: dto.delta,
            reserved: 0,
            minimumStock: 0,
          },
        });
        newOnHand = dto.delta;
      } else {
        previousOnHand = balance.onHand;
        newOnHand = previousOnHand + dto.delta;

        if (newOnHand < 0) {
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message: 'El ajuste negativo excede la existencia física.',
            details: {
              available: balance.onHand - balance.reserved,
              requested: Math.abs(dto.delta),
            },
          });
        }

        // RN-018: Un ajuste negativo no puede consumir unidades reservadas
        if (newOnHand < balance.reserved) {
          throw new ConflictException({
            code: 'INSUFFICIENT_STOCK',
            message:
              'El ajuste negativo no puede consumir unidades actualmente reservadas.',
            details: {
              available: balance.onHand - balance.reserved,
              requested: Math.abs(dto.delta),
            },
          });
        }

        const updateResult = await tx.inventoryBalance.updateMany({
          where: {
            id: balance.id,
            onHand: balance.onHand,
            reserved: balance.reserved,
          },
          data: {
            onHand: newOnHand,
          },
        });

        if (updateResult.count === 0) {
          throw new ConcurrentModificationInternalError();
        }
      }

      const operation = await tx.inventoryOperation.create({
        data: {
          actorMembershipId,
          type: InventoryOperationType.ADJUSTMENT,
          reason: dto.reason.trim(),
          externalReference: dto.externalReference?.trim() || null,
        },
      });

      const movement = await tx.inventoryMovement.create({
        data: {
          operationId: operation.id,
          balanceId: balance.id,
          onHandDelta: dto.delta,
          reservedDelta: 0,
        },
        select: INVENTORY_MOVEMENT_SELECTOR,
      });

      await this.auditService.recordEvent(tx, {
        organizationId,
        actorUserId,
        action: 'inventory.adjustment',
        entityType: 'InventoryBalance',
        entityId: balance.id,
        requestId,
        changes: [
          {
            field: 'onHand',
            oldValue: previousOnHand,
            newValue: newOnHand,
          },
        ],
      });

      const responsePayload = toInventoryMovementResponse(movement);

      await this.idempotencyService.saveRecord(tx, {
        organizationId,
        key: idempotencyKey,
        requestHash,
        method: 'POST',
        route: '/api/v1/inventory/adjustments',
        responseStatus: 201,
        responseBody: responsePayload,
        resourceType: 'InventoryMovement',
        resourceId: movement.id,
      });

      return responsePayload;
    });
  }

  async updateMinimumStock(
    organizationId: string,
    actorUserId: string,
    requestId: string,
    balanceId: string,
    dto: UpdateMinimumStockDto,
  ) {
    const existing = await this.repository.findBalanceById(
      organizationId,
      balanceId,
    );

    if (!existing) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El saldo de inventario especificado no existe.',
      });
    }

    const previousMinimum = existing.minimumStock;

    const updated = await this.prisma.client.$transaction(async (tx) => {
      const balance = await tx.inventoryBalance.update({
        where: { id: balanceId },
        data: { minimumStock: dto.minimumStock },
        select: INVENTORY_BALANCE_SELECTOR,
      });

      await this.auditService.recordEvent(tx, {
        organizationId,
        actorUserId,
        action: 'inventory.minimum_stock_update',
        entityType: 'InventoryBalance',
        entityId: balance.id,
        requestId,
        changes: [
          {
            field: 'minimumStock',
            oldValue: previousMinimum,
            newValue: dto.minimumStock,
          },
        ],
      });

      return balance;
    });

    return toInventoryBalanceResponse(updated);
  }

  async configureMinimumStock(
    organizationId: string,
    actorUserId: string,
    requestId: string,
    dto: ConfigureMinimumStockDto,
  ) {
    const warehouse = await this.prisma.client.warehouse.findFirst({
      where: {
        id: dto.warehouseId,
        branch: {
          organizationId,
        },
      },
      select: { id: true, isActive: true },
    });

    if (!warehouse || !warehouse.isActive) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El almacén especificado no existe o está inactivo.',
      });
    }

    const product = await this.prisma.client.product.findFirst({
      where: {
        id: dto.productId,
        organizationId,
      },
      select: { id: true, isActive: true },
    });

    if (!product || !product.isActive) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El producto especificado no existe o está inactivo.',
      });
    }

    const balance = await this.prisma.client.$transaction(async (tx) => {
      const existing = await tx.inventoryBalance.findUnique({
        where: {
          warehouseId_productId: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
          },
        },
      });

      let saved;
      if (!existing) {
        saved = await tx.inventoryBalance.create({
          data: {
            warehouseId: dto.warehouseId,
            productId: dto.productId,
            onHand: 0,
            reserved: 0,
            minimumStock: dto.minimumStock,
          },
          select: INVENTORY_BALANCE_SELECTOR,
        });

        await this.auditService.recordEvent(tx, {
          organizationId,
          actorUserId,
          action: 'inventory.balance_create',
          entityType: 'InventoryBalance',
          entityId: saved.id,
          requestId,
          changes: [
            { field: 'minimumStock', oldValue: 0, newValue: dto.minimumStock },
          ],
        });
      } else {
        const previousMinimum = existing.minimumStock;
        saved = await tx.inventoryBalance.update({
          where: { id: existing.id },
          data: { minimumStock: dto.minimumStock },
          select: INVENTORY_BALANCE_SELECTOR,
        });

        await this.auditService.recordEvent(tx, {
          organizationId,
          actorUserId,
          action: 'inventory.minimum_stock_update',
          entityType: 'InventoryBalance',
          entityId: saved.id,
          requestId,
          changes: [
            {
              field: 'minimumStock',
              oldValue: previousMinimum,
              newValue: dto.minimumStock,
            },
          ],
        });
      }

      return saved;
    });

    return toInventoryBalanceResponse(balance);
  }

  async listBalances(organizationId: string, query: InventoryQueryDto) {
    const result = await this.repository.listBalances(organizationId, query);
    return createPaginatedResult(
      result.items.map(toInventoryBalanceResponse),
      result.total,
      result.page,
      result.pageSize,
    );
  }

  async getBalance(organizationId: string, balanceId: string) {
    const balance = await this.repository.findBalanceById(
      organizationId,
      balanceId,
    );

    if (!balance) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El saldo de inventario especificado no existe.',
      });
    }

    return toInventoryBalanceResponse(balance);
  }

  async listMovements(organizationId: string, query: MovementsQueryDto) {
    const result = await this.repository.listMovements(organizationId, query);
    return createPaginatedResult(
      result.items.map(toInventoryMovementResponse),
      result.total,
      result.page,
      result.pageSize,
    );
  }

  async getMovement(organizationId: string, movementId: string) {
    const movement = await this.repository.findMovementById(
      organizationId,
      movementId,
    );

    if (!movement) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'El movimiento especificado no existe.',
      });
    }

    return toInventoryMovementResponse(movement);
  }
}
