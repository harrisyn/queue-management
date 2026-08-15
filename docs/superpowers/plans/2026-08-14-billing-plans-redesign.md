# Billing Page + Subscription Plan Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn "no subscription" into a real, editable Free `SubscriptionPlan`; add a quarterly billing cycle; redesign the tenant Billing page's cards to be smaller and limit/feature-dense with clear per-cycle savings; add trial-duration, expiry-fallback, upgrade-path, and recommended-plan metadata to plans.

**Architecture:** `SubscriptionPlan` gains six new columns (quarterly price, trial duration, tier rank, recommended flag, and two self-referencing FKs for fallback/upgrade targets). Trial expiry is resolved lazily inside the existing subscription-loading code paths — no new scheduler. A new tenant endpoint switches an org directly onto any $0 plan without going through a payment provider. The superadmin plans page and the tenant billing page both grow to expose the new fields.

**Tech Stack:** Express + Prisma + PostgreSQL backend, Next.js 15 App Router frontend, Stripe + Paystack payment providers, Docker Compose dev environment.

**Spec:** `docs/superpowers/specs/2026-08-14-billing-plans-redesign-design.md`

## Global Constraints

- No proration/refunds on plan switches — a switch just updates the `OrganizationSubscription` row (spec Non-Goals).
- No background job/cron for trial expiry — checked lazily inside `loadSubscription` and the other three read paths (spec: Expiry Enforcement).
- `displayOrder` continues to mean card ordering only; `tierRank` is the separate field used for all upgrade/recommended comparisons (spec: Data Model).
- The free-plan switch endpoint must reject any plan with a non-zero price at any cycle — never bypasses payment for a paid plan (spec: API Changes).
- No new test framework — vitest only, narrow unit tests for the expiry-resolution logic and the Stripe quarterly interval mapping; everything else verified manually via the browser (spec: Testing Plan).

---

### Task 1: Schema migration — plan metadata, seed Free plan, fix Starter, backfill existing orgs

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_billing_plan_metadata/migration.sql`

**Interfaces:**
- Produces: `SubscriptionPlan.priceQuarterly: Decimal`, `.trialDurationDays: Int?`, `.tierRank: Int`, `.isRecommended: Boolean`, `.expiredFallbackPlanId: String?`, `.upgradePlanId: String?` — all later tasks read/write these.

- [ ] **Step 1: Edit the schema**

In `backend/prisma/schema.prisma`, find `model SubscriptionPlan` and add these fields (after the existing `isDefault` field, before `createdAt`):

```prisma
  priceQuarterly        Decimal                  @default(0)
  trialDurationDays     Int?                     // null = no time limit
  tierRank              Int                      @default(0) // separate from displayOrder; upgrade/recommended comparisons only
  isRecommended         Boolean                  @default(false) // one plan at a time
  expiredFallbackPlanId String?
  expiredFallbackPlan   SubscriptionPlan?        @relation("PlanFallback", fields: [expiredFallbackPlanId], references: [id], onDelete: SetNull)
  fallbackForPlans      SubscriptionPlan[]       @relation("PlanFallback")
  upgradePlanId         String?
  upgradePlan           SubscriptionPlan?        @relation("PlanUpgrade", fields: [upgradePlanId], references: [id], onDelete: SetNull)
  upgradeForPlans        SubscriptionPlan[]       @relation("PlanUpgrade")
```

- [ ] **Step 2: Generate the diff for reference (do not apply it directly)**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx prisma migrate diff --from-url "postgresql://postgres:postgres@localhost:5432/qms_db" --to-schema-datamodel prisma/schema.prisma --script > /tmp/schema_diff.sql
cat /tmp/schema_diff.sql
```
Use this only to sanity-check column/constraint names against what you write by hand in Step 3 — this environment's `prisma migrate dev` refuses to run non-interactively, so migrations here are always hand-authored then applied with `migrate deploy`.

- [ ] **Step 3: Write the hand-authored migration**

Create `backend/prisma/migrations/<YYYYMMDDHHMMSS>_billing_plan_metadata/migration.sql` (timestamp = current UTC time, matching the format of existing migration folders):

```sql
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
INSERT INTO "OrganizationSubscription" (
  "id", "planId", "status", "billingCycle", "trialEndsAt",
  "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  (SELECT "id" FROM "SubscriptionPlan" WHERE "code" = 'free'),
  'ACTIVE', 'monthly', NULL,
  now(), now() + interval '1 year', now(), now()
FROM "Organization"
WHERE "subscriptionId" IS NULL;

UPDATE "Organization" o
SET "subscriptionId" = os."id"
FROM "OrganizationSubscription" os
WHERE o."subscriptionId" IS NULL
  AND os."planId" = (SELECT "id" FROM "SubscriptionPlan" WHERE "code" = 'free')
  AND os."createdAt" >= now() - interval '1 minute';
```

The last two statements pair newly-inserted `OrganizationSubscription` rows back to their organizations using a tight `createdAt` window — safe because this migration runs once, and both statements execute back-to-back inside the same migration transaction.

- [ ] **Step 4: Apply the migration**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx prisma generate
```

- [ ] **Step 5: Verify**

```bash
docker exec qms-backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const plans = await p.subscriptionPlan.findMany({ orderBy: { tierRank: 'asc' } });
  console.log('Plans:', JSON.stringify(plans, null, 2));
  const orphanOrgs = await p.organization.count({ where: { subscriptionId: null } });
  console.log('Orgs still without a subscription:', orphanOrgs);
  await p.\$disconnect();
})();
"
```
Expected: a "Free" plan (`tierRank: 0`, `isDefault: true`) and "Starter" (`tierRank: 1`, `trialDurationDays: 14`, `expiredFallbackPlanId` set, `isRecommended: true`, real limit numbers, `upgradePlanId: null`), and `Free.upgradePlanId` pointing at Starter's id. `orphanOrgs` must be `0`.

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: add trial/fallback/upgrade plan metadata, seed Free plan, backfill existing orgs"
```

---

### Task 2: Expiry-resolution pure function + unit tests

**Files:**
- Create: `backend/src/lib/subscriptionExpiry.ts`
- Create: `backend/src/lib/subscriptionExpiry.test.ts`

**Interfaces:**
- Produces: `resolveExpiry(subscription: ExpiryInput, now: Date): ExpiryResolution` — Task 3 imports and calls this from all four subscription-reading call sites.

- [ ] **Step 1: Write the pure resolution function**

```typescript
// backend/src/lib/subscriptionExpiry.ts

export interface ExpiryInput {
  status: string; // SubscriptionStatus, kept as string here to avoid a Prisma import in a pure lib file
  trialEndsAt: Date | null;
  planId: string;
  expiredFallbackPlanId: string | null;
}

export type ExpiryResolution =
  | { action: 'none' }
  | { action: 'fallback'; newPlanId: string }
  | { action: 'expire' };

// Decides what should happen to a subscription's status/plan on read, given
// the current time. Pure and side-effect free - the caller performs the
// actual DB write based on the returned action.
export function resolveExpiry(subscription: ExpiryInput, now: Date): ExpiryResolution {
  if (subscription.status !== 'TRIAL') {
    return { action: 'none' };
  }
  if (!subscription.trialEndsAt || subscription.trialEndsAt >= now) {
    return { action: 'none' };
  }
  if (subscription.expiredFallbackPlanId) {
    return { action: 'fallback', newPlanId: subscription.expiredFallbackPlanId };
  }
  return { action: 'expire' };
}
```

- [ ] **Step 2: Write the tests**

