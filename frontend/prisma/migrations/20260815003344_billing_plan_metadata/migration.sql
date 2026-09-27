-- 1. New columns on SubscriptionPlan
ALTER TABLE "SubscriptionPlan" ADD COLUMN "priceQuarterly" DECIMAL(65,30) NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "trialDurationDays" INTEGER;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "tierRank" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "isRecommended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "expiredFallbackPlanId" TEXT;
ALTER TABLE "SubscriptionPlan" ADD COLUMN "upgradePlanId" TEXT;

ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_expiredFallbackPlanId_fkey"
  FOREIGN KEY ("expiredFallbackPlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SubscriptionPlan" ADD CONSTRAINT "SubscriptionPlan_upgradePlanId_fkey"
  FOREIGN KEY ("upgradePlanId") REFERENCES "SubscriptionPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 2. Seed the Free plan
INSERT INTO "SubscriptionPlan" (
  "id", "name", "code", "description",
  "priceMonthly", "priceQuarterly", "priceYearly", "currency",
  "maxLocations", "maxServicesPerLoc", "maxUsersPerOrg", "maxQueueEntriesPerDay",
  "features", "displayOrder", "tierRank", "isActive", "isDefault", "isRecommended",
  "trialDurationDays", "createdAt", "updatedAt"
) VALUES (
  gen_random_uuid(), 'Free', 'free', 'Get started at no cost',
  0, 0, 0, 'USD',
  1, 3, 5, NULL,
  '{"multiLocation": false, "smsNotifications": false, "analytics": false, "apiAccess": false, "customBranding": false, "serviceFlows": false, "servicePoints": true}'::jsonb,
  0, 0, true, true, false,
  NULL, now(), now()
)
ON CONFLICT ("code") DO NOTHING;

-- 3. Fix the existing Starter plan's empty limits/features so it's a real upgrade from Free,
-- and wire it into the new trial/fallback/upgrade fields.
UPDATE "SubscriptionPlan"
SET
  "maxLocations" = 3,
  "maxServicesPerLoc" = 10,
  "maxUsersPerOrg" = 15,
  "features" = '{"multiLocation": true, "smsNotifications": true, "analytics": true, "apiAccess": false, "customBranding": false, "serviceFlows": false, "servicePoints": true}'::jsonb,
  "tierRank" = 1,
  "displayOrder" = 1,
  "trialDurationDays" = 14,
  "isRecommended" = true,
  "expiredFallbackPlanId" = (SELECT "id" FROM "SubscriptionPlan" WHERE "code" = 'free')
WHERE "code" = 'starter';

-- 4. Free's upgrade target is Starter.
UPDATE "SubscriptionPlan"
SET "upgradePlanId" = (SELECT "id" FROM "SubscriptionPlan" WHERE "code" = 'starter')
WHERE "code" = 'free';

-- 5. Backfill: every organization with no subscription gets a real, non-trialing
-- OrganizationSubscription onto the Free plan.
--
-- NOTE: deviates from the brief here. The brief paired newly-inserted
-- OrganizationSubscription rows back to Organizations using only a tight
-- createdAt window, with no per-row key. With more than one org needing
-- backfill that pairing is ambiguous (an UPDATE...FROM join with no 1:1 key),
-- and it reliably assigned the same new subscription id to multiple orgs,
-- violating Organization_subscriptionId_key (confirmed by running it: it
-- failed with duplicate key value violates unique constraint
-- "Organization_subscriptionId_key"). Using a temp table to generate and
-- carry the subscription id alongside the organization id keeps the same
-- net effect (every subscription-less org gets its own new Free
-- OrganizationSubscription) but pairs them deterministically.
CREATE TEMP TABLE "_free_backfill" AS
SELECT gen_random_uuid() AS "subId", o."id" AS "orgId"
FROM "Organization" o
WHERE o."subscriptionId" IS NULL;

INSERT INTO "OrganizationSubscription" (
  "id", "planId", "status", "billingCycle", "trialEndsAt",
  "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt"
)
SELECT
  b."subId",
  (SELECT "id" FROM "SubscriptionPlan" WHERE "code" = 'free'),
  'ACTIVE', 'monthly', NULL,
  now(), now() + interval '1 year', now(), now()
FROM "_free_backfill" b;

UPDATE "Organization" o
SET "subscriptionId" = b."subId"
FROM "_free_backfill" b
WHERE o."id" = b."orgId";

DROP TABLE "_free_backfill";
