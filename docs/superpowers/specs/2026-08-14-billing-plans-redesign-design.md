# Billing Page + Subscription Plan Redesign — Design

## Problem Statement

The tenant Billing page (`frontend/src/app/admin/billing/page.tsx`) currently only lists real `SubscriptionPlan` rows fetched from the database, with a monthly/yearly toggle and large plan cards showing just a price. Two structural gaps sit behind this:

1. **There is no real "Free" plan.** Every org that has never subscribed (`Organization.subscriptionId` is null) silently falls back to a hardcoded `DEFAULT_FEATURES` object in `subscription.middleware.ts` (1 location, 3 services, 5 users). This can't be listed on the billing page, can't be edited by a superadmin, and drifts independently of the real plan system.
2. **The one seeded paid plan ("Starter", $10/mo) has empty `features` and null limit columns.** Because `subscription.middleware.ts` falls back to `DEFAULT_FEATURES` whenever a plan's own values are unset, subscribing to Starter today grants *identical* limits to having no subscription at all — a data gap, not a code bug, but one that becomes visible the moment real limits are shown on cards.

This redesign turns "no subscription" into a real, editable Free plan; adds a quarterly billing cycle; makes plan cards smaller and information-dense; and — following clarifying discussion — adds trial-duration and upgrade-path metadata to plans so the product can run time-limited trials that fall back to Free (or lock down) and can consistently prompt "upgrade to X."

## Goals

- A real `SubscriptionPlan` row represents the free tier; new orgs and reads of "no subscription" both resolve to it.
- Monthly / Quarterly / Yearly billing cycle, each priced independently by the superadmin, with auto-computed savings shown per cycle.
- Smaller plan cards showing actual limits (locations/services/users/queue-entries) and a short feature list, not just a price.
- A plan can have a trial duration (days) and a configured fallback plan for when that trial expires (or no fallback → access is locked down to the billing page only).
- A plan can name which plan is "the upgrade" from it, so the UI can consistently prompt "Upgrade to {name}" instead of just listing every pricier plan.
- One plan can be marked "Recommended," hidden automatically once the org is already on that plan or higher.

## Non-Goals