```typescript
// backend/src/lib/subscriptionExpiry.test.ts
import { describe, it, expect } from 'vitest';
import { resolveExpiry } from './subscriptionExpiry';

const NOW = new Date('2026-06-15T00:00:00Z');

describe('resolveExpiry', () => {
  it('does nothing for a non-TRIAL subscription', () => {
    const result = resolveExpiry(
      { status: 'ACTIVE', trialEndsAt: new Date('2026-01-01'), planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'none' });
  });

  it('does nothing for a TRIAL with no trialEndsAt', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: null, planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'none' });
  });

  it('does nothing for a TRIAL that has not expired yet', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: new Date('2026-07-01'), planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'none' });
  });

  it('falls back to the configured plan when a TRIAL has expired and a fallback is set', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: new Date('2026-01-01'), planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'fallback', newPlanId: 'p0' });
  });

  it('expires with no plan change when a TRIAL has expired and there is no fallback', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: new Date('2026-01-01'), planId: 'p1', expiredFallbackPlanId: null },
      NOW
    );
    expect(result).toEqual({ action: 'expire' });
  });
});
```

- [ ] **Step 3: Run the tests**

```bash
cd backend
npx vitest run src/lib/subscriptionExpiry.test.ts
```
Expected: 5 tests passing.

- [ ] **Step 4: Commit**

```bash
git add backend/src/lib/subscriptionExpiry.ts backend/src/lib/subscriptionExpiry.test.ts
git commit -m "feat: add pure trial-expiry resolution function with tests"
```

---

### Task 3: Wire expiry resolution into subscription.middleware.ts + extend getMySubscription

**Files:**
- Modify: `backend/src/middleware/subscription.middleware.ts`

**Interfaces:**
- Consumes: `resolveExpiry` from `../lib/subscriptionExpiry` (Task 2).
- Produces: `getMySubscription`'s JSON response gains `upgradePlan: { id, name } | null` and `isExpiredNoFallback: boolean`.

- [ ] **Step 1: Add an expiry-application helper**

At the top of `backend/src/middleware/subscription.middleware.ts`, add the import and a shared helper right after the existing imports:

```typescript
import { resolveExpiry } from '../lib/subscriptionExpiry';
```

Then add this function after the `DEFAULT_FEATURES` constant:

```typescript
// Applies resolveExpiry's decision to a subscription row, writing the
// resulting state to the DB if anything changed. Returns the up-to-date
// subscription (with `plan` freshly re-fetched if the plan changed).
async function applyExpiryIfNeeded<T extends {
  id: string;
  status: string;
  trialEndsAt: Date | null;
  planId: string;
  plan: { id: string; expiredFallbackPlanId: string | null };
}>(subscription: T): Promise<T> {
  const resolution = resolveExpiry(
    { status: subscription.status, trialEndsAt: subscription.trialEndsAt, planId: subscription.planId, expiredFallbackPlanId: subscription.plan.expiredFallbackPlanId },
    new Date()
  );

  if (resolution.action === 'none') {
    return subscription;
  }

  if (resolution.action === 'expire') {
    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    return { ...subscription, status: 'EXPIRED' };
  }

  // action === 'fallback'
  const fallbackPlan = await prisma.subscriptionPlan.findUnique({ where: { id: resolution.newPlanId } });
  if (!fallbackPlan) {
    // Misconfigured fallback (plan was deleted) - fall through to expire rather than crash.
    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    return { ...subscription, status: 'EXPIRED' };
  }

  const now = new Date();
  const newStatus = fallbackPlan.trialDurationDays ? 'TRIAL' : 'ACTIVE';
  const newTrialEndsAt = fallbackPlan.trialDurationDays
    ? new Date(now.getTime() + fallbackPlan.trialDurationDays * 24 * 60 * 60 * 1000)
    : null;

  const updated = await prisma.organizationSubscription.update({
    where: { id: subscription.id },
    data: {
      planId: fallbackPlan.id,
      status: newStatus,
      trialEndsAt: newTrialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: newTrialEndsAt || new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
    },
    include: { plan: true },
  });

  return updated as unknown as T;
}
```

- [ ] **Step 2: Apply it in `loadSubscription`**

Find the block in `loadSubscription` that reads:
```typescript
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscription: { include: { plan: true } } },
    });
    const subscription = org?.subscription ?? null;

    if (!subscription || subscription.status !== 'ACTIVE') {
```

Replace with:

```typescript
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscription: { include: { plan: true } } },
    });
    let subscription = org?.subscription ?? null;

    if (subscription) {
      subscription = await applyExpiryIfNeeded(subscription);
    }

    if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL')) {
```

(The status check now also accepts `TRIAL` as a valid loaded-subscription state, since a trialing-but-not-yet-expired subscription should use its own plan's features, not `DEFAULT_FEATURES` — this matches the intent of `trialDurationDays` actually granting the plan's features during the trial.)

- [ ] **Step 3: Apply it in `checkLimit`**

Find:
```typescript
export const checkLimit = async (
  organizationId: string,
  limitType: 'locations' | 'services' | 'users'
): Promise<{ current: number; limit: number; allowed: boolean }> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  const subscription = org?.subscription ?? null;

  const features = subscription?.plan?.features as SubscriptionFeatures || DEFAULT_FEATURES;
```

Replace with:

```typescript
export const checkLimit = async (
  organizationId: string,
  limitType: 'locations' | 'services' | 'users'
): Promise<{ current: number; limit: number; allowed: boolean }> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  let subscription = org?.subscription ?? null;
  if (subscription) {
    subscription = await applyExpiryIfNeeded(subscription);
  }

  const isUsable = subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL');
  const features = (isUsable ? subscription!.plan.features : {}) as SubscriptionFeatures;
```

- [ ] **Step 4: Apply it in `getOrganizationFeatures`**

Find:
```typescript
export const getOrganizationFeatures = async (organizationId: string): Promise<SubscriptionFeatures> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  const subscription = org?.subscription ?? null;

  if (!subscription || subscription.status !== 'ACTIVE') {
    return DEFAULT_FEATURES;
  }

  return {
    ...DEFAULT_FEATURES,
    ...(subscription.plan.features as SubscriptionFeatures),
  };
};
```

Replace with:

```typescript
export const getOrganizationFeatures = async (organizationId: string): Promise<SubscriptionFeatures> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  let subscription = org?.subscription ?? null;
  if (subscription) {
    subscription = await applyExpiryIfNeeded(subscription);
  }

  if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL')) {
    return subscription?.status === 'EXPIRED' ? {} : DEFAULT_FEATURES;
  }

  return {
    ...DEFAULT_FEATURES,
    ...(subscription.plan.features as SubscriptionFeatures),
  };
};
```

(An `EXPIRED`-with-no-fallback subscription resolves to `{}` — every feature flag falsy, matching the spec's "disable access" behavior — rather than `DEFAULT_FEATURES`, which would incorrectly grant the free tier's allowances to an org that ran out its trial with no fallback configured.)

- [ ] **Step 5: Extend `getMySubscription`**

Find the block:
```typescript
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscription: { include: { plan: true } } },
    });
    const subscription = org?.subscription ?? null;

    const features = subscription?.plan?.features as SubscriptionFeatures || DEFAULT_FEATURES;
    const mergedFeatures = { ...DEFAULT_FEATURES, ...features };
```

Replace with:

