# Add-On Billing — Design Spec

**Date:** 2026-08-25
**Status:** Approved, ready for implementation planning
**Sub-project 2 of 6** in the usage-based billing platform initiative (see
`docs/superpowers/specs/2026-08-25-usage-tracking-limits-design.md` for the
full decomposition and sub-project 1, which this spec builds on).

## Problem

Orgs that outgrow their plan's location/user limits today have exactly one
option: upgrade to a more expensive plan with a higher limit across the
board. There is no way to buy a small amount of extra capacity (e.g. "just
2 more locations") without paying for a whole tier jump. This spec adds
purchasable add-ons for the two resources sub-project 1 already tracks and
enforces: locations and users.

## Decisions

- **Scope**: extra locations and extra users only. Services and queue
  throughput can reuse this same mechanism later; not built now.
- **Pricing is global per unit** (one price for "extra location", one for
  "extra user"), set once by superadmin — not per-plan. A full per-plan
  pricing matrix belongs to the deferred plan-builder sub-project.
- **A one-off add-on purchase is permanent** — it raises the org's
  effective limit forever, not just for the current billing period.
- **A recurring add-on bills as its own separate charge**, independent of
  the org's plan subscription. It does NOT appear as a line item on the
  same invoice as the plan. This avoids restructuring the existing
  one-subscription-per-organization model
  (`backend/prisma/schema.prisma`'s `OrganizationSubscription`,
  `Organization.subscriptionId`) and its checkout/webhook flow, at the
  cost of two separate charges on the customer's statement instead of one.
- **Add-on quantity is fixed at purchase** — changing from "2 extra
  locations" to "5 extra locations" means cancelling the existing add-on
  and purchasing a new one. No in-place quantity edits in v1.
- **Purchased and managed from a new "Add-ons" section on the billing
  page**, not inline on the usage bars.

## Data model

Two new tables in `backend/prisma/schema.prisma`:

```prisma
enum AddOnBillingMode {
  RECURRING
  ONE_OFF
}

enum AddOnStatus {
  ACTIVE
  CANCELLED
}

enum AddOnResourceType {
  LOCATIONS
  USERS
}

model AddOnPricing {
  id                 String            @id @default(uuid())
  resourceType       AddOnResourceType @unique
  pricePerUnitMonthly Decimal          @default(0) // price for 1 unit of this resource, recurring, per month
  pricePerUnitOneOff Decimal           @default(0) // price for 1 unit of this resource, one-time
  currency           String            @default("USD")
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
}

model OrganizationAddOn {
  id                             String            @id @default(uuid())
  organizationId                 String
  organization                   Organization      @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  resourceType                   AddOnResourceType
  quantity                       Int
  billingMode                    AddOnBillingMode
  status                         AddOnStatus       @default(ACTIVE)
  provider                       String?           // "stripe" | "paystack" | null (null impossible in practice - every add-on is paid)
  externalSubscriptionId         String?           // set for RECURRING add-ons only; used to cancel and to match renewal/cancellation webhooks
  currentPeriodEnd               DateTime?          // RECURRING only, informational display
  purchasedAt                    DateTime          @default(now())
  cancelledAt                    DateTime?
  createdAt                      DateTime          @default(now())
  updatedAt                      DateTime          @updatedAt

  @@index([organizationId, resourceType, status])
  @@index([externalSubscriptionId])
}
```

Add the inverse relation `addOns OrganizationAddOn[]` to the `Organization`
model.

`AddOnPricing` is seeded with two rows (`LOCATIONS`, `USERS`) at `0`/`0` by
migration, matching the existing convention of shipping a usable default
(see `20260815003344_billing_plan_metadata`'s Free-plan seed) — a `0` price
add-on is effectively free until superadmin sets a real price, never a
missing-row crash.

## Effective limit resolution

Both `checkLimit` and `getMySubscription`
(`backend/src/middleware/subscription.middleware.ts`) gain one additional
step wherever they currently read `maxLocations`/`maxUsersPerOrg` off the
plan: if the plan limit is not `null` (not already unlimited), add the sum
of `quantity` across the organization's `ACTIVE` `OrganizationAddOn` rows
for that `resourceType`.

```typescript
async function addOnBoost(organizationId: string, resourceType: 'LOCATIONS' | 'USERS'): Promise<number> {
  const result = await prisma.organizationAddOn.aggregate({
    where: { organizationId, resourceType, status: 'ACTIVE' },
    _sum: { quantity: true },
  });
  return result._sum.quantity ?? 0;
}
```

Applied as: `effectiveLimit = planLimit === null ? null : planLimit + (await addOnBoost(organizationId, 'LOCATIONS'))`.
This is the only change to sub-project 1's enforcement code — `enforceLimit`,
the join-throughput checks, `UsageBar`, and the dashboard widget all
continue to work unmodified since they only ever see the resulting number.

Services and `queueEntriesDaily`/`queueEntriesPeriod` are untouched (out of
scope per the Decisions section).

## Checkout

### Provider interface addition

`backend/src/services/payments/types.ts` gains:

```typescript
export interface CreateAddOnCheckoutParams {
  organizationId: string;
  resourceType: 'LOCATIONS' | 'USERS';
  quantity: number;
  billingMode: 'recurring' | 'one_off';
  unitPrice: number; // resolved from AddOnPricing before calling the provider
  currency: string;
  successUrl: string;
  cancelUrl: string;
}
```

Added to the `PaymentProvider` interface:
`createAddOnCheckoutSession(params: CreateAddOnCheckoutParams): Promise<CheckoutResult>`.

### Stripe

New `createAddOnCheckoutSession` on `StripeProvider`, parallel to the
existing `createCheckoutSession`:

- `billingMode === 'one_off'` → Checkout Session with `mode: 'payment'`,
  one line item: `unit_amount = unitPrice * 100`, `quantity`.
- `billingMode === 'recurring'` → Checkout Session with
  `mode: 'subscription'`, one line item with `recurring: { interval:
  'month' }` (add-ons are monthly-only in v1 — no quarterly/yearly add-on
  cycle), `unit_amount = unitPrice * 100`, `quantity`.
- Both set `metadata: { kind: 'addon', organizationId, resourceType,
  quantity: String(quantity), billingMode }` — the `kind: 'addon'`
  discriminator is what the webhook handler branches on.

### Paystack

Paystack has no direct equivalent of Stripe's inline `price_data` +
`mode: 'subscription'` on a one-off transaction — recurring billing
requires a `Plan` object. New `createAddOnCheckoutSession` on
`PaystackProvider`:

- `billingMode === 'one_off'` → same as today's `createCheckoutSession`
  minus the `planId`/`billingCycle` metadata fields: a plain
  `/transaction/initialize` call.
- `billingMode === 'recurring'` → first `POST /plan` to create a Paystack
  plan (`amount: unitPrice * 100 * quantity`, `interval: 'monthly'`, a
  generated `name` like `"2x locations add-on"`), then
  `/transaction/initialize` with `plan: <created plan code>` in the body —
  Paystack auto-subscribes the customer to that plan on successful first
  charge and auto-renews thereafter.
- Both set the same `metadata: { kind: 'addon', organizationId,
  resourceType, quantity, billingMode }`.

### Controller and route

New `backend/src/controllers/addOnCheckout.controller.ts`:

- `createAddOnCheckout(req, res, next)`: validates `resourceType` (`LOCATIONS`|`USERS`),
  `quantity` (positive integer), `billingMode` (`recurring`|`one_off`),
  looks up the caller's `organizationId` and the matching `AddOnPricing`
  row, computes `unitPrice = billingMode === 'recurring' ?
  pricing.pricePerUnitMonthly : pricing.pricePerUnitOneOff`, resolves the
  active provider via `getProvider`, and calls
  `createAddOnCheckoutSession`.
- `cancelAddOn(req, res, next)`: given an `OrganizationAddOn` id belonging
  to the caller's org, verifies `billingMode === 'recurring'` and
  `status === 'ACTIVE'`, calls `provider.cancelSubscription(externalSubscriptionId)`,
  then sets `status: 'CANCELLED', cancelledAt: now()`. One-off add-ons
  cannot be cancelled (they're a permanent, already-paid-for purchase) —
  the endpoint 400s if asked to cancel one.

New routes in `backend/src/routes/index.ts`:
```
router.post('/tenant/addons/checkout', authenticate, createAddOnCheckout);
router.delete('/tenant/addons/:id', authenticate, cancelAddOn);
router.get('/tenant/addons', authenticate, listMyAddOns);
```
`listMyAddOns` returns the caller's org's `OrganizationAddOn` rows (for
rendering the "active add-ons" list on the billing page).

## Webhook handling

`backend/src/controllers/paymentWebhook.controller.ts`'s `applyWebhookEvent`
gains a branch at the top: if the incoming event's raw provider payload
carries `metadata.kind === 'addon'` (Stripe: `session.metadata.kind` /
`invoice`'s parent subscription's metadata; Paystack:
`event.data.metadata.kind`), route to a new `applyAddOnWebhookEvent`
function instead of the existing plan-subscription logic. This requires
`PaymentWebhookEvent` (`types.ts`) to carry the discriminator and the
add-on fields through from each provider's `verifyWebhookSignature`:

```typescript
export interface PaymentWebhookEvent {
  eventId: string;
  type: PaymentWebhookEventType;
  organizationId: string | null;
  externalSubscriptionId: string | null;
  currentPeriodEnd: Date | null;
  planId: string | null;
  billingCycle: 'monthly' | 'quarterly' | 'yearly' | null;
  kind: 'plan' | 'addon';                    // new
  addOn?: { resourceType: 'LOCATIONS' | 'USERS'; quantity: number; billingMode: 'recurring' | 'one_off' }; // new, only set when kind === 'addon'
}
```

`applyAddOnWebhookEvent`:
- `checkout_completed` (one-off or first recurring charge): create an
  `OrganizationAddOn` row (`status: 'ACTIVE'`, `externalSubscriptionId` set
  only for `recurring`, `currentPeriodEnd` set only for `recurring`).
- `renewal_succeeded`: find the `OrganizationAddOn` by
  `externalSubscriptionId`, bump `currentPeriodEnd`.
- `renewal_failed`: find by `externalSubscriptionId`; for v1, log and leave
  `status: 'ACTIVE'` (no `PAST_DUE` concept for add-ons — a failed renewal
  charge on a small add-on is lower-stakes than a failed plan renewal, and
  provider-side dunning/retry handles most cases before the next matters;
  revisit if this proves insufficient in practice).
- `subscription_cancelled`: find by `externalSubscriptionId`, set
  `status: 'CANCELLED', cancelledAt: now()` (covers cancellation
  initiated directly in the provider's dashboard, not just through our
  `cancelAddOn` endpoint).

Existing plan-event handling in `applyWebhookEvent` is otherwise untouched.

## Superadmin: add-on pricing management

New page `frontend/src/app/superadmin/addon-pricing/page.tsx` (added to the
`SuperadminLayout` nav alongside Payment Providers), backed by:
- `GET /superadmin/addon-pricing` → both `AddOnPricing` rows.
- `PUT /superadmin/addon-pricing/:resourceType` → update
  `pricePerUnitMonthly`/`pricePerUnitOneOff`/`currency` for one resource
  type.

Built with the existing `components/ui` kit (`Card`, `Input`, `Button`,
`PageHeader`) — two simple `Card`s (Locations, Users), each with two price
`Input`s and a Save button, following the same shape as the existing
Payment Providers page.

## Frontend: billing page Add-ons section

New "Add-ons" `Card` on `frontend/src/app/admin/billing/page.tsx`, below
the Usage card:
- For each resource type: a quantity `Input` (number, min 1), a
  recurring/one-off `Select`, computed price preview (`quantity ×
  unitPrice`), and a "Purchase" `Button` that calls
  `POST /tenant/addons/checkout` then redirects to `redirectUrl` — same
  pattern as the existing plan checkout's `handleCheckout`.
- A list of the org's active add-ons (from `GET /tenant/addons`): resource
  type, quantity, one-off/recurring badge, and (recurring only) a "Cancel"
  button calling `DELETE /tenant/addons/:id`.

## Testing

- Unit tests for the effective-limit boost logic in `checkLimit`: plan
  limit + 0 add-ons unchanged; plan limit + active add-ons summed
  correctly; cancelled add-ons excluded; unlimited (`null`) plan limit
  short-circuits (no add-on query needed, or query result ignored).
- Unit tests for `applyAddOnWebhookEvent`: checkout_completed creates the
  row with correct fields for both billing modes; renewal_succeeded and
  subscription_cancelled correctly match by `externalSubscriptionId` and
  update status.
- Unit test for `cancelAddOn`: rejects cancelling a `one_off` add-on with
  400; rejects an add-on belonging to a different organization.
- Manual verification: purchase a one-off extra-location add-on end to
  end against a test provider (Stripe test mode), confirm the org's
  effective location limit increases and the UsageBar/dashboard widget
  from sub-project 1 reflect it without any changes on their end; cancel a
  recurring add-on and confirm the effective limit drops back down.

## Out of scope (deferred)

- Changing an existing add-on's quantity in place
- Per-plan add-on pricing (plan-builder sub-project)
- Add-ons for services or queue throughput (same mechanism, not built now)
- Quarterly/yearly recurring add-on cycles (monthly only)
- Combining add-on charges onto the same invoice as the plan subscription
