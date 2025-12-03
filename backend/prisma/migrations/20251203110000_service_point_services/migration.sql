-- CreateTable: ServicePointService (Many-to-Many relation between ServicePoints and Services)
CREATE TABLE "ServicePointService" (
    "id" TEXT NOT NULL,
    "servicePointId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePointService_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: Unique constraint on servicePointId and serviceId
CREATE UNIQUE INDEX "ServicePointService_servicePointId_serviceId_key" ON "ServicePointService"("servicePointId", "serviceId");

-- CreateIndex: Index for quick lookups by serviceId
CREATE INDEX "ServicePointService_serviceId_idx" ON "ServicePointService"("serviceId");

-- AddForeignKey
ALTER TABLE "ServicePointService" ADD CONSTRAINT "ServicePointService_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "ServicePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePointService" ADD CONSTRAINT "ServicePointService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add average service time tracking to QueueEntry for historical data
ALTER TABLE "QueueEntry" ADD COLUMN IF NOT EXISTS "serviceDuration" INTEGER;
