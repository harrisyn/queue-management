# Payment Provider Config + Tenant Pricing Page — Design Spec

Status: Approved by user (2026-08-13), pending implementation plan.
Feeds from: `project-saas-redesign-initiative` memory (sub-project 3 of the SaaS redesign decomposition — the last unstarted piece).

## Problem

The app has `SubscriptionPlan` and `OrganizationSubscription` Prisma models, and a superadmin can already manually create plans and assign a plan to an organization (`PATCH /api/v1/superadmin/organizations/:id/subscription`). What's missing is everything that makes this a real, self-service SaaS billing flow: a way for the platform operator to configure real payment providers, and a way for a tenant to view their plan, pick a new one, pay for it, and have it renew automatically.

Two blocking issues were found in the existing subscription code during design exploration and are fixed as part of this work, since the new feature writes to and reads from the exact same code paths:

1. `subscription.middleware.ts` (both `loadSubscription` and `getMySubscription`) queries `prisma.organizationSubscription.findUnique({ where: { organizationId } })`, but `OrganizationSubscription` has no `organizationId` field — the relation runs the other way (`Organization.subscriptionId` → `OrganizationSubscription.id`). This causes a 500 on `/api/v1/subscription` on every authenticated page load today.
2. `Organization.subscriptionId` is not marked `@unique` in the schema, so Prisma's implicit relation would currently allow multiple organizations to point at the same `OrganizationSubscription` row. Once webhooks start writing to this model for real payments, a shared row would let one org's billing event corrupt another org's subscription state.

## Goals

1. Let the superadmin configure Stripe and Paystack API keys from the UI (no redeploy needed to add/change a provider).
2. Let a tenant admin view their current plan/status, browse available plans, and subscribe/upgrade — choosing which payment provider to pay with.
3. Support real recurring billing: the provider auto-charges each period via its native subscription object, and a webhook keeps our `OrganizationSubscription` row in sync (renewal succeeded, renewal failed, cancelled).
4. Fix the two blocking issues above as part of this work.

## Non-goals

- No per-tenant payment provider accounts (a tenant using their own Stripe account to receive money) — the platform operator is the merchant of record. This is platform-level config only.
- No proration, multi-currency display conversion, or invoice/receipt generation UI beyond what Stripe/Paystack's own hosted checkout and customer portals already provide.
- No new automated test framework for most of this — matches this repo's existing convention (manual verification via `docker compose up` + the browse skill against provider test-mode/sandbox credentials). The one exception: webhook signature verification and event-dedupe/idempotency logic get minimal automated tests, since those are pure, cheap-to-test, and easy to get subtly wrong in a way that's expensive to discover manually (a forged or double-processed webhook is a real-money bug).
- No admin UI for viewing raw webhook event logs — server logs are sufficient for now.

## Data model

New table, one row per provider:

```prisma
model PaymentProviderConfig {
  id            String   @id @default(uuid())
  provider      String   // "stripe" | "paystack"
  isActive      Boolean  @default(false)
  publicKey     String?  // safe to expose to frontend (Stripe publishable key / Paystack public key)
  secretKey     String   // encrypted at rest (AES-256-GCM, app-level master key from env)
  webhookSecret String   // encrypted at rest, used to verify webhook signatures
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  @@unique([provider])
}
```

Both providers can be `isActive: true` at once — the tenant picks which one to pay with at checkout. A provider with `isActive: false` (or no config row at all) simply doesn't appear as a checkout option on the pricing page.

Changes to existing models:
- `Organization.subscriptionId` gets `@unique` added, making the relation properly one-to-one.
- `OrganizationSubscription` gains a `provider` field (`String?`, `"stripe" | "paystack"`) so webhook handlers know which provider's signature to expect for a given subscription's renewal events. The existing `externalPaymentId` field is repurposed (renamed to `externalProviderSubscriptionId` for clarity) to hold the provider's recurring-subscription ID.

## Payment provider abstraction

A `PaymentProvider` interface in `backend/src/services/payments/`:

```typescript
interface PaymentProvider {
  createCheckoutSession(params: {
    organizationId: string;
    planId: string;
    successUrl: string;
    cancelUrl: string;
  }): Promise<{ redirectUrl: string }>;

  verifyWebhookSignature(rawBody: Buffer, signatureHeader: string): PaymentWebhookEvent | null;

  cancelSubscription(externalSubscriptionId: string): Promise<void>;
}
```

`StripeProvider` and `PaystackProvider` both implement this using their respective SDKs. Keys are loaded from `PaymentProviderConfig` (decrypted at use, never logged). A small factory (`getProvider(name: 'stripe' | 'paystack')`) reads the active config and returns the right implementation instance, throwing a typed error if that provider isn't configured/active — this is the error path the checkout endpoint uses to 400 on an invalid provider choice.

## API endpoints

