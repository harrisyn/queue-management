-- CreateTable
CREATE TABLE "ServicePointInstance" (
    "id" TEXT NOT NULL,
    "servicePointId" TEXT NOT NULL,
    "instanceNumber" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOccupied" BOOLEAN NOT NULL DEFAULT false,
    "occupiedByUserId" TEXT,
    "occupiedAt" TIMESTAMP(3),
    "currentServiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServicePointInstance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicePointInstance_servicePointId_isActive_idx" ON "ServicePointInstance"("servicePointId", "isActive");

-- CreateIndex
CREATE INDEX "ServicePointInstance_occupiedByUserId_idx" ON "ServicePointInstance"("occupiedByUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePointInstance_servicePointId_instanceNumber_key" ON "ServicePointInstance"("servicePointId", "instanceNumber");

-- AddForeignKey
ALTER TABLE "ServicePointInstance" ADD CONSTRAINT "ServicePointInstance_servicePointId_fkey" FOREIGN KEY ("servicePointId") REFERENCES "ServicePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePointInstance" ADD CONSTRAINT "ServicePointInstance_occupiedByUserId_fkey" FOREIGN KEY ("occupiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicePointInstance" ADD CONSTRAINT "ServicePointInstance_currentServiceId_fkey" FOREIGN KEY ("currentServiceId") REFERENCES "Service"("id") ON DELETE SET NULL ON UPDATE CASCADE;
