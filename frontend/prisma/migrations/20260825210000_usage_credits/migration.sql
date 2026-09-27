-- CreateEnum
CREATE TYPE "CreditType" AS ENUM ('AI', 'EMAIL', 'SMS');

-- CreateTable
CREATE TABLE "PlanCreditAllowance" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "creditType" "CreditType" NOT NULL,
    "monthlyAllowance" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanCreditAllowance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "creditType" "CreditType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanCreditAllowance_planId_creditType_key" ON "PlanCreditAllowance"("planId", "creditType");

-- CreateIndex
CREATE INDEX "CreditLedgerEntry_organizationId_creditType_createdAt_idx" ON "CreditLedgerEntry"("organizationId", "creditType", "createdAt");

-- AddForeignKey
ALTER TABLE "PlanCreditAllowance" ADD CONSTRAINT "PlanCreditAllowance_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditLedgerEntry" ADD CONSTRAINT "CreditLedgerEntry_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed an unlimited (null) allowance row for every existing plan x credit
-- type, so nothing gets blocked until superadmin explicitly configures a
-- real allowance.
INSERT INTO "PlanCreditAllowance" ("id", "planId", "creditType", "monthlyAllowance", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", ct.credit_type, NULL, now(), now()
FROM "SubscriptionPlan" p
CROSS JOIN (VALUES ('AI'::"CreditType"), ('EMAIL'::"CreditType"), ('SMS'::"CreditType")) AS ct(credit_type)
ON CONFLICT ("planId", "creditType") DO NOTHING;
