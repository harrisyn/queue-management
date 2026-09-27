-- CreateEnum
CREATE TYPE "AddOnResourceType" AS ENUM ('LOCATIONS', 'USERS');

-- CreateEnum
CREATE TYPE "AddOnBillingMode" AS ENUM ('RECURRING', 'ONE_OFF');

-- CreateEnum
CREATE TYPE "AddOnStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateTable
CREATE TABLE "AddOnPricing" (
    "id" TEXT NOT NULL,
    "resourceType" "AddOnResourceType" NOT NULL,
    "pricePerUnitMonthly" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "pricePerUnitOneOff" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AddOnPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationAddOn" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "resourceType" "AddOnResourceType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "billingMode" "AddOnBillingMode" NOT NULL,
    "status" "AddOnStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT,
    "externalSubscriptionId" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "purchasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OrganizationAddOn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AddOnPricing_resourceType_key" ON "AddOnPricing"("resourceType");

-- CreateIndex
CREATE INDEX "OrganizationAddOn_organizationId_resourceType_status_idx" ON "OrganizationAddOn"("organizationId", "resourceType", "status");

-- CreateIndex
CREATE INDEX "OrganizationAddOn_externalSubscriptionId_idx" ON "OrganizationAddOn"("externalSubscriptionId");

-- AddForeignKey
ALTER TABLE "OrganizationAddOn" ADD CONSTRAINT "OrganizationAddOn_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default (free, i.e. $0) add-on pricing rows so the resolution code
-- never has to handle a missing AddOnPricing row.
INSERT INTO "AddOnPricing" ("id", "resourceType", "pricePerUnitMonthly", "pricePerUnitOneOff", "currency", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'LOCATIONS', 0, 0, 'USD', now(), now()),
  (gen_random_uuid(), 'USERS', 0, 0, 'USD', now(), now())
ON CONFLICT ("resourceType") DO NOTHING;
