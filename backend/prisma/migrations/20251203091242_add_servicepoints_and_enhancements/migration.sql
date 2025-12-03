-- CreateEnum
CREATE TYPE "ServicePointType" AS ENUM ('RECEPTION', 'TRIAGE', 'CONSULTATION', 'CASHIER', 'PHARMACY', 'LAB', 'IMAGING', 'OTHER');

-- AlterTable
ALTER TABLE "Location" ADD COLUMN     "externalReference" TEXT;

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "servicePointId" TEXT,
ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ServiceFlow" ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "isRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "ServicePoint" (
    "id" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "type" "ServicePointType" NOT NULL DEFAULT 'OTHER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePoint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePoint_locationId_isActive_idx" ON "ServicePoint"("locationId", "isActive");

-- CreateIndex
CREATE INDEX "QueueEntry_sessionId_idx" ON "QueueEntry"("sessionId");

-- CreateIndex
CREATE INDEX "ServiceFlow_fromServiceId_priority_idx" ON "ServiceFlow"("fromServiceId", "priority");

-- AddForeignKey
ALTER TABLE "ServicePoint" ADD CONSTRAINT "ServicePoint_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueueEntry" ADD CONSTRAINT "QueueEntry_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "ServicePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