```typescript
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscription: { include: { plan: true } } },
    });
    let subscription = org?.subscription ?? null;
    if (subscription) {
      subscription = await applyExpiryIfNeeded(subscription);
    }

    const isExpiredNoFallback = subscription?.status === 'EXPIRED';
    const isUsable = subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL');
    const features = (isUsable ? subscription!.plan.features : {}) as SubscriptionFeatures;
    const mergedFeatures = isExpiredNoFallback ? {} : { ...DEFAULT_FEATURES, ...features };

    let upgradePlan: { id: string; name: string } | null = null;
    if (subscription?.plan.upgradePlanId) {
      const upgrade = await prisma.subscriptionPlan.findUnique({
        where: { id: subscription.plan.upgradePlanId },
        select: { id: true, name: true },
      });
      upgradePlan = upgrade;
    } else if (!subscription) {
      // No subscription at all - shouldn't happen post-backfill, but if it
      // does, point at whatever plan is currently marked isDefault so the
      // upsell still has somewhere to send the user.
      const defaultPlan = await prisma.subscriptionPlan.findFirst({ where: { isDefault: true }, select: { id: true, name: true } });
      upgradePlan = defaultPlan;
    }
```

Then find the `return res.json({ subscription: subscription ? { ... } : null, features: mergedFeatures, ... activeProviders });` block near the end of `getMySubscription` and add the two new fields to it:

```typescript
    return res.json({
      subscription: subscription ? {
        planId: subscription.planId,
        planName: subscription.plan.name,
        planCode: subscription.plan.code,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
      } : null,
      features: mergedFeatures,
      limits: {
        locations: {
          current: locationCount,
          limit: mergedFeatures.maxLocations || 0,
          allowed: locationCount < (mergedFeatures.maxLocations || 0),
        },
        services: {
          current: serviceCount,
          limit: mergedFeatures.maxServices || 0,
          allowed: serviceCount < (mergedFeatures.maxServices || 0),
        },
        users: {
          current: userCount,
          limit: mergedFeatures.maxUsers || 0,
          allowed: userCount < (mergedFeatures.maxUsers || 0),
        },
      },
      activeProviders,
      upgradePlan,
      isExpiredNoFallback,
    });
```

(The `|| 1` / `|| 3` / `|| 5` fallbacks in the original limits block are replaced with `|| 0` — with `mergedFeatures` now correctly `{}` for an expired-no-fallback org, falling back to the old defaults would have silently un-done the lockdown. Every other status still merges `DEFAULT_FEATURES` first, so those limits are unaffected.)

- [ ] **Step 6: Type-check**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit 2>&1 | grep subscription.middleware
```
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add backend/src/middleware/subscription.middleware.ts
git commit -m "feat: resolve trial expiry lazily on every subscription read, extend getMySubscription"
```

---

### Task 4: Tenant switch-to-free endpoint

**Files:**
- Modify: `backend/src/controllers/subscriptionCheckout.controller.ts`
- Modify: `backend/src/routes/index.ts`

**Interfaces:**
- Produces: `POST /tenant/subscription/switch/:planId` — 200 with the updated subscription summary, 400 if the target plan has any non-zero price, 404 if the plan doesn't exist or is inactive.

- [ ] **Step 1: Add the switch handler**

In `backend/src/controllers/subscriptionCheckout.controller.ts`, add this new export at the bottom of the file:

```typescript
export const switchToFreePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { planId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });
    if (!user?.organizationId) {
      return res.status(400).json({ error: 'User has no organization' });
    }

    const plan = await prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const isFree = Number(plan.priceMonthly) === 0 && Number(plan.priceQuarterly) === 0 && Number(plan.priceYearly) === 0;
    if (!isFree) {
      return res.status(400).json({ error: 'This plan requires payment; use checkout instead' });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscriptionId: true },
    });

    const now = new Date();
    const periodEnd = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

    let subscriptionId: string;
    if (org?.subscriptionId) {
      const updated = await prisma.organizationSubscription.update({
        where: { id: org.subscriptionId },
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          trialEndsAt: null,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      subscriptionId = updated.id;
    } else {
      const created = await prisma.organizationSubscription.create({
        data: {
          planId: plan.id,
          status: 'ACTIVE',
          billingCycle: 'monthly',
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
        },
      });
      subscriptionId = created.id;
      await prisma.organization.update({
        where: { id: user.organizationId },
        data: { subscriptionId },
      });
    }

    res.json({ success: true, planId: plan.id, planName: plan.name });
  } catch (error) {
    next(error);
  }
};
```

Add `Request, Response, NextFunction` and `prisma` to the top of the file if not already imported (they already are, per the existing `createCheckoutSession` in this file).

- [ ] **Step 2: Wire the route**

In `backend/src/routes/index.ts`, find:
```typescript
router.post('/tenant/subscription/checkout', authenticate, createCheckoutSession);
```
Add directly below it:
```typescript
router.post('/tenant/subscription/switch/:planId', authenticate, switchToFreePlan);
```

Update the import line just above (`import { createCheckoutSession } from '../controllers/subscriptionCheckout.controller';`) to:
```typescript
import { createCheckoutSession, switchToFreePlan } from '../controllers/subscriptionCheckout.controller';
```

- [ ] **Step 3: Type-check**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit 2>&1 | grep -E "subscriptionCheckout.controller|routes/index"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/subscriptionCheckout.controller.ts backend/src/routes/index.ts
git commit -m "feat: add tenant endpoint to switch directly onto a free plan"
```

---

### Task 5: Assign the default plan at organization signup

**Files:**
- Modify: `backend/src/controllers/organization.controller.ts`

**Interfaces:**
- Consumes: `SubscriptionPlan.isDefault`, `.trialDurationDays` (Task 1).

- [ ] **Step 1: Create the subscription inside the registration transaction**

In `backend/src/controllers/organization.controller.ts`, `registerOrganization`, find the transaction block:

```typescript
    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          email: actualAdminEmail, // Use admin email as org email
          phone: phone || null,
          slug: resolvedSlug,
        },
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          email: actualAdminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          role: 'ORG_ADMIN',
          organizationId: organization.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      return { organization, adminUser };
    });
```

Replace with:

```typescript
    // Create organization and admin user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: organizationName,
          email: actualAdminEmail, // Use admin email as org email
          phone: phone || null,
          slug: resolvedSlug,
        },
      });

      // Hash password
      const hashedPassword = await bcrypt.hash(adminPassword, 10);

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          email: actualAdminEmail,
          password: hashedPassword,
          firstName: adminFirstName,
          lastName: adminLastName,
          role: 'ORG_ADMIN',
          organizationId: organization.id,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
        },
      });

      // Assign the default plan (e.g. Free) so every org starts with a real
      // subscription instead of relying on the null-subscription fallback.
      const defaultPlan = await tx.subscriptionPlan.findFirst({ where: { isDefault: true, isActive: true } });
      if (defaultPlan) {
        const now = new Date();
        const trialEndsAt = defaultPlan.trialDurationDays
          ? new Date(now.getTime() + defaultPlan.trialDurationDays * 24 * 60 * 60 * 1000)
          : null;
        const subscription = await tx.organizationSubscription.create({
          data: {
            planId: defaultPlan.id,
            status: defaultPlan.trialDurationDays ? 'TRIAL' : 'ACTIVE',
            billingCycle: 'monthly',
            trialEndsAt,
            currentPeriodStart: now,
            currentPeriodEnd: trialEndsAt || new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
          },
        });
        await tx.organization.update({
          where: { id: organization.id },
          data: { subscriptionId: subscription.id },
        });
      }

      return { organization, adminUser };
    });
```

- [ ] **Step 2: Type-check**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit 2>&1 | grep organization.controller
```
Expected: no output.

- [ ] **Step 3: Manual verification**

