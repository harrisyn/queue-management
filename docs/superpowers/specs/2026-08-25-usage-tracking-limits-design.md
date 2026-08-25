# Usage Tracking & Limits — Design Spec

**Date:** 2026-08-25
**Status:** Approved, ready for implementation planning
**Sub-project 1 of 6** in the usage-based billing platform initiative (see context below).

## Context

The user requested a broad usage-based billing platform: add-on billing for extra
resources, AI/email/SMS credit pools, per-location throughput limits, usage
visibility, white-labeling, and custom domains. This was too large for a single
spec and was decomposed into independent sub-projects:

1. **Usage tracking + limits** (this spec) — foundation for everything else
2. Add-on billing (extra locations/users, recurring or one-off)
3. Usage credits (AI/email/SMS)
4. Plan builder (base price + add-ons)
5. White-labeling (custom colors/logo, hide "powered by")
6. Custom domains (alongside the existing slug)

This spec covers only #1. The others get their own spec/plan cycle later.

## Problem

`SubscriptionPlan` already has dedicated limit columns (`maxLocations`,
`maxServicesPerLoc`, `maxUsersPerOrg`, `maxQueueEntriesPerDay`), and
[subscription.middleware.ts](../../../backend/src/middleware/subscription.middleware.ts)
already enforces locations/services/users via `checkLimit`/`enforceLimit`. Two
gaps exist:

1. **Queue throughput is unenforced.** `maxQueueEntriesPerDay` is read only by
   the superadmin org-detail usage view — nothing blocks a public queue join
   when a plan's daily (or period) cap is hit.
2. **Tenants can't see their own usage.** `getMySubscription` returns
   locations/services/users limits (consumed by nothing today — the billing
   page shows only an upgrade callout), and there is no dashboard visibility
   at all.

## Decisions

- **Enforcement is a hard block.** When a daily or period queue-entry cap is
  hit, both the public join page and staff "add to queue" refuse new entries
  with a clear message, until the cap resets.
- **Period cap resets on the billing cycle**, tied to
  `OrganizationSubscription.currentPeriodStart`/`currentPeriodEnd` (monthly,
  quarterly, or yearly depending on the org's `billingCycle`) — not a fixed
  calendar month.
- **Period cap is an independent plan field**, not derived from the daily cap.
  A plan can set a generous daily cap with a tighter period total, or vice
  versa.
- **Usage is surfaced in two places**: an expanded "Usage" section on the
  existing billing page, and a compact widget on the admin dashboard — both
  fed by one endpoint.
- **Mechanism: live COUNT queries**, extending the existing
  `checkLimit`/`enforceLimit` pattern. Rejected alternatives:
  - *Denormalized running counters* (increment on `QueueEntry` create) — adds
    write-path complexity and reset/backfill logic for no measured benefit at
    current scale.
  - *Nightly aggregation snapshots* — useful for historical usage charts
    later, but unnecessary for MVP enforcement; revisit if/when a usage-trends
    feature is scoped.

## Data model changes

Add one column to `SubscriptionPlan`:

```prisma
maxQueueEntriesPerPeriod Int? // null = unlimited; independent of maxQueueEntriesPerDay
```

No new tables. `QueueEntry.joinedAt` (already present) is the source of truth
for both daily and period counts, scoped via the existing
`queue → service → location → organizationId` join chain (same chain the
superadmin usage endpoint already uses).

Migration: additive nullable column, backfill not required (null = unlimited,
matches existing behavior for orgs with no configured cap).

## Backend changes

### `subscription.middleware.ts`

- Add `queueEntriesDaily` and `queueEntriesPeriod` to the `FeatureKey`/limit-type
  union used by `checkLimit`/`enforceLimit`.
- `checkLimit` gains two new cases:
  - `queueEntriesDaily`: count `QueueEntry` where `joinedAt >= startOfDay` (server
    local time, matching the existing superadmin "today" calculation), limit =
    `plan.maxQueueEntriesPerDay`.
  - `queueEntriesPeriod`: count `QueueEntry` where
    `joinedAt >= subscription.currentPeriodStart`, limit =
    `plan.maxQueueEntriesPerPeriod`.
  - Both null limits mean unlimited (matches existing `maxLocations` etc.
    null-handling).
- **New resolution path required**: existing `enforceLimit` derives
  `organizationId` from `req.user.organizationId` — but `POST /queues/:id/join`
  ([queue.routes.ts:34](../../../backend/src/routes/queue.routes.ts#L34)) is a
  public route; the joiner is a customer, not an authenticated org user. Add an
  `enforceQueueEntryLimit` middleware variant that resolves `organizationId`
  from `req.params.id` (the queue) via `queue.service.location.organizationId`,
  then runs both `queueEntriesDaily` and `queueEntriesPeriod` checks. On block,
  respond 403 with `{ error: 'Limit reached', limitType, current, limit }` —
  same shape as the existing `enforceLimit` response, so frontend join-page
  error handling doesn't need a new code path.
- Wire `enforceQueueEntryLimit` onto the join route, before `joinQueue` runs.

### `getMySubscription`

Extend the `limits` object with `queueEntriesDaily` and `queueEntriesPeriod`,
each `{ current, limit, allowed }`, computed the same way `checkLimit` does.
This is the single endpoint both frontend surfaces will consume — no new
endpoint.

## Frontend changes

### New shared component: `UsageBar` (`components/ui/UsageBar.tsx`)

The progress-bar-with-label markup currently duplicated in the superadmin org
detail page becomes a reusable component: `<UsageBar label="Locations"
current={2} limit={5} />`, rendering the existing `--primary-500` fill, turning
`--warning-500` at ≥80% and `--error-500` at 100%. Both new surfaces below use
it; the superadmin org detail page is refactored to use it too (removes the
one-off `progressBar`/`progressFill` style objects there).

### Billing page (`app/admin/billing/page.tsx`)

Add a "Usage" `Card` section listing all five tracked resources
(locations, users, services, queue entries today, queue entries this period)
as `UsageBar` rows, placed near the existing plan/upgrade section.

### Dashboard widget

A compact card on the tenant admin dashboard landing page, same data source,
showing only resources at ≥80% of their cap (to avoid clutter when everything
is well within limits) — full breakdown lives on the billing page.

## Testing

- Unit tests for `checkLimit`'s new cases: daily boundary (entry just before/
  after midnight), period boundary (entry just before/after
  `currentPeriodStart`), null-limit (unlimited) behavior.
- Unit test for `enforceQueueEntryLimit`'s organizationId resolution from a
  public (unauthenticated) request.
- Manual browser verification: an org seeded near its cap shows correct
  `UsageBar` state on both billing page and dashboard widget; a join attempt
  past the cap is blocked with the expected message on both the public join
  page and the staff-facing add-to-queue flow.

## Out of scope (deferred to later sub-projects)

- Add-on billing for exceeding limits (sub-project 2)
- AI/email/SMS credit pools (sub-project 3)
- Historical usage charts/trends (would motivate revisiting the
  snapshot-aggregation alternative rejected above)
