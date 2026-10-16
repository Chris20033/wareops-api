import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma } from '../../generated/prisma/client.js';
import type { InventoryQueryDto } from './dto/inventory-query.dto.js';
import type { MovementsQueryDto } from './dto/movements-query.dto.js';
import {
  INVENTORY_BALANCE_SELECTOR,
  INVENTORY_MOVEMENT_SELECTOR,
  type InventoryBalancePayload,
  type InventoryMovementPayload,
} from './inventory.selectors.js';

@Injectable()
export class InventoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findBalanceById(
    organizationId: string,
    balanceId: string,
  ): Promise<InventoryBalancePayload | null> {
    return this.prisma.client.inventoryBalance.findFirst({
      where: {
        id: balanceId,
        warehouse: {
          branch: {
            organizationId,
          },
        },
      },
      select: INVENTORY_BALANCE_SELECTOR,
    });
  }

  async findBalanceByWarehouseAndProduct(
    organizationId: string,
    warehouseId: string,
    productId: string,
  ): Promise<InventoryBalancePayload | null> {
    return this.prisma.client.inventoryBalance.findFirst({
      where: {
        warehouseId,
        productId,
        warehouse: {
          branch: {
            organizationId,
          },
        },
      },
      select: INVENTORY_BALANCE_SELECTOR,
    });
  }

  async listBalances(
    organizationId: string,
    query: InventoryQueryDto,
  ): Promise<{
    items: InventoryBalancePayload[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const where: Prisma.InventoryBalanceWhereInput = {
      warehouse: {
        branch: {
          organizationId,
        },
      },
    };

    if (query.productId) {
      where.productId = query.productId;
    }

    if (query.warehouseId) {
      where.warehouseId = query.warehouseId;
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { product: { sku: { contains: term, mode: 'insensitive' } } },
        { product: { name: { contains: term, mode: 'insensitive' } } },
        { warehouse: { code: { contains: term, mode: 'insensitive' } } },
        { warehouse: { name: { contains: term, mode: 'insensitive' } } },
      ];
    }

    if (query.alertOnly) {
      // De acuerdo a Catálogo de Consultas Prisma (fila 13):
      // "findMany de saldos del tenant y filtro onHand - reserved <= minimumStock en servicio"
      const allMatching = await this.prisma.client.inventoryBalance.findMany({
        where,
        select: INVENTORY_BALANCE_SELECTOR,
        orderBy: { [query.sortBy]: query.sortOrder },
      });

      const alertItems = allMatching.filter(
        (b) => b.onHand - b.reserved <= b.minimumStock,
      );
      const total = alertItems.length;
      const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
      const offset = (query.page - 1) * query.pageSize;
      const paginatedItems = alertItems.slice(offset, offset + query.pageSize);

      return {
        items: paginatedItems,
        total,
        page: query.page,
        pageSize: query.pageSize,
        totalPages,
      };
    }

    const total = await this.prisma.client.inventoryBalance.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const offset = (query.page - 1) * query.pageSize;

    const items = await this.prisma.client.inventoryBalance.findMany({
      where,
      select: INVENTORY_BALANCE_SELECTOR,
      skip: offset,
      take: query.pageSize,
      orderBy: { [query.sortBy]: query.sortOrder },
    });

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
    };
  }

  async listMovements(
    organizationId: string,
    query: MovementsQueryDto,
  ): Promise<{
    items: InventoryMovementPayload[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const where: Prisma.InventoryMovementWhereInput = {
      balance: {
        warehouse: {
          branch: {
            organizationId,
          },
        },
      },
    };

    if (query.productId) {
      where.balance = {
        ...(where.balance as Prisma.InventoryBalanceWhereInput),
        productId: query.productId,
      };
    }

    if (query.warehouseId) {
      where.balance = {
        ...(where.balance as Prisma.InventoryBalanceWhereInput),
        warehouseId: query.warehouseId,
      };
    }

    if (query.type) {
      where.operation = {
        type: query.type,
      };
    }

    if (query.operationId) {
      where.operationId = query.operationId;
    }

    if (query.actorUserId) {
      where.operation = {
        ...(where.operation as Prisma.InventoryOperationWhereInput),
        actorMembership: {
          userId: query.actorUserId,
        },
      };
    }

    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate) {
        where.createdAt.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        where.createdAt.lte = new Date(query.endDate);
      }
    }

    const total = await this.prisma.client.inventoryMovement.count({ where });
    const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
    const offset = (query.page - 1) * query.pageSize;

    const items = await this.prisma.client.inventoryMovement.findMany({
      where,
      select: INVENTORY_MOVEMENT_SELECTOR,
      skip: offset,
      take: query.pageSize,
      orderBy: { [query.sortBy]: query.sortOrder },
    });

    return {
      items,
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages,
    };
  }

  async findMovementById(
    organizationId: string,
    movementId: string,
  ): Promise<InventoryMovementPayload | null> {
    return this.prisma.client.inventoryMovement.findFirst({
      where: {
        id: movementId,
        balance: {
          warehouse: {
            branch: {
              organizationId,
            },
          },
        },
      },
      select: INVENTORY_MOVEMENT_SELECTOR,
    });
  }
}
