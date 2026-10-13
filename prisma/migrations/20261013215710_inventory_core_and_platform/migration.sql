-- CreateEnum
CREATE TYPE "inventory_operation_type" AS ENUM ('ENTRY', 'EXIT', 'ADJUSTMENT', 'TRANSFER', 'ORDER_RESERVE', 'ORDER_RELEASE', 'ORDER_FULFILL');

-- CreateTable
CREATE TABLE "inventory_balances" (
    "id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "on_hand" INTEGER NOT NULL DEFAULT 0,
    "reserved" INTEGER NOT NULL DEFAULT 0,
    "minimum_stock" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "inventory_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_operations" (
    "id" UUID NOT NULL,
    "actor_membership_id" UUID NOT NULL,
    "type" "inventory_operation_type" NOT NULL,
    "reason" VARCHAR(240),
    "external_reference" VARCHAR(120),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_operations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "balance_id" UUID NOT NULL,
    "on_hand_delta" INTEGER NOT NULL,
    "reserved_delta" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_entries" (
    "operation_id" UUID NOT NULL,
    "supplier_id" UUID,

    CONSTRAINT "inventory_entries_pkey" PRIMARY KEY ("operation_id")
);

-- CreateTable
CREATE TABLE "idempotency_records" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(128) NOT NULL,
    "request_hash" CHAR(64) NOT NULL,
    "method" VARCHAR(16) NOT NULL,
    "route" VARCHAR(255) NOT NULL,
    "response_status" INTEGER NOT NULL,
    "response_body" JSONB NOT NULL,
    "resource_type" VARCHAR(80),
    "resource_id" VARCHAR(80),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ,

    CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_events" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" UUID,
    "request_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_changes" (
    "id" UUID NOT NULL,
    "audit_event_id" UUID NOT NULL,
    "field" VARCHAR(120) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,

    CONSTRAINT "audit_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inventory_balances_product_id_idx" ON "inventory_balances"("product_id");

-- CreateIndex
CREATE INDEX "inventory_balances_warehouse_id_idx" ON "inventory_balances"("warehouse_id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_balances_warehouse_id_product_id_key" ON "inventory_balances"("warehouse_id", "product_id");

-- CreateIndex
CREATE INDEX "inventory_operations_actor_membership_id_created_at_idx" ON "inventory_operations"("actor_membership_id", "created_at");

-- CreateIndex
CREATE INDEX "inventory_operations_type_created_at_idx" ON "inventory_operations"("type", "created_at");

-- CreateIndex
CREATE INDEX "inventory_movements_balance_id_id_idx" ON "inventory_movements"("balance_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_operation_id_balance_id_key" ON "inventory_movements"("operation_id", "balance_id");

-- CreateIndex
CREATE INDEX "inventory_entries_supplier_id_idx" ON "inventory_entries"("supplier_id");

-- CreateIndex
CREATE INDEX "idempotency_records_organization_id_created_at_idx" ON "idempotency_records"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "idempotency_records_expires_at_idx" ON "idempotency_records"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_records_organization_id_key_key" ON "idempotency_records"("organization_id", "key");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_created_at_idx" ON "audit_events"("organization_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_events_organization_id_action_idx" ON "audit_events"("organization_id", "action");

-- CreateIndex
CREATE INDEX "audit_events_actor_user_id_idx" ON "audit_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_events_entity_type_entity_id_idx" ON "audit_events"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "audit_changes_audit_event_id_field_key" ON "audit_changes"("audit_event_id", "field");

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_balances" ADD CONSTRAINT "inventory_balances_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_operations" ADD CONSTRAINT "inventory_operations_actor_membership_id_fkey" FOREIGN KEY ("actor_membership_id") REFERENCES "memberships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_balance_id_fkey" FOREIGN KEY ("balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_entries" ADD CONSTRAINT "inventory_entries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "idempotency_records" ADD CONSTRAINT "idempotency_records_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_changes" ADD CONSTRAINT "audit_changes_audit_event_id_fkey" FOREIGN KEY ("audit_event_id") REFERENCES "audit_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
