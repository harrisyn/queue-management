-- CreateEnum
CREATE TYPE "DataSourceType" AS ENUM ('API', 'DATABASE', 'WEBHOOK');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "defaultDisplayMode" TEXT NOT NULL DEFAULT 'TICKET_ONLY',
ADD COLUMN     "identityFieldsConfig" JSONB;

-- AlterTable
ALTER TABLE "QueueEntry" ADD COLUMN     "journeyId" TEXT,
ADD COLUMN     "previousEntryId" TEXT,
ADD COLUMN     "waitDuration" INTEGER;

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "displayMode" TEXT;

-- AlterTable
ALTER TABLE "ServicePointService" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ADD COLUMN     "activatedByUserId" TEXT,
ADD COLUMN     "capacity" INTEGER,
ADD COLUMN     "isOccupied" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "browserFingerprint" TEXT,
ADD COLUMN     "identityData" JSONB;

-- CreateTable
CREATE TABLE "DataSource" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "DataSourceType" NOT NULL,
    "config" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DataSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldMapping" (
    "id" TEXT NOT NULL,
    "dataSourceId" TEXT NOT NULL,
    "sourcePath" TEXT NOT NULL,
    "targetField" TEXT NOT NULL,
    "transform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldMapping_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerJourney" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalDuration" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "queueEntryIds" TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerJourney_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DataSource_organizationId_idx" ON "DataSource"("organizationId");

-- CreateIndex
CREATE INDEX "FieldMapping_dataSourceId_idx" ON "FieldMapping"("dataSourceId");

-- CreateIndex
CREATE INDEX "CustomerJourney_userId_idx" ON "CustomerJourney"("userId");

-- CreateIndex
CREATE INDEX "CustomerJourney_startedAt_idx" ON "CustomerJourney"("startedAt");

-- CreateIndex
CREATE INDEX "CustomerJourney_completedAt_idx" ON "CustomerJourney"("completedAt");

-- CreateIndex
CREATE INDEX "QueueEntry_journeyId_idx" ON "QueueEntry"("journeyId");

-- CreateIndex
CREATE INDEX "ServicePointService_activatedByUserId_idx" ON "ServicePointService"("activatedByUserId");

-- CreateIndex
CREATE INDEX "User_browserFingerprint_idx" ON "User"("browserFingerprint");

-- AddForeignKey
ALTER TABLE "ServicePointService" ADD CONSTRAINT "ServicePointService_activatedByUserId_fkey" FOREIGN KEY ("activatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DataSource" ADD CONSTRAINT "DataSource_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldMapping" ADD CONSTRAINT "FieldMapping_dataSourceId_fkey" FOREIGN KEY ("dataSourceId") REFERENCES "DataSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerJourney" ADD CONSTRAINT "CustomerJourney_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