- `GET /api/v1/superadmin/payment-providers` — list both providers' config (secret/webhook keys masked, never returned in full once saved).
- `PUT /api/v1/superadmin/payment-providers/:provider` — upsert a provider's config. Body includes a `test: true` flag path (`POST /api/v1/superadmin/payment-providers/:provider/test`) that validates the key pair against the provider's API (e.g., a lightweight authenticated GET) before the superadmin commits to saving it — catches typos immediately instead of failing silently at the next real checkout.
- `GET /api/v1/tenant/subscription` — replaces the current buggy `getMySubscription` (fixed query, same response shape plus a new `activeProviders: ('stripe' | 'paystack')[]` field so the frontend knows which checkout buttons to show).
- `POST /api/v1/tenant/subscription/checkout` — body `{ planId, provider }`. Looks up the org, calls the chosen provider's `createCheckoutSession`, returns `{ redirectUrl }`. 400 if the org already has an active subscription to that same plan, or if the chosen provider isn't active.
- `POST /api/v1/webhooks/stripe`, `POST /api/v1/webhooks/paystack` — public routes (no auth middleware — these are called by the provider, not a logged-in user), signature-verified via `verifyWebhookSignature`, update `OrganizationSubscription` status/dates/`externalProviderSubscriptionId` accordingly. Idempotent: each provider event carries a unique event ID, which is checked against a small `ProcessedWebhookEvent` table (`id`, `provider`, `eventId`, `processedAt`, unique on `[provider, eventId]`) before applying any state change, so a retried webhook is a safe no-op.

## Frontend pages

- **Superadmin**: new tab/section on the existing `frontend/src/app/superadmin/` panel (alongside Organizations/Plans) — `frontend/src/app/superadmin/payment-providers/page.tsx`. Two cards (Stripe, Paystack), each with key input fields, a "Test Connection" button, an active/inactive toggle, and last-updated timestamp. Follows the dark navy + teal styling established in Phase 4.
- **Tenant**: new page `frontend/src/app/admin/billing/page.tsx` (grouped with the other `/admin/*` tenant-settings pages, consistent with the Phase 3 IA). Shows current plan/status banner at the top (reusing `PageHeader`), then a grid of plan cards (`Card`/`Badge` from the shared `ui/` library) with feature comparisons, and a "Subscribe"/"Upgrade" button per plan that opens a small provider-choice step (Stripe/Paystack buttons, only showing providers where `activeProviders` includes them) before redirecting to the hosted checkout.

## Error handling

- Checkout request for an inactive/unconfigured provider → 400, clear message; frontend also hides that provider's button entirely when not active (defense in depth, not the primary guard).
- Webhook signature verification failure → 400, logged, no state change.
- Webhook for an org/subscription that can't be matched (e.g., a stale/abandoned checkout session) → 200 (acknowledge so the provider stops retrying), logged as a warning, no state change.
- Our DB write fails after a verified, matched webhook event → 500, so the provider retries later. Safe because of the idempotency table.
- A provider key gets revoked externally after being saved → checkout attempts fail gracefully with a generic "Payment provider temporarily unavailable" message rather than leaking a raw provider error to the tenant; the failure is logged with enough detail for the operator to diagnose.

## Testing plan

- Automated (the one exception to this repo's no-new-test-framework convention, justified above): unit tests for `verifyWebhookSignature` on both providers (valid signature accepted, tampered payload rejected, expired/replayed timestamp rejected where the provider SDK supports that check) and for the idempotency dedupe logic.
- Everything else verified manually via the browse skill against `docker compose up`, using each provider's test-mode/sandbox credentials:
  - Superadmin: save a provider config, use "Test Connection", toggle active/inactive, confirm the pricing page's provider buttons update accordingly.
  - Tenant: full checkout round-trip against Stripe test mode and Paystack test mode separately — subscribe, get redirected, complete test payment, get redirected back, confirm plan/status updates on the pricing page and in the superadmin org detail view.
  - Webhook retry safety: manually resend a webhook event (both providers' dashboards support this in test mode) and confirm no duplicate state change or error.
  - Regression check: confirm the `/api/v1/subscription` 500 is gone and existing feature-gating (`requireFeature`, `enforceLimit`) still works correctly now that the underlying query is fixed.

## Open items carried into implementation planning

- Exact set of Stripe/Paystack webhook event types to subscribe to (e.g., `checkout.session.completed`, `invoice.payment_succeeded`, `invoice.payment_failed`, `customer.subscription.deleted` for Stripe; Paystack's equivalent `charge.success`, `subscription.not_renew`, `invoice.payment_failed`) — implementation-time detail, not a design decision.
- Whether the superadmin "Test Connection" check should also verify webhook reachability (e.g., a signed test ping) or just that the API key authenticates — leaning toward API-key-only for v1, revisit if webhook misconfiguration turns out to be a common support issue.
- Master-key rotation strategy for the encryption-at-rest scheme (how to re-encrypt existing `PaymentProviderConfig` rows if the env-var master key ever needs to change) — not needed for initial implementation, worth a short note in the code rather than blocking this spec.
