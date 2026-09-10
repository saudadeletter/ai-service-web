-- DropIndex
DROP INDEX "MoneyEntry_orderId_kind_reference_key";

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "needsReview" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "MoneyCorrection" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MoneyCorrection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerReview" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "previousStatus" "OrderStatus" NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "paidCents" INTEGER NOT NULL,
    "refundedCents" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MoneyCorrection_entryId_key" ON "MoneyCorrection"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "MoneyCorrection_idempotencyKey_key" ON "MoneyCorrection"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerReview_idempotencyKey_key" ON "LedgerReview"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerReview_orderId_createdAt_idx" ON "LedgerReview"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "MoneyEntry_orderId_kind_reference_idx" ON "MoneyEntry"("orderId", "kind", "reference");

-- AddForeignKey
ALTER TABLE "MoneyCorrection" ADD CONSTRAINT "MoneyCorrection_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "MoneyEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerReview" ADD CONSTRAINT "LedgerReview_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LedgerReview" ADD CONSTRAINT "LedgerReview_valid_totals" CHECK ("paidCents" >= 0 AND "refundedCents" BETWEEN 0 AND "paidCents");
