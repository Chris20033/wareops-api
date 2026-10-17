-- CreateTable
CREATE TABLE "transfers" (
    "id" UUID NOT NULL,
    "operation_id" UUID NOT NULL,
    "source_balance_id" UUID NOT NULL,
    "destination_balance_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,

    CONSTRAINT "transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "transfers_operation_id_key" ON "transfers"("operation_id");

-- CreateIndex
CREATE INDEX "transfers_source_balance_id_idx" ON "transfers"("source_balance_id");

-- CreateIndex
CREATE INDEX "transfers_destination_balance_id_idx" ON "transfers"("destination_balance_id");

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_operation_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "inventory_operations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_source_balance_id_fkey" FOREIGN KEY ("source_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_destination_balance_id_fkey" FOREIGN KEY ("destination_balance_id") REFERENCES "inventory_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
