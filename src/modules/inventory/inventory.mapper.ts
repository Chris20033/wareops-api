import type {
  InventoryBalancePayload,
  InventoryMovementPayload,
  InventoryOperationPayload,
} from './inventory.selectors.js';

export function toInventoryBalanceResponse(payload: InventoryBalancePayload) {
  const available = payload.onHand - payload.reserved;
  const isBelowMinimum = available <= payload.minimumStock;

  return {
    id: payload.id,
    warehouseId: payload.warehouseId,
    productId: payload.productId,
    onHand: payload.onHand,
    reserved: payload.reserved,
    available,
    minimumStock: payload.minimumStock,
    isBelowMinimum,
    warehouse: {
      id: payload.warehouse.id,
      code: payload.warehouse.code,
      name: payload.warehouse.name,
      branchId: payload.warehouse.branchId,
      branch: {
        id: payload.warehouse.branch.id,
        code: payload.warehouse.branch.code,
        name: payload.warehouse.branch.name,
      },
    },
    product: {
      id: payload.product.id,
      sku: payload.product.sku,
      name: payload.product.name,
      isActive: payload.product.isActive,
    },
    createdAt: payload.createdAt.toISOString(),
    updatedAt: payload.updatedAt.toISOString(),
  };
}

export function toInventoryOperationResponse(
  payload: InventoryOperationPayload,
) {
  return {
    id: payload.id,
    type: payload.type,
    reason: payload.reason,
    externalReference: payload.externalReference,
    createdAt: payload.createdAt.toISOString(),
    actor: {
      membershipId: payload.actorMembershipId,
      userId: payload.actorMembership.userId,
      email: payload.actorMembership.user.email,
      displayName: payload.actorMembership.user.displayName,
    },
    supplier: payload.entry?.supplier
      ? {
          id: payload.entry.supplier.id,
          code: payload.entry.supplier.code,
          name: payload.entry.supplier.name,
        }
      : null,
  };
}

export function toInventoryMovementResponse(payload: InventoryMovementPayload) {
  return {
    id: payload.id,
    operationId: payload.operationId,
    balanceId: payload.balanceId,
    onHandDelta: payload.onHandDelta,
    reservedDelta: payload.reservedDelta,
    createdAt: payload.createdAt.toISOString(),
    operation: toInventoryOperationResponse(payload.operation),
    balance: toInventoryBalanceResponse(payload.balance),
  };
}