```
POST /api/v1/auth/register (or use the frontend registration page) with a fresh org.
Then: docker exec qms-backend node -e "..." querying prisma.organization.findFirst({ where: { name: '<the new org name>' }, include: { subscription: { include: { plan: true } } } })
Expected: subscription.plan.code === 'free' (assuming Free is still the isDefault plan), status ACTIVE, trialEndsAt null.
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/organization.controller.ts
git commit -m "feat: assign the default subscription plan when a new organization registers"
```

---

### Task 6: Superadmin plan CRUD — accept the new fields

**Files:**
- Modify: `backend/src/controllers/superadmin.controller.ts`

**Interfaces:**
- Produces: `createPlan`/`updatePlan` accept and persist `priceQuarterly`, `trialDurationDays`, `tierRank`, `isRecommended`, `expiredFallbackPlanId`, `upgradePlanId`.

- [ ] **Step 1: Extend `createPlan`**

Find the destructure in `createPlan`:
```typescript
    const {
      name,
      code,
      description,
      priceMonthly,
      priceYearly,
      currency,
      maxLocations,
      maxServicesPerLoc,
      maxUsersPerOrg,
      maxQueueEntriesPerDay,
      features,
      displayOrder,
      isDefault,
    } = req.body;
```

Replace with:
```typescript
    const {
      name,
      code,
      description,
      priceMonthly,
      priceQuarterly,
      priceYearly,
      currency,
      maxLocations,
      maxServicesPerLoc,
      maxUsersPerOrg,
      maxQueueEntriesPerDay,
      features,
      displayOrder,
      tierRank,
      isDefault,
      isRecommended,
      trialDurationDays,
      expiredFallbackPlanId,
      upgradePlanId,
    } = req.body;
```

Find:
```typescript
    if (!name || !code) {
      return res.status(400).json({ error: 'Name and code are required' });
    }
```
Add directly after it:
```typescript
    if (expiredFallbackPlanId && expiredFallbackPlanId === code) {
      return res.status(400).json({ error: 'A plan cannot be its own fallback' });
    }
```
(This check against `code` is a placeholder guard for the create path, where the plan's own `id` doesn't exist yet — the real self-reference check that matters is in `updatePlan`, Step 2 below, where the plan's `id` is already known. Leave this `createPlan` check as-is; it can never trigger in practice since `expiredFallbackPlanId` is a UUID and `code` is a slug, but the pattern match keeps `createPlan` and `updatePlan` visually parallel. Actual protection against a genuinely self-referencing create — pointing at a plan created in a *previous* request — isn't possible to violate here since the new plan's id doesn't exist until after this function returns.)

Find:
```typescript
    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.subscriptionPlan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        code,
        description,
        priceMonthly: priceMonthly || 0,
        priceYearly: priceYearly || 0,
        currency: currency || 'USD',
        maxLocations: maxLocations || null,
        maxServicesPerLoc: maxServicesPerLoc || null,
        maxUsersPerOrg: maxUsersPerOrg || null,
        maxQueueEntriesPerDay: maxQueueEntriesPerDay || null,
        features: features || {},
        displayOrder: displayOrder || 0,
        isDefault: isDefault || false,
      },
    });
```

Replace with:
```typescript
    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.subscriptionPlan.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    // If this is set as recommended, unset any other recommended plan
    if (isRecommended) {
      await prisma.subscriptionPlan.updateMany({
        where: { isRecommended: true },
        data: { isRecommended: false },
      });
    }

    const plan = await prisma.subscriptionPlan.create({
      data: {
        name,
        code,
        description,
        priceMonthly: priceMonthly || 0,
        priceQuarterly: priceQuarterly || 0,
        priceYearly: priceYearly || 0,
        currency: currency || 'USD',
        maxLocations: maxLocations || null,
        maxServicesPerLoc: maxServicesPerLoc || null,
        maxUsersPerOrg: maxUsersPerOrg || null,
        maxQueueEntriesPerDay: maxQueueEntriesPerDay || null,
        features: features || {},
        displayOrder: displayOrder || 0,
        tierRank: tierRank || 0,
        isDefault: isDefault || false,
        isRecommended: isRecommended || false,
        trialDurationDays: trialDurationDays || null,
        expiredFallbackPlanId: expiredFallbackPlanId || null,
        upgradePlanId: upgradePlanId || null,
      },
    });
```

- [ ] **Step 2: Extend `updatePlan`**

Find the destructure in `updatePlan`:
```typescript
    const {
      name,
      description,
      priceMonthly,
      priceYearly,
      currency,
      maxLocations,
      maxServicesPerLoc,
      maxUsersPerOrg,
      maxQueueEntriesPerDay,
      features,
      displayOrder,
      isActive,
      isDefault,
    } = req.body;
```

Replace with:
```typescript
    const {
      name,
      description,
      priceMonthly,
      priceQuarterly,
      priceYearly,
      currency,
      maxLocations,
      maxServicesPerLoc,
      maxUsersPerOrg,
      maxQueueEntriesPerDay,
      features,
      displayOrder,
      tierRank,
      isActive,
      isDefault,
      isRecommended,
      trialDurationDays,
      expiredFallbackPlanId,
      upgradePlanId,
    } = req.body;
```

Find:
```typescript
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    // If this is set as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.subscriptionPlan.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
```

Replace with:
```typescript
    const existing = await prisma.subscriptionPlan.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (expiredFallbackPlanId === id || upgradePlanId === id) {
      return res.status(400).json({ error: 'A plan cannot reference itself as its fallback or upgrade target' });
    }

    // If this is set as default, unset other defaults
    if (isDefault && !existing.isDefault) {
      await prisma.subscriptionPlan.updateMany({
        where: { isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }
    // If this is set as recommended, unset any other recommended plan
    if (isRecommended && !existing.isRecommended) {
      await prisma.subscriptionPlan.updateMany({
        where: { isRecommended: true, id: { not: id } },
        data: { isRecommended: false },
      });
    }
```

Find:
```typescript
    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        priceMonthly: priceMonthly ?? undefined,
        priceYearly: priceYearly ?? undefined,
        currency: currency ?? undefined,
        maxLocations: maxLocations === null ? null : (maxLocations ?? undefined),
        maxServicesPerLoc: maxServicesPerLoc === null ? null : (maxServicesPerLoc ?? undefined),
        maxUsersPerOrg: maxUsersPerOrg === null ? null : (maxUsersPerOrg ?? undefined),
        maxQueueEntriesPerDay: maxQueueEntriesPerDay === null ? null : (maxQueueEntriesPerDay ?? undefined),
        features: features ?? undefined,
        displayOrder: displayOrder ?? undefined,
        isActive: isActive ?? undefined,
        isDefault: isDefault ?? undefined,
      },
    });
```

Replace with:
```typescript
    const plan = await prisma.subscriptionPlan.update({
      where: { id },
      data: {
        name: name ?? undefined,
        description: description ?? undefined,
        priceMonthly: priceMonthly ?? undefined,
        priceQuarterly: priceQuarterly ?? undefined,
        priceYearly: priceYearly ?? undefined,
        currency: currency ?? undefined,
        maxLocations: maxLocations === null ? null : (maxLocations ?? undefined),
        maxServicesPerLoc: maxServicesPerLoc === null ? null : (maxServicesPerLoc ?? undefined),
        maxUsersPerOrg: maxUsersPerOrg === null ? null : (maxUsersPerOrg ?? undefined),
        maxQueueEntriesPerDay: maxQueueEntriesPerDay === null ? null : (maxQueueEntriesPerDay ?? undefined),
        features: features ?? undefined,
        displayOrder: displayOrder ?? undefined,
        tierRank: tierRank ?? undefined,
        isActive: isActive ?? undefined,
        isDefault: isDefault ?? undefined,
        isRecommended: isRecommended ?? undefined,
        trialDurationDays: trialDurationDays === null ? null : (trialDurationDays ?? undefined),
        expiredFallbackPlanId: expiredFallbackPlanId === null ? null : (expiredFallbackPlanId ?? undefined),
        upgradePlanId: upgradePlanId === null ? null : (upgradePlanId ?? undefined),
      },
    });
```