- No proration, refunds, or mid-cycle billing adjustments when an org switches plans (matches this app's existing dev-stage simplicity — a plan switch just updates the `OrganizationSubscription` row).
- No background job/cron for trial expiry — checked lazily on read, inside the existing `loadSubscription` middleware path.
- No changes to the existing Stripe/Paystack webhook handling beyond what quarterly billing requires.
- Not fixing the "Starter" plan's actual limit numbers as a business decision — a *default* fix is included (see Data Model → Seed Data) since the spec author had to pick something to demonstrate correct behavior, but the specific numbers are not load-bearing to this spec and can be edited freely afterward via the superadmin plans page.

## Data Model

```prisma
model SubscriptionPlan {
  // ...existing fields (id, name, code, description, priceMonthly, priceYearly,
  // currency, maxLocations, maxServicesPerLoc, maxUsersPerOrg,
  // maxQueueEntriesPerDay, features, displayOrder, isActive, isDefault,
  // createdAt, updatedAt, subscriptions relation)... unchanged.

  priceQuarterly         Decimal  @default(0)
  trialDurationDays      Int?     // null = no time limit (plan never expires on its own)
  tierRank               Int      @default(0) // separate from displayOrder; used for upgrade/recommended comparisons only
  isRecommended          Boolean  @default(false) // "Recommended" badge; only one plan true at a time

  expiredFallbackPlanId  String?
  expiredFallbackPlan    SubscriptionPlan? @relation("PlanFallback", fields: [expiredFallbackPlanId], references: [id], onDelete: SetNull)
  fallbackForPlans       SubscriptionPlan[] @relation("PlanFallback")

  upgradePlanId          String?
  upgradePlan            SubscriptionPlan? @relation("PlanUpgrade", fields: [upgradePlanId], references: [id], onDelete: SetNull)
  upgradeForPlans        SubscriptionPlan[] @relation("PlanUpgrade")
}
```

`displayOrder` continues to control card ordering only; `tierRank` is the number used whenever the code needs to compare "is this org's plan at least as good as that plan" (the Recommended-badge visibility check, and future upgrade-path logic). They will usually move together but are independently settable.

### Seed Data

- **Free**: `code: "free"`, `priceMonthly/Quarterly/Yearly: 0`, `tierRank: 0`, `displayOrder: 0`, `isDefault: true`, `trialDurationDays: null`, limits matching today's `DEFAULT_FEATURES` (`maxLocations: 1`, `maxServicesPerLoc: 3`, `maxUsersPerOrg: 5`, `maxQueueEntriesPerDay: null`), `features: { multiLocation: false, smsNotifications: false, analytics: false, apiAccess: false, customBranding: false, serviceFlows: false, servicePoints: true }`.
- **Starter** (existing row, updated in place): `tierRank: 1`, `displayOrder: 1`, `trialDurationDays: 14`, `expiredFallbackPlanId` → Free's id, `isRecommended: true`, `upgradePlanId: null` (nothing above it yet), limits set to something visibly better than Free — `maxLocations: 3`, `maxServicesPerLoc: 10`, `maxUsersPerOrg: 15`, `features: { ...Free's, analytics: true, smsNotifications: true }`. These numbers are a starting point, freely editable afterward.
- Free's `upgradePlanId` is set to Starter's id, so a Free-tier org sees "Upgrade to Starter."

### Expiry Enforcement

Added to `subscription.middleware.ts`'s `loadSubscription` (and mirrored in `getMySubscription`, `checkLimit`, `getOrganizationFeatures` — the same four call sites the earlier service-wizard work already had to fix once for a different reason, so this spec explicitly re-touches all four rather than assuming only one):

```
if (subscription.status === 'TRIAL' && subscription.trialEndsAt && subscription.trialEndsAt < now) {
  if (subscription.plan.expiredFallbackPlanId) {
    // Move the org onto the fallback plan, reset the billing period, clear trialEndsAt.
    // Status becomes ACTIVE if the fallback plan itself has no trialDurationDays, else TRIAL again with a new trialEndsAt.
  } else {
    // Mark status EXPIRED. Do not change planId.
  }
}
```

This is a write performed lazily during a read path — acceptable because it's idempotent (running it twice when already resolved is a no-op) and keeps every existing call site correct without a scheduler.

### "Disable Access" for EXPIRED-with-no-fallback

No new blocking middleware. `getOrganizationFeatures`/`loadSubscription` resolve an EXPIRED-with-no-fallback subscription to all-`false` features and `0` for every numeric limit. The *existing* `requireFeature`/`enforceLimit` middleware (unchanged) then naturally blocks creating new locations/services/users and any feature-gated action — exactly the mechanism already used for over-limit orgs today. Existing data remains fully readable; only creation and feature-gated actions are blocked. The Billing page itself performs no `requireFeature`/`enforceLimit` check, so it stays reachable.

### Signup

`registerOrganization` (`backend/src/controllers/organization.controller.ts`), after creating the `Organization`, looks up `SubscriptionPlan.findFirst({ where: { isDefault: true, isActive: true } })` and creates an `OrganizationSubscription`:
- `status`: `'TRIAL'` if the default plan has a `trialDurationDays`, else `'ACTIVE'`.
- `trialEndsAt`: `now + trialDurationDays` days, or `null`.
- `currentPeriodStart`: now. `currentPeriodEnd`: `trialEndsAt` if trialing; otherwise `now + 1 year` as a placeholder period end for a plan with no real billing cycle driving it (the Free plan never actually renews via checkout, so this value is cosmetic — nothing reads it to gate access for a non-trialing subscription).

### One-Time Backfill

A migration script (not a live endpoint) sets `Organization.subscriptionId` for every organization currently null, creating an `OrganizationSubscription` onto the Free plan for each (status `ACTIVE`, no trial). Existing orgs are not retroactively trial-limited.

## API Changes

**Superadmin plan CRUD** (`createPlan`/`updatePlan` in `superadmin.controller.ts`): accept `priceQuarterly`, `trialDurationDays`, `tierRank`, `isRecommended`, `expiredFallbackPlanId`, `upgradePlanId`. `isRecommended: true` unsets any other plan's `isRecommended` first, mirroring the existing `isDefault` handling already in these two functions.

**New tenant endpoint**: `POST /tenant/subscription/switch/:planId` — restricted to plans where `priceMonthly === 0 && priceQuarterly === 0 && priceYearly === 0` (400 otherwise, so this can never be used to grant a paid plan without payment). Updates the org's `OrganizationSubscription.planId` to the target, resets `currentPeriodStart`/`currentPeriodEnd`, clears `trialEndsAt`, sets `status: 'ACTIVE'`.

**`getMySubscription`** response gains:
- `upgradePlan: { id: string, name: string } | null` — resolved from the current plan's `upgradePlanId`.
- `isExpiredNoFallback: boolean` — true when `status === 'EXPIRED'`.

**`GET /plans`** (tenant-facing, already exists) and **`GET /superadmin/plans`**: both continue to return full plan rows; the six new fields ride along automatically since they're returned via the existing `prisma.subscriptionPlan.findMany`.

**Checkout — quarterly on Stripe** (`backend/src/services/payments/stripe.provider.ts`): Stripe's `recurring.interval` enum has no native `quarter` value. Quarterly billing uses `interval: 'month', interval_count: 3`. `CreateCheckoutParams.billingCycle`'s type (`backend/src/services/payments/types.ts`) becomes `'monthly' | 'quarterly' | 'yearly'`; `stripe.provider.ts`'s interval mapping becomes:
```ts
const { interval, interval_count } = params.billingCycle === 'yearly'
  ? { interval: 'year' as const, interval_count: 1 }
  : params.billingCycle === 'quarterly'
    ? { interval: 'month' as const, interval_count: 3 }
    : { interval: 'month' as const, interval_count: 1 };
