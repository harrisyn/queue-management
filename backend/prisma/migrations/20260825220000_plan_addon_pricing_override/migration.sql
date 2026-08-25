-- CreateTable
CREATE TABLE "PlanAddOnPricingOverride" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "resourceType" "AddOnResourceType" NOT NULL,
    "pricePerUnitMonthly" DECIMAL(65,30) NOT NULL,
    "pricePerUnitOneOff" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanAddOnPricingOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanAddOnPricingOverride_planId_resourceType_key" ON "PlanAddOnPricingOverride"("planId", "resourceType");

-- AddForeignKey
ALTER TABLE "PlanAddOnPricingOverride" ADD CONSTRAINT "PlanAddOnPricingOverride_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
