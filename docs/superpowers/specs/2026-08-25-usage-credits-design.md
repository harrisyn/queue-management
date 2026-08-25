# Usage Credits — Design Spec

**Date:** 2026-08-25
**Status:** Approved, implemented
**Sub-project 3 of 6** in the usage-based billing platform initiative (see
`docs/superpowers/specs/2026-08-25-usage-tracking-limits-design.md` for the
full decomposition).

## Problem / scope reality check

The original ask was "AI/email/SMS credit pools." Before designing, the
codebase was checked for what actually consumes these today:

- **Email** exists only for auth OTP codes (login/registration
  verification) — not a customer-facing notification feature.
- **SMS** doesn't exist at all — `smsNotifications` is a plan feature-flag
  boolean with no implementation behind it.
- **AI** doesn't exist at all.

Building a full metering system with no real consumer is infrastructure
with nothing to gate, and metering the one thing that does use email
(login OTPs) would mean blocking someone's login over a quota — a bad
idea regardless of plan design.

**Decision: build the credit-ledger infrastructure only.** No feature
calls it yet. This is deliberately incomplete — it's ready for whenever a
real AI/SMS/email feature is built, at which point that feature calls the
one new primitive (`consumeCredits`) rather than needing its own metering
logic.

## Decisions

- **Credit types**: `AI`, `EMAIL`, `SMS` (enum — extending to a 4th type
  is a small migration, same scoping as `AddOnResourceType`).
- **Per-plan allowance**: each plan configures its own monthly allowance
  per credit type, not a single global number. Matches how plan tiers
  already differentiate on everything else (locations, users, queue
  throughput).
- **Reset each billing period**: balance resets to the plan's allowance
  at `currentPeriodStart`, same timing already used for
  `queueEntriesPeriod`. No rollover/accumulation.
- **Out of scope for now**: wiring credits to add-ons (buying extra AI
  credits as a sub-project-2-style add-on) — revisit once a real
  credit-consuming feature exists.

## Data model

```prisma
enum CreditType {
  AI
  EMAIL
  SMS
}

model PlanCreditAllowance {
  id               String            @id @default(uuid())
  planId           String
  plan             SubscriptionPlan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  creditType       CreditType
  monthlyAllowance Int?              // null = unlimited
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt

  @@unique([planId, creditType])
}

model CreditLedgerEntry {
  id             String       @id @default(uuid())
  organizationId String
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  creditType     CreditType
  amount         Int          // positive = grant, negative = consumption
  reason         String
  createdAt      DateTime     @default(now())

  @@index([organizationId, creditType, createdAt])
}
```

Migration seeds a `null` (unlimited) `PlanCreditAllowance` row for every
existing plan × credit type combo, so nothing is retroactively blocked.

## Core primitive

`consumeCredits(organizationId, creditType, amount, reason)` in
`subscription.middleware.ts`, following the exact shape of `checkLimit`:

1. Resolve the org's usable subscription and plan (same
   `applyExpiryIfNeeded`/`isUsable` logic already used).
2. Look up `PlanCreditAllowance` for `(plan.id, creditType)`. No row or
   `monthlyAllowance === null` → unlimited, always allowed, no ledger
   entry needed (consumption isn't tracked when there's nothing to run
   out of, matching how `queueEntriesDaily`/`queueEntriesPeriod` skip
   enforcement when the plan limit is null).
3. Otherwise, sum `CreditLedgerEntry.amount` for
   `(organizationId, creditType)` where `createdAt >= currentPeriodStart`
   to get the current balance (allowance is not stored as entries —
   `balance = monthlyAllowance + sum(ledger entries this period)`, so a
   `-5` consumption entry against a `100` allowance leaves `95`).
4. If `balance >= amount`: insert a `CreditLedgerEntry` with
   `amount: -amount` and the given `reason`; return
   `{ allowed: true, remaining: balance - amount }`.
5. Otherwise: no entry inserted (consuming what wasn't consumed is
   silently correct); return `{ allowed: false, remaining: balance }`.

No route or controller calls this yet — it exists for a future feature to
import and call directly, the same way `checkLimit` is called directly
from `joinQueue`.

## Superadmin

- **Plan editor**: the existing `superadmin/plans` edit modal gains three
  new number inputs (AI / Email / SMS monthly allowance, blank =
  unlimited), alongside the existing limit fields. Saved via the existing
  `updatePlan`/`createPlan` controllers, extended to upsert the three
  `PlanCreditAllowance` rows for that plan.
- **Manual grant**: `POST /superadmin/organizations/:id/credits/grant`
  with `{ creditType, amount, reason }` inserts a positive
  `CreditLedgerEntry` — for goodwill top-ups (e.g. support agent
  compensates an org after an incident). Exposed as a small form on the
  existing superadmin organization detail page.

## Visibility

`getMySubscription` gains a `credits` section shaped identically to
`limits` (`{ current, limit, allowed }` per type), computed the same way
`consumeCredits` computes balance, but read-only (no consumption). Since
nothing consumes credits yet, `current` (amount used this period) is
always `0` — expected. Rendered on the billing page with the existing
`UsageBar` component (from sub-project 1) — no new frontend component
needed.

## Testing

- Unit tests for `consumeCredits`: unlimited (no allowance row / null
  allowance) always allows and writes no ledger entry; sufficient balance
  consumes and returns correct remaining; insufficient balance is
  rejected and writes nothing; period boundary (entries before
  `currentPeriodStart` excluded from balance).
- Unit tests for the plan editor's allowance upsert.
- Unit test for the manual grant endpoint (positive ledger entry
  recorded, validated against organization ownership by a superadmin —
  no ownership restriction needed since superadmin manages all orgs).
- Manual verification: set a plan's AI allowance to a real number via
  the superadmin plan editor, confirm it displays correctly (as `0 / N`)
  on the billing page; grant credits via the superadmin org detail page
  and confirm a subsequent read reflects the higher balance.
