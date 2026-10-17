import type {
  InventoryBalancePayload,
  InventoryMovementPayload,
  InventoryOperationPayload,
  TransferPayload,
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

export function toTransferResponse(payload: TransferPayload) {
  const sourceMovement = payload.operation.movements.find(
    (m) => m.balanceId === payload.sourceBalanceId,
  );
  const destinationMovement = payload.operation.movements.find(
    (m) => m.balanceId === payload.destinationBalanceId,
  );

  return {
    id: payload.id,
    operationId: payload.operationId,
    sourceBalanceId: payload.sourceBalanceId,
    destinationBalanceId: payload.destinationBalanceId,
    quantity: payload.quantity,
    createdAt: payload.operation.createdAt.toISOString(),
    operation: {
      id: payload.operation.id,
      type: payload.operation.type,
      reason: payload.operation.reason,
      externalReference: payload.operation.externalReference,
      createdAt: payload.operation.createdAt.toISOString(),
      actor: {
        membershipId: payload.operation.actorMembershipId,
        userId: payload.operation.actorMembership.userId,
        email: payload.operation.actorMembership.user.email,
        displayName: payload.operation.actorMembership.user.displayName,
      },
    },
    product: {
      id: payload.sourceBalance.product.id,
      sku: payload.sourceBalance.product.sku,
      name: payload.sourceBalance.product.name,
      isActive: payload.sourceBalance.product.isActive,
    },
    sourceWarehouse: {
      id: payload.sourceBalance.warehouse.id,
      code: payload.sourceBalance.warehouse.code,
      name: payload.sourceBalance.warehouse.name,
      branch: {
        id: payload.sourceBalance.warehouse.branch.id,
        code: payload.sourceBalance.warehouse.branch.code,
        name: payload.sourceBalance.warehouse.branch.name,
      },
    },
    destinationWarehouse: {
      id: payload.destinationBalance.warehouse.id,
      code: payload.destinationBalance.warehouse.code,
      name: payload.destinationBalance.warehouse.name,
      branch: {
        id: payload.destinationBalance.warehouse.branch.id,
        code: payload.destinationBalance.warehouse.branch.code,
        name: payload.destinationBalance.warehouse.branch.name,
      },
    },
    sourceBalance: toInventoryBalanceResponse(payload.sourceBalance),
    destinationBalance: toInventoryBalanceResponse(payload.destinationBalance),
    sourceMovement: sourceMovement
      ? {
          id: sourceMovement.id,
          operationId: sourceMovement.operationId,
          balanceId: sourceMovement.balanceId,
          onHandDelta: sourceMovement.onHandDelta,
          reservedDelta: sourceMovement.reservedDelta,
          createdAt: sourceMovement.createdAt.toISOString(),
        }
      : null,
    destinationMovement: destinationMovement
      ? {
          id: destinationMovement.id,
          operationId: destinationMovement.operationId,
          balanceId: destinationMovement.balanceId,
          onHandDelta: destinationMovement.onHandDelta,
          reservedDelta: destinationMovement.reservedDelta,
          createdAt: destinationMovement.createdAt.toISOString(),
        }
      : null,
    movements: payload.operation.movements.map((m) => ({
      id: m.id,
      operationId: m.operationId,
      balanceId: m.balanceId,
      onHandDelta: m.onHandDelta,
      reservedDelta: m.reservedDelta,
      createdAt: m.createdAt.toISOString(),
      warehouseId: m.balance.warehouseId,
      warehouse: {
        id: m.balance.warehouse.id,
        code: m.balance.warehouse.code,
        name: m.balance.warehouse.name,
        branch: {
          id: m.balance.warehouse.branch.id,
          code: m.balance.warehouse.branch.code,
          name: m.balance.warehouse.branch.name,
        },
      },
    })),
  };
}