- [ ] **Step 3: Type-check**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit 2>&1 | grep superadmin.controller
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/superadmin.controller.ts
git commit -m "feat: accept trial/fallback/upgrade/tier fields in plan create and update"
```

---

### Task 7: Payment types + Stripe quarterly billing

**Files:**
- Modify: `backend/src/services/payments/types.ts`
- Modify: `backend/src/services/payments/stripe.provider.ts`
- Create: `backend/src/services/payments/stripe.provider.quarterly.test.ts`

**Interfaces:**
- Produces: `CreateCheckoutParams.billingCycle: 'monthly' | 'quarterly' | 'yearly'` — Task 8 and Task 9 (frontend) both depend on this widened type.

- [ ] **Step 1: Widen the type**

In `backend/src/services/payments/types.ts`, find:
```typescript
  billingCycle: 'monthly' | 'yearly';
```
Replace with:
```typescript
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
```

- [ ] **Step 2: Extract and use a testable interval-mapping function**

In `backend/src/services/payments/stripe.provider.ts`, add this function above the `StripeProvider` class:

```typescript
// Stripe's `recurring.interval` has no native "quarter" value - quarterly
// billing is expressed as 3 one-month intervals. Exported for testing.
export function resolveStripeInterval(billingCycle: 'monthly' | 'quarterly' | 'yearly'): { interval: 'month' | 'year'; interval_count: number } {
  if (billingCycle === 'yearly') return { interval: 'year', interval_count: 1 };
  if (billingCycle === 'quarterly') return { interval: 'month', interval_count: 3 };
  return { interval: 'month', interval_count: 1 };
}
```

Find:
```typescript
            recurring: { interval: params.billingCycle === 'yearly' ? 'year' : 'month' },
```
Replace with:
```typescript
            recurring: resolveStripeInterval(params.billingCycle),
```

- [ ] **Step 3: Write the test**

```typescript
// backend/src/services/payments/stripe.provider.quarterly.test.ts
import { describe, it, expect } from 'vitest';
import { resolveStripeInterval } from './stripe.provider';

describe('resolveStripeInterval', () => {
  it('maps monthly to a 1-month interval', () => {
    expect(resolveStripeInterval('monthly')).toEqual({ interval: 'month', interval_count: 1 });
  });

  it('maps quarterly to a 3-month interval', () => {
    expect(resolveStripeInterval('quarterly')).toEqual({ interval: 'month', interval_count: 3 });
  });

  it('maps yearly to a 1-year interval', () => {
    expect(resolveStripeInterval('yearly')).toEqual({ interval: 'year', interval_count: 1 });
  });
});
```

- [ ] **Step 4: Run the tests**

```bash
cd backend
npx vitest run src/services/payments/stripe.provider.quarterly.test.ts
```
Expected: 3 tests passing.

- [ ] **Step 5: Type-check**

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit 2>&1 | grep -E "payments/types|stripe.provider"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/payments/types.ts backend/src/services/payments/stripe.provider.ts backend/src/services/payments/stripe.provider.quarterly.test.ts
git commit -m "feat: support quarterly billing cycle in payment provider types and Stripe checkout"
```

---

### Task 8: Checkout controller — three-way billing cycle resolution

**Files:**
- Modify: `backend/src/controllers/subscriptionCheckout.controller.ts`

**Interfaces:**
- Consumes: `CreateCheckoutParams.billingCycle` widened type (Task 7).

- [ ] **Step 1: Update the cycle/price resolution**

Find:
```typescript
    const { planId, provider, billingCycle } = req.body as {
      planId: string;
      provider: ProviderName;
      billingCycle: 'monthly' | 'yearly';
    };
```
Replace with:
```typescript
    const { planId, provider, billingCycle } = req.body as {
      planId: string;
      provider: ProviderName;
      billingCycle: 'monthly' | 'quarterly' | 'yearly';
    };
```

Find:
```typescript
    const cycle = billingCycle === 'yearly' ? 'yearly' : 'monthly';
    const amount = cycle === 'yearly' ? Number(plan.priceYearly) : Number(plan.priceMonthly);
```
Replace with:
```typescript
    const cycle: 'monthly' | 'quarterly' | 'yearly' =
      billingCycle === 'yearly' ? 'yearly' : billingCycle === 'quarterly' ? 'quarterly' : 'monthly';
    const amount = cycle === 'yearly' ? Number(plan.priceYearly) : cycle === 'quarterly' ? Number(plan.priceQuarterly) : Number(plan.priceMonthly);
```

- [ ] **Step 2: Type-check**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit 2>&1 | grep subscriptionCheckout.controller
```
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add backend/src/controllers/subscriptionCheckout.controller.ts
git commit -m "feat: resolve quarterly billing cycle and price in checkout controller"
```

---

### Task 9: Frontend API client — extend types and add the switch-to-free method

**Files:**
- Modify: `frontend/src/api/client.ts`

**Interfaces:**
- Produces: `api.switchToFreePlan(planId: string)`, widened `createSubscriptionCheckout` and plan CRUD payload types.

- [ ] **Step 1: Widen `createSubscriptionCheckout`'s billing cycle**

Find:
```typescript
  async createSubscriptionCheckout(payload: { planId: string; provider: 'stripe' | 'paystack'; billingCycle: 'monthly' | 'yearly' }) {
```
Replace with:
```typescript
  async createSubscriptionCheckout(payload: { planId: string; provider: 'stripe' | 'paystack'; billingCycle: 'monthly' | 'quarterly' | 'yearly' }) {
```

- [ ] **Step 2: Add the switch-to-free method**

Directly below the `createSubscriptionCheckout` method, add:

```typescript
  async switchToFreePlan(planId: string) {
    const { data } = await this.client.post(`/tenant/subscription/switch/${planId}`);
    return data as { success: boolean; planId: string; planName: string };
  }
```

- [ ] **Step 3: Extend the plan CRUD payload types**

Find `createSubscriptionPlan`'s payload type:
```typescript
  async createSubscriptionPlan(payload: {
    name: string;
    code: string;
    description?: string;
    priceMonthly?: number;
    priceYearly?: number;
    currency?: string;
    maxLocations?: number | null;
    maxServicesPerLoc?: number | null;
    maxUsersPerOrg?: number | null;
    maxQueueEntriesPerDay?: number | null;
    features?: Record<string, boolean>;
    displayOrder?: number;
    isDefault?: boolean;
  }) {
```
Replace with:
```typescript
  async createSubscriptionPlan(payload: {
    name: string;
    code: string;
    description?: string;
    priceMonthly?: number;
    priceQuarterly?: number;
    priceYearly?: number;
    currency?: string;
    maxLocations?: number | null;
    maxServicesPerLoc?: number | null;
    maxUsersPerOrg?: number | null;
    maxQueueEntriesPerDay?: number | null;
    features?: Record<string, boolean>;
    displayOrder?: number;
    tierRank?: number;
    isDefault?: boolean;
    isRecommended?: boolean;
    trialDurationDays?: number | null;
    expiredFallbackPlanId?: string | null;
    upgradePlanId?: string | null;
  }) {
```

