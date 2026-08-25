# Plan Builder — Design Spec

**Date:** 2026-08-25
**Status:** Approved, implemented
**Sub-project 4 of 6** in the usage-based billing platform initiative (see
`docs/superpowers/specs/2026-08-25-usage-tracking-limits-design.md` for the
full decomposition).

## Problem

Add-on pricing (sub-project 2) is global — one price for "extra location"
and one for "extra user," the same across every plan. This was explicitly
deferred as "the plan builder's job" at the time. Additionally, superadmin
has no way to see what a plan's *effective* price looks like once add-ons
are factored in — setting a base price is a guess with no feedback.

## Scope

1. **Per-plan add-on pricing overrides.** A plan can set its own
   extra-location/extra-user prices, overriding the global default.
2. **A cost breakdown calculator** in the plan editor — a live, purely
   client-side computed preview of "base price + N add-ons" as the
   superadmin edits pricing fields.

## Decisions

- **Global pricing stays as the fallback**, not replaced. A new table
  holds only the plans that choose to override it. No migration risk to
  the existing global `AddOnPricing` data, and no plan is required to
  configure anything to keep working exactly as before.
- **Blank override field = "use the global default"** — the same
  blank-means-unset convention already used for credit allowances
  (`PlanCreditAllowance`) and plan limits.
- **The calculator is purely illustrative** — computed client-side from
  form state, not persisted, not authoritative. It exists to give
  superadmin feedback while typing, not to become a new pricing source of
  truth.
- **Credits aren't part of the price breakdown** — credits are allowances
  (a quantity), not a purchasable per-unit item with its own price in this
  system. Only base price + add-on pricing form a monetary total.

## Data model

```prisma
model PlanAddOnPricingOverride {
  id                  String            @id @default(uuid())
  planId              String
  plan                SubscriptionPlan  @relation(fields: [planId], references: [id], onDelete: Cascade)
  resourceType        AddOnResourceType
  pricePerUnitMonthly Decimal
  pricePerUnitOneOff  Decimal
  createdAt           DateTime          @default(now())
  updatedAt           DateTime          @updatedAt

  @@unique([planId, resourceType])
}
```

Mirrors `PlanCreditAllowance`'s shape exactly (same unique-per-plan-per-type
pattern). `AddOnResourceType` (`LOCATIONS` | `USERS`) is reused from
sub-project 2 — no new enum needed.

## Price resolution

New helper in `addOnCheckout.controller.ts` (or a small shared function):
`resolveAddOnUnitPrice(planId, resourceType, billingMode)`:

1. Look up `PlanAddOnPricingOverride` for `(planId, resourceType)`. If
   found, use its `pricePerUnitMonthly`/`pricePerUnitOneOff` depending on
   `billingMode`.
2. Otherwise, fall back to the global `AddOnPricing` row for
   `resourceType` (existing behavior, unchanged).

`createAddOnCheckout` currently resolves `organizationId` then goes
straight to global `AddOnPricing`. It's extended to also fetch the org's
current `planId` (already available via the same subscription lookup
pattern used elsewhere) and pass it through the resolver above.

## Superadmin

**Plan editor** (`superadmin/plans` edit modal): a new "Add-On Price
Overrides (blank = use global default)" section with four inputs —
Extra Location: monthly / one-off, Extra User: monthly / one-off. Saved
via the same upsert-per-type pattern as credit allowances
(`upsertAddOnPricingOverrides(planId, overrides)` in
`superadmin.controller.ts`, called from `createPlan`/`updatePlan`).
A blank field clears any existing override for that price field (deletes
the specific price... actually the override row carries both prices
together per `(planId, resourceType)`, so "blank" is interpreted per
resourceType as a whole: if both monthly and one-off are left blank for a
resource type, the override row is deleted entirely for that type,
reverting to global; if at least one is filled, the row is
upserted with the blank field defaulting to `0`).

**Cost breakdown calculator**: rendered inside the same edit modal, below
the pricing fields. Computed as:

```
effectivePrice = basePriceMonthly
  + (locationOverride ?? globalLocationPrice) * 1
  + (userOverride ?? globalUserPrice) * 1
```

labeled "Illustrative price with 1 extra location + 1 extra user: $X/mo".
Requires the global `AddOnPricing` rows to be loaded alongside plans in
the existing `superadmin/plans` page (one extra fetch on page load,
already have `api.getAddOnPricing()` from sub-project 2).

## Testing

- Unit tests for `resolveAddOnUnitPrice`: override present → override
  price used; no override → global default used; override exists for one
  resourceType but not the other → only that type falls back.
- Unit tests for `upsertAddOnPricingOverrides`: both fields blank deletes
  the override row; one field filled upserts with the other defaulting to
  0; existing override updated when re-saved.
- Manual verification: set a per-plan override via the plan editor,
  purchase (or simulate) an add-on checkout for that plan's org, confirm
  the override price is charged instead of the global default; confirm
  the calculator preview updates live as pricing fields change.

## Out of scope (deferred)

- Overriding credit "pricing" — credits have no purchase price in this
  system, only allowances.
- A full drag-and-drop or wizard-style plan composer — this is scoped to
  override fields + a text preview, not a new UI paradigm.
