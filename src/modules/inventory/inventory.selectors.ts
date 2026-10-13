import type { Prisma } from '../../generated/prisma/client.js';

export const INVENTORY_BALANCE_SELECTOR = {
  id: true,
  warehouseId: true,
  productId: true,
  onHand: true,
  reserved: true,
  minimumStock: true,
  createdAt: true,
  updatedAt: true,
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      branchId: true,
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
          organizationId: true,
        },
      },
    },
  },
  product: {
    select: {
      id: true,
      sku: true,
      name: true,
      organizationId: true,
      isActive: true,
    },
  },
} as const satisfies Prisma.InventoryBalanceSelect;

export type InventoryBalancePayload = Prisma.InventoryBalanceGetPayload<{
  select: typeof INVENTORY_BALANCE_SELECTOR;
}>;

export const INVENTORY_OPERATION_SELECTOR = {
  id: true,
  actorMembershipId: true,
  type: true,
  reason: true,
  externalReference: true,
  createdAt: true,
  actorMembership: {
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
        },
      },
    },
  },
  entry: {
    select: {
      supplierId: true,
      supplier: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  },
} as const satisfies Prisma.InventoryOperationSelect;

export type InventoryOperationPayload = Prisma.InventoryOperationGetPayload<{
  select: typeof INVENTORY_OPERATION_SELECTOR;
}>;

export const INVENTORY_MOVEMENT_SELECTOR = {
  id: true,
  operationId: true,
  balanceId: true,
  onHandDelta: true,
  reservedDelta: true,
  createdAt: true,
  operation: {
    select: INVENTORY_OPERATION_SELECTOR,
  },
  balance: {
    select: INVENTORY_BALANCE_SELECTOR,
  },
} as const satisfies Prisma.InventoryMovementSelect;

export type InventoryMovementPayload = Prisma.InventoryMovementGetPayload<{
  select: typeof INVENTORY_MOVEMENT_SELECTOR;
}>;