```

**Checkout — quarterly on Paystack**: no change needed beyond the type widening — Paystack's provider doesn't set up a native recurring-interval object today (it stashes `billingCycle` in metadata for a one-off charge init, a pre-existing limitation out of scope here), so a third string value flows through unchanged.

**`subscriptionCheckout.controller.ts`**: `cycle` resolution (`billingCycle === 'yearly' ? 'yearly' : 'monthly'`) becomes a three-way match, and looks up `plan.priceQuarterly` alongside the existing monthly/yearly price lookups.

## Frontend

**Tenant Billing page** (`frontend/src/app/admin/billing/page.tsx`):
- 3-way cycle toggle: Monthly / Quarterly / Yearly, defaulting to Monthly on page load (matches the existing default).
- Savings badge per non-monthly cycle, computed client-side: `1 − (cyclePrice / (monthlyPrice × monthsInCycle))`, shown as "Save N%" next to the toggle option and again on each card when that cycle is selected (skipped if the plan's monthly price is 0, since percentage-off a free price is meaningless).
- Cards shrink: drop the current oversized price block in favor of a tighter header (name + price inline), add a compact limits list (only the non-null ones among locations/services/users/queue-entries-per-day) and up to 3 feature bullets pulled from `features` where the value is `true`.
- The plan matching `isRecommended` gets a highlighted border/badge — hidden when the org's current plan's `tierRank >= ` the recommended plan's `tierRank`.
- When `upgradePlan` is present and the org isn't on it or higher, an "Upgrade to {name}" callout appears above the grid, linking to that plan's card (scroll/highlight, not a separate page).
- When `isExpiredNoFallback` is true, a distinct dismissable-none banner replaces the normal subtitle, explaining access is limited until a plan is chosen — the plan cards below remain fully interactive.
- Selecting the Free plan (or any $0 plan) skips the Stripe/Paystack provider-choice step entirely and calls the new switch endpoint directly.

**Superadmin Plans page** (`frontend/src/app/superadmin/plans/page.tsx`): add form inputs for `priceQuarterly` (alongside the existing monthly/yearly price inputs), `trialDurationDays` (number, blank = unlimited), `tierRank` (number), `isRecommended` (checkbox), and two `<select>`s for `expiredFallbackPlanId` and `upgradePlanId` populated from the other existing active plans (excluding the plan being edited itself, to prevent self-reference).

## Error Handling

- `POST /tenant/subscription/switch/:planId` on a non-zero-price plan → 400 with a clear message ("This plan requires payment; use checkout instead").
- Superadmin setting `expiredFallbackPlanId` or `upgradePlanId` to the plan's own id → 400 (self-reference rejected).
- Lazy expiry check failing mid-request (e.g. a transient DB error) → falls through to the existing catch-all in `loadSubscription`, which already defaults to `DEFAULT_FEATURES` rather than blocking the request — unchanged, this spec doesn't need special handling here since the existing fallback is already conservative (denies extra access, doesn't crash).

## Testing Plan

Following this repo's established convention (vitest used narrowly, not adopted repo-wide): unit tests for the expiry-resolution logic (trial expired + fallback present → switches plan; trial expired + no fallback → EXPIRED; trial not yet expired → no-op) as a pure function extracted from the middleware, plus the Stripe quarterly interval-mapping logic. Everything else (billing page rendering, superadmin form, end-to-end plan switch) verified manually via the browser, matching this session's established pattern.

## Open Items

None — all points raised during brainstorming were resolved before this write-up.