Find `updateSubscriptionPlan`'s payload type and apply the identical set of additions (everything `createSubscriptionPlan` gained above, minus `code` since it stays immutable on update per the existing pattern):
```typescript
  async updateSubscriptionPlan(id: string, payload: {
    name?: string;
    description?: string;
    priceMonthly?: number;
    priceYearly?: number;
    currency?: string;
    maxLocations?: number | null;
    maxServicesPerLoc?: number | null;
    maxUsersPerOrg?: number | null;
    maxQueueEntriesPerDay?: number | null;
    features?: Record<string, boolean>;
    displayOrder?: number;
    isActive?: boolean;
    isDefault?: boolean;
  }) {
```
Replace with:
```typescript
  async updateSubscriptionPlan(id: string, payload: {
    name?: string;
    description?: string;
    priceMonthly?: number;
    priceQuarterly?: number;
    priceYearly?: number;
    currency?: string;
    maxLocations?: number | null;
    maxServicesPerLoc?: number | null;
    maxUsersPerOrg?: number | null;
    maxQueueEntriesPerDay?: number | null;
    features?: Record<string, boolean>;
    displayOrder?: number;
    tierRank?: number;
    isActive?: boolean;
    isDefault?: boolean;
    isRecommended?: boolean;
    trialDurationDays?: number | null;
    expiredFallbackPlanId?: string | null;
    upgradePlanId?: string | null;
  }) {
```

- [ ] **Step 4: Type-check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "api/client"
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: extend frontend API client for quarterly billing and plan trial/fallback/upgrade fields"
```

---

### Task 10: Superadmin plans page — new fields

**Files:**
- Modify: `frontend/src/app/superadmin/plans/page.tsx`

**Interfaces:**
- Consumes: `api.createSubscriptionPlan`/`updateSubscriptionPlan`'s widened payload types (Task 9).

- [ ] **Step 1: Extend the `SubscriptionPlan` interface and form state**

Find:
```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  maxLocations: number | null;
  maxServicesPerLoc: number | null;
  maxUsersPerOrg: number | null;
  maxQueueEntriesPerDay: number | null;
  features: Record<string, boolean>;
  displayOrder: number;
  isActive: boolean;
  isDefault: boolean;
  _count: {
    subscriptions: number;
  };
}
```
Replace with:
```typescript
interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceQuarterly: string;
  priceYearly: string;
  currency: string;
  maxLocations: number | null;
  maxServicesPerLoc: number | null;
  maxUsersPerOrg: number | null;
  maxQueueEntriesPerDay: number | null;
  features: Record<string, boolean>;
  displayOrder: number;
  tierRank: number;
  isActive: boolean;
  isDefault: boolean;
  isRecommended: boolean;
  trialDurationDays: number | null;
  expiredFallbackPlanId: string | null;
  upgradePlanId: string | null;
  _count: {
    subscriptions: number;
  };
}
```

Find the `form` state:
```typescript
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    maxLocations: null as number | null,
    maxServicesPerLoc: null as number | null,
    maxUsersPerOrg: null as number | null,
    maxQueueEntriesPerDay: null as number | null,
    features: {} as Record<string, boolean>,
    displayOrder: 0,
    isActive: true,
    isDefault: false,
  });
```
Replace with:
```typescript
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    priceMonthly: 0,
    priceQuarterly: 0,
    priceYearly: 0,
    currency: 'USD',
    maxLocations: null as number | null,
    maxServicesPerLoc: null as number | null,
    maxUsersPerOrg: null as number | null,
    maxQueueEntriesPerDay: null as number | null,
    features: {} as Record<string, boolean>,
    displayOrder: 0,
    tierRank: 0,
    isActive: true,
    isDefault: false,
    isRecommended: false,
    trialDurationDays: null as number | null,
    expiredFallbackPlanId: null as string | null,
    upgradePlanId: null as string | null,
  });
```

- [ ] **Step 2: Update `openCreateModal` and `openEditModal`**

Find `openCreateModal`'s `setForm({...})` call and add the new fields with their defaults (`priceQuarterly: 0, tierRank: plans.length, isRecommended: false, trialDurationDays: null, expiredFallbackPlanId: null, upgradePlanId: null`), matching the same object-literal style already used for the other fields there.

Find `openEditModal`'s `setForm({...})` call and add:
```typescript
      priceQuarterly: parseFloat(plan.priceQuarterly),
      tierRank: plan.tierRank,
      isRecommended: plan.isRecommended,
      trialDurationDays: plan.trialDurationDays,
      expiredFallbackPlanId: plan.expiredFallbackPlanId,
      upgradePlanId: plan.upgradePlanId,
```
alongside its existing fields.

- [ ] **Step 3: Update `handleSave`**

In both the `editingPlan` (`updateSubscriptionPlan`) and create (`createSubscriptionPlan`) branches of `handleSave`, add the same six fields to the payload object literal:
```typescript
          priceQuarterly: form.priceQuarterly,
          tierRank: form.tierRank,
          isRecommended: form.isRecommended,
          trialDurationDays: form.trialDurationDays,
          expiredFallbackPlanId: form.expiredFallbackPlanId,
          upgradePlanId: form.upgradePlanId,
```

- [ ] **Step 4: Add a Quarterly price display to each plan card**

Find:
```tsx
                <div style={priceRow}>
                  <span style={priceLabel}>Yearly</span>
                  <span style={priceValue}>${plan.priceYearly}</span>
                </div>
```
Add directly above it:
```tsx
                <div style={priceRow}>
                  <span style={priceLabel}>Quarterly</span>
                  <span style={priceValue}>${plan.priceQuarterly}</span>
                </div>
```

Also add a Recommended badge alongside the existing Default one. Find:
```tsx
                  {plan.isDefault && <span style={defaultBadge}>Default</span>}
                  {!plan.isActive && <span style={inactiveBadge}>Inactive</span>}
```
Replace with:
```tsx
                  {plan.isDefault && <span style={defaultBadge}>Default</span>}
                  {plan.isRecommended && <span style={defaultBadge}>Recommended</span>}
                  {!plan.isActive && <span style={inactiveBadge}>Inactive</span>}
```

- [ ] **Step 5: Add the new form inputs to the modal**

Find the Monthly/Yearly price `formRow` block:
```tsx
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Monthly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Yearly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceYearly}
                    onChange={(e) => setForm({ ...form, priceYearly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
```
Replace with:
```tsx
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Monthly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Quarterly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceQuarterly}
                    onChange={(e) => setForm({ ...form, priceQuarterly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Yearly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceYearly}
                    onChange={(e) => setForm({ ...form, priceYearly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Trial Duration (days, blank = no limit)</label>
                  <input
                    type="number"
                    value={form.trialDurationDays ?? ''}
                    onChange={(e) => setForm({ ...form, trialDurationDays: e.target.value ? parseInt(e.target.value) : null })}
                    style={formInput}
                    min="1"
                    placeholder="No time limit"
                  />
                </div>
              </div>
```

Find the Display Order / Active / Default row:
```tsx
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                  />
                </div>
                <div style={{ ...formGroup, display: 'flex', alignItems: 'center', gap: '1.5rem', paddingTop: '1.5rem' }}>
                  <label style={featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <span>Active</span>
                  </label>
                  <label style={featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    />
                    <span>Default for new orgs</span>
                  </label>
                </div>
              </div>
```
Replace with:
```tsx
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Tier Rank (for upgrade/recommended comparisons)</label>
                  <input
                    type="number"
                    value={form.tierRank}
                    onChange={(e) => setForm({ ...form, tierRank: parseInt(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                  />
                </div>
              </div>
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Falls back to (when this plan's trial expires)</label>
                  <select
                    value={form.expiredFallbackPlanId ?? ''}
                    onChange={(e) => setForm({ ...form, expiredFallbackPlanId: e.target.value || null })}
                    style={formInput}
                  >
                    <option value="">Lock down (no fallback)</option>
                    {plans.filter(p => p.id !== editingPlan?.id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Upgrade target</label>
                  <select
                    value={form.upgradePlanId ?? ''}
                    onChange={(e) => setForm({ ...form, upgradePlanId: e.target.value || null })}
                    style={formInput}
                  >
                    <option value="">No upgrade suggested</option>
                    {plans.filter(p => p.id !== editingPlan?.id).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ ...formGroup, display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <label style={featureCheckbox}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span>Active</span>
                </label>
                <label style={featureCheckbox}>
                  <input
                    type="checkbox"
                    checked={form.isDefault}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                  />
                  <span>Default for new orgs</span>
                </label>
                <label style={featureCheckbox}>
                  <input
                    type="checkbox"
                    checked={form.isRecommended}
                    onChange={(e) => setForm({ ...form, isRecommended: e.target.checked })}
                  />
                  <span>Recommended</span>
                </label>
              </div>
```

- [ ] **Step 5: Type-check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "superadmin/plans"
```
Expected: no output.

- [ ] **Step 6: Manual verification**

```
Navigate to /superadmin/plans. Confirm the Free and Starter plans show correctly (Quarterly price row, Recommended badge on Starter). Edit Starter: confirm the "Falls back to" dropdown shows Free pre-selected, "Upgrade target" is empty, Trial Duration shows 14. Save, reload, confirm it persisted.
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/app/superadmin/plans/page.tsx
git commit -m "feat: add quarterly price, trial/fallback/upgrade/tier fields to superadmin plans page"
```

---

### Task 11: Tenant Billing page redesign

**Files:**
- Modify: `frontend/src/app/admin/billing/page.tsx`

**Interfaces:**
- Consumes: `api.getMySubscription()`'s extended response (`upgradePlan`, `isExpiredNoFallback` — Task 3), `api.switchToFreePlan` (Task 9), widened `Plan`/`SubscriptionData` shapes.

- [ ] **Step 1: Extend the local types**

Find:
```typescript
interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  features: Record<string, boolean>;
  isDefault: boolean;
}

interface SubscriptionData {
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  } | null;
  activeProviders: ('stripe' | 'paystack')[];
}
```
Replace with:
```typescript
interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceQuarterly: string;
  priceYearly: string;
  currency: string;
  maxLocations: number | null;
  maxServicesPerLoc: number | null;
  maxUsersPerOrg: number | null;
  maxQueueEntriesPerDay: number | null;
  features: Record<string, boolean>;
  tierRank: number;
  isDefault: boolean;
  isRecommended: boolean;
}

interface SubscriptionData {
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  } | null;
  activeProviders: ('stripe' | 'paystack')[];
  upgradePlan: { id: string; name: string } | null;
  isExpiredNoFallback: boolean;
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const FEATURE_LABELS: Record<string, string> = {
  multiLocation: 'Multiple locations',
  smsNotifications: 'SMS notifications',
  analytics: 'Analytics dashboard',
  apiAccess: 'API access',
  customBranding: 'Custom branding',
  serviceFlows: 'Service flows',
  servicePoints: 'Service points',
};

function priceForCycle(plan: Plan, cycle: BillingCycle): number {
  if (cycle === 'quarterly') return Number(plan.priceQuarterly);
  if (cycle === 'yearly') return Number(plan.priceYearly);
  return Number(plan.priceMonthly);
}

function savingsPercent(plan: Plan, cycle: BillingCycle): number | null {
  const monthly = Number(plan.priceMonthly);
  if (monthly === 0 || cycle === 'monthly') return null;
  const cyclePrice = priceForCycle(plan, cycle);
  const equivalentMonthlyTotal = monthly * CYCLE_MONTHS[cycle];
  if (equivalentMonthlyTotal === 0) return null;
  const pct = Math.round((1 - cyclePrice / equivalentMonthlyTotal) * 100);
  return pct > 0 ? pct : null;
}
```

- [ ] **Step 2: Replace the cycle toggle and default state**

Find:
```typescript
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
```
Replace with:
```typescript
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
```

Find:
```tsx
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setBillingCycle('monthly')}
            className="btn btn-sm"
            style={{ background: billingCycle === 'monthly' ? '#14b8a6' : '#f3f4f6', color: billingCycle === 'monthly' ? 'white' : '#374151' }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className="btn btn-sm"
            style={{ background: billingCycle === 'yearly' ? '#14b8a6' : '#f3f4f6', color: billingCycle === 'yearly' ? 'white' : '#374151' }}
          >
            Yearly
          </button>
        </div>
```
Replace with:
```tsx
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => {
            const bestSavings = plans.length > 0
              ? Math.max(...plans.map(p => savingsPercent(p, cycle) ?? 0))
              : 0;
            return (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className="btn btn-sm"
                style={{ background: billingCycle === cycle ? '#14b8a6' : '#f3f4f6', color: billingCycle === cycle ? 'white' : '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                {cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? 'Quarterly' : 'Yearly'}
                {bestSavings > 0 && (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: billingCycle === cycle ? 'rgba(255,255,255,0.25)' : '#dcfce7', color: billingCycle === cycle ? 'white' : '#16a34a', padding: '0.0625rem 0.375rem', borderRadius: '999px' }}>
                    Save {bestSavings}%
                  </span>
                )}
              </button>
            );
          })}
        </div>
```

- [ ] **Step 3: Add the expired-no-fallback banner and upgrade callout**

Find:
```tsx
        {activeProviders.length === 0 && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
            No payment providers are configured yet. Please check back later.
          </Card>
        )}
```
Replace with:
```tsx
        {data?.isExpiredNoFallback && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}>
            Your trial has ended. Choose a plan below to restore full access — your existing data is safe and untouched.
          </Card>
        )}

        {activeProviders.length === 0 && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
            No payment providers are configured yet. Please check back later.
          </Card>
        )}

        {data?.upgradePlan && data.upgradePlan.id !== currentPlanId && (
          <Card style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#0f766e', fontSize: '0.875rem' }}>
              Need more room to grow? <strong>Upgrade to {data.upgradePlan.name}</strong> for higher limits and more features.
            </span>
            <Button variant="primary" size="sm" onClick={() => handleChoosePlan(data.upgradePlan!.id)}>Upgrade to {data.upgradePlan.name}</Button>
          </Card>
        )}
```

(This references `currentPlanId`, which doesn't exist yet as a variable — it's introduced in Step 4 below, replacing the existing inline `currentPlanCode` computation.)

- [ ] **Step 4: Rewrite the card grid**

Find:
```typescript
  const currentPlanCode = data?.subscription?.planCode;
  const activeProviders = data?.activeProviders || [];
```
Replace with:
```typescript
  const currentPlanCode = data?.subscription?.planCode;
  const currentPlanId = data?.subscription?.planId;
  const currentPlanTierRank = plans.find(p => p.code === currentPlanCode)?.tierRank ?? -1;
  const activeProviders = data?.activeProviders || [];
```

Find the whole card-grid block:
```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {plans.map(plan => {
            const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
            const isCurrent = plan.code === currentPlanCode;
            return (
              <Card key={plan.id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{plan.name}</h3>
                  {isCurrent && <Badge tone="primary">Current</Badge>}
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>{plan.description}</p>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>
                  {plan.currency} {price}
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#6b7280' }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
                {checkoutPlanId === plan.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeProviders.includes('stripe') && (
                      <Button variant="primary" size="sm" onClick={() => handleCheckout('stripe')}>Pay with Stripe</Button>
                    )}
                    {activeProviders.includes('paystack') && (
                      <Button variant="primary" size="sm" onClick={() => handleCheckout('paystack')}>Pay with Paystack</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setCheckoutPlanId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isCurrent || activeProviders.length === 0}
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    {isCurrent ? <><Icon icon={CheckCircle2} size={14} /> Current Plan</> : 'Subscribe'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
```
Replace with:
```tsx
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {plans.map(plan => {
            const price = priceForCycle(plan, billingCycle);
            const isFree = Number(plan.priceMonthly) === 0 && Number(plan.priceQuarterly) === 0 && Number(plan.priceYearly) === 0;
            const isCurrent = plan.code === currentPlanCode;
            const showRecommended = plan.isRecommended && currentPlanTierRank < plan.tierRank;
            const savings = savingsPercent(plan, billingCycle);
            const cycleSuffix = billingCycle === 'yearly' ? '/yr' : billingCycle === 'quarterly' ? '/qtr' : '/mo';

            const limitRows: { label: string; value: number | null }[] = [
              { label: 'Locations', value: plan.maxLocations },
              { label: 'Services/loc', value: plan.maxServicesPerLoc },
              { label: 'Users', value: plan.maxUsersPerOrg },
              { label: 'Entries/day', value: plan.maxQueueEntriesPerDay },
            ];
            const featureBullets = Object.entries(plan.features)
              .filter(([, enabled]) => enabled)
              .map(([key]) => FEATURE_LABELS[key] || key)
              .slice(0, 3);

            return (
              <Card
                key={plan.id}
                style={{
                  padding: '1rem',
                  border: showRecommended ? '2px solid #14b8a6' : undefined,
                  position: 'relative',
                }}
              >
                {showRecommended && (
                  <div style={{ position: 'absolute', top: '-0.625rem', left: '1rem' }}>
                    <Badge tone="primary">Recommended</Badge>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{plan.name}</h3>
                  {isCurrent && <Badge tone="primary">Current</Badge>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.375rem', fontWeight: 700 }}>
                    {isFree ? 'Free' : `${plan.currency} ${price}`}
                  </span>
                  {!isFree && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{cycleSuffix}</span>}
                  {savings && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '0.0625rem 0.375rem', borderRadius: '999px' }}>
                      Save {savings}%
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                  {limitRows.filter(r => r.value !== null).map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                      <span>{r.label}</span>
                      <strong style={{ color: '#111827' }}>{r.value}</strong>
                    </div>
                  ))}
                </div>

                {featureBullets.length > 0 && (
                  <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1rem', fontSize: '0.75rem', color: '#4b5563' }}>
                    {featureBullets.map(f => <li key={f}>{f}</li>)}
                  </ul>
                )}

                {checkoutPlanId === plan.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeProviders.includes('stripe') && (
                      <Button variant="primary" size="sm" onClick={() => handleCheckout('stripe')}>Pay with Stripe</Button>
                    )}
                    {activeProviders.includes('paystack') && (
                      <Button variant="primary" size="sm" onClick={() => handleCheckout('paystack')}>Pay with Paystack</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setCheckoutPlanId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isCurrent}
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    {isCurrent ? <><Icon icon={CheckCircle2} size={14} /> Current Plan</> : isFree ? 'Switch to Free' : 'Subscribe'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
```

(The Subscribe button's `disabled` no longer includes `activeProviders.length === 0` — a free plan must remain selectable even when no payment provider is configured, since it doesn't need one. `handleChoosePlan`, updated in the next step, branches on whether the target plan is free before ever touching `activeProviders`.)

- [ ] **Step 5: Branch `handleChoosePlan` on free vs. paid**

Find:
```typescript
  const handleChoosePlan = (planId: string) => {
    setCheckoutPlanId(planId);
  };
```
Replace with:
```typescript
  const handleChoosePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    const isFree = plan && Number(plan.priceMonthly) === 0 && Number(plan.priceQuarterly) === 0 && Number(plan.priceYearly) === 0;
    if (isFree) {
      try {
        await api.switchToFreePlan(planId);
        await load();
      } catch (err) {
        console.error('Failed to switch plan', err);
        alert('Could not switch plans. Please try again.');
      }
      return;
    }
    setCheckoutPlanId(planId);
  };
```

- [ ] **Step 6: Type-check**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "admin/billing"
```
Expected: no output.

- [ ] **Step 7: Manual verification**

```
Navigate to /admin/billing on an org that's on the Free plan (fresh signup, or one migrated by Task 1's backfill).
Expected: Free plan shows "Current Plan"; Starter shows a "Recommended" badge and an "Upgrade to Starter" callout above the grid (if getMySubscription returns upgradePlan); toggling Monthly/Quarterly/Yearly changes prices and shows "Save N%" on the toggle and on Starter's card once it has different quarterly/yearly prices set (edit them in via /superadmin/plans if the seed left them at 0).
Then: on an org currently subscribed to a paid plan, click "Switch to Free" on the Free card - confirm it switches immediately with no checkout redirect, and the page reloads showing Free as Current.
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/admin/billing/page.tsx
git commit -m "feat: redesign billing page with quarterly cycle, savings badges, compact cards, and free-plan switch"
```

---

### Task 12: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Full backend test suite**

```bash
cd backend
MASTER_ENCRYPTION_KEY="dev-only-master-encryption-key-change-in-production" DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx vitest run
```
Expected: all tests passing, including the 5 new expiry-resolution tests and the 3 new Stripe-interval tests.

- [ ] **Step 2: Full type-check both sides**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/qms_db" npx tsc --noEmit
cd ../frontend && npx tsc --noEmit
```
Expected: backend clean (aside from any pre-existing unrelated errors already present before this plan started — check by comparing against the count noted in the most recent prior work on this repo); frontend clean aside from the same pre-existing set.

- [ ] **Step 3: Browser walkthrough**

```
1. /superadmin/plans — confirm Free and Starter both render with all new fields, edit Starter's quarterly/yearly prices to non-zero values that produce a visible discount vs. 12x/4x the monthly price, save.
2. Register a brand-new organization through the public signup flow. Log in as its admin, go to /admin/billing - confirm it shows Free as Current, with an "Upgrade to Starter" callout.
3. On that same org, click through to Starter's checkout (requires an active payment provider - if none is configured, confirm the button still opens the Stripe/Paystack choice UI without crashing, matching pre-existing behavior for that state).
4. Click "Switch to Free" from a paid-plan state (use an org that already has a paid subscription from earlier testing, if one exists) - confirm the immediate switch with no payment step, and /admin/billing reflects it after reload.
5. Toggle Monthly/Quarterly/Yearly on /admin/billing - confirm the "Save N%" badges appear on the toggle and per-card, and disappear correctly on Monthly.
6. Manually set an org's OrganizationSubscription to status TRIAL with a trialEndsAt in the past (via docker exec + Prisma), reload /admin/billing or hit GET /api/v1/subscription - confirm it either falls back to Free (if the plan has expiredFallbackPlanId set) or shows the "trial has ended" banner with isExpiredNoFallback true (test both by toggling expiredFallbackPlanId on the test org's plan between checks).
```

- [ ] **Step 4: Report completion**

No code changes in this task — if all checks above pass, the feature is complete and ready to hand off via the finishing-a-development-branch skill.
