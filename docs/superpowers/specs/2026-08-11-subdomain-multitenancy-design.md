# Subdomain Multi-Tenancy — Design Spec

Status: Approved by user (2026-08-11), pending implementation plan.
Feeds into: billing/payment-provider spec, tenant pricing page spec, visual redesign (all still to be written — see `docs/superpowers/specs/audit-findings.md` for the full audit that motivated this decomposition).

## Problem

The app is meant to be a SaaS where each tenant gets its own subdomain (`nyaho.{domain}`) and superadmin is restricted to `admin.{domain}`. Today there is no subdomain routing at all — tenancy is resolved entirely from the logged-in user's JWT (`organizationId`), with no connection between a URL and an organization. The audit also found a real authorization gap: a user with no `organizationId` (e.g. a superadmin) who logs in and lands on `/` is shown a real tenant's dashboard data by default instead of an empty state — this must be closed as part of this work, not left for later.

## Goals

1. `{slug}.{domain}` resolves to a specific tenant's app (login, dashboard, all `/admin/*` pages).
2. `admin.{domain}` resolves to the superadmin panel, and only there.
3. The bare root domain (and `www`) shows the marketing site + signup wizard.
4. Signup ends by redirecting the new tenant to their own live subdomain.
5. Reserved subdomain names (`admin`, `www`, `api`, etc.) can never be claimed as a tenant slug.
6. The superadmin data-leak bug is fixed as a side effect of making org context strictly subdomain-derived.
7. Works identically in dev (`{slug}.localhost:{port}`) and prod (`{slug}.enqueueq.com` or whichever domain is configured), driven by an env var — not hardcoded.

## Non-goals (this spec)

- Custom domains for tenants (e.g. tenant's own `queue.theirhospital.com`) — future work.
- Payment providers, subscription plans UI, tenant pricing page — separate spec.
- Visual redesign of any page touched here — separate spec. This work should not change how pages look, only how they're reached and authenticated.
- Backend hosting decision — backend stays a plain domain-agnostic API; wherever it's hosted doesn't affect this design.

## Architecture

**Base domain resolution**: an env var (e.g. `NEXT_PUBLIC_APP_DOMAIN`) holds the root domain — `localhost:3000`-style in dev, `enqueueq.com`-style in prod. All subdomain extraction logic strips this suffix from the `Host` header, so the same code path runs in both environments.

**Next.js middleware** (`middleware.ts`) runs on every request and branches on the extracted subdomain:

| Subdomain | Behavior |
|---|---|
| (none) / `www` | Serve today's root routes unchanged: marketing site (`/`), registration wizard (`/register`), generic login redirect page. |
| `admin` | Rewrite internally to `/superadmin/*`. Direct hits to `/superadmin/*` on any other host redirect (preserving path) to `admin.{domain}`. |
| anything else | Treated as a tenant slug. Look up the org via `GET /api/v1/public/orgs/by-slug/:slug` (new endpoint, mirrors the existing partially-wired `/api/v1/public/orgs/...` pattern found in the audit). Match → proceed to existing authenticated app routes unchanged. No match → render a "Workspace not found" page (restyled version of the existing `Organization Not Found` component), linking back to the root marketing domain. |

**Reserved slugs**: a single shared list (`admin`, `www`, `api`, `app`, `mail`, `status`, `docs`, `support`, `staging`, `dev`, `blog`, plus any others identified during implementation) enforced in exactly one place in code, imported by both the middleware guard and the slug-validation logic (signup wizard + tenant Settings slug field), so the list never drifts out of sync between the two enforcement points.

**Vercel/DNS**: wildcard domain (`*.enqueueq.com`) added in Vercel project settings, wildcard DNS record pointed at Vercel. No reverse proxy needed for the frontend. Backend is unaffected — it has no subdomain awareness and is reached via a normal fixed API URL from the frontend.

## Auth & data flow

- **Sessions are per-subdomain, not shared.** No cookie-domain tricks, no cross-subdomain SSO. Logging into `nyaho.{domain}` and logging into `admin.{domain}` are entirely independent.
- **Tenant login** (`{slug}.{domain}/login`): login form submits the resolved slug alongside email/password. Backend resolves org by slug first, then only authenticates users whose `organizationId` matches that org. Wrong-org credentials return the same generic "invalid credentials" response as a wrong password — never reveal whether an org/slug exists via the login error.
- **Superadmin login** (`admin.{domain}/login`): only `SUPER_ADMIN` role accepted. Superadmin users cannot log into any tenant subdomain, and tenant users cannot log into `admin.{domain}` — full separation.
- **No implicit org fallback, anywhere.** The current bug ("org defaults to first org when `organizationId` is null") is removed entirely. Every authenticated request is checked: does this JWT's `organizationId` match the org that this subdomain resolved to? Mismatch → treated as unauthenticated for that context (redirect to that subdomain's login).
- **JWT shape is unchanged** (still carries `organizationId`) — this is additive: existing `/admin/*` pages and API calls keep working as-is. The new pieces are the login-time org-slug check and the per-request org-match check.

## Signup flow change

The registration wizard's final step, after creating the `Organization` record, redirects the browser to `https://{slug}.{domain}` (or `{slug}.localhost:{port}` in dev) instead of showing a static success screen. The slug is either user-chosen during the wizard (reusing/reconnecting the currently-disconnected "Organization Slug" field + "Generate" button already present in tenant Settings) or auto-generated from the org name with a numeric suffix on collision. Reserved-word and uniqueness validation run live as the user types, and are re-validated server-side on org creation (client-side validation is never trusted alone for something this load-bearing).

## Edge cases

- **Unknown tenant slug**: "Workspace not found" page, not a raw 404, with a link back to the marketing root domain.
- **Reserved-word collision at signup**: rejected client-side immediately with a clear message; re-validated server-side.
- **`/superadmin/*` hit on the wrong host**: redirect to `admin.{domain}`, preserving the attempted path, rather than 404ing — keeps bookmarks/links working.
- **Slug changed after signup**: old subdomain redirects to the new one (simplest correct behavior) rather than breaking every link/QR code already printed with the old subdomain. Not building slug history/expiry — flagged as a possible future concern, out of scope now.
- **Public flows unaffected**: `/join/:locationCode` and `/display/:locationId` already use globally-unique codes/IDs, not slugs. They stay reachable as-is (from any host) — not rewritten to live under the tenant's subdomain, since they already work well per the audit and touching them isn't needed for this goal.

## Testing plan

- Manual pass via the browse skill against local dev subdomains:
  - Root domain → marketing site.
  - `nyaho.localhost:{port}` → tenant login; only users belonging to that org can authenticate.
  - `admin.localhost:{port}` → superadmin login; only `SUPER_ADMIN` users can authenticate.
  - Cross-attempts (superadmin creds on tenant subdomain, tenant creds on admin subdomain) both fail with the generic invalid-credentials message.
- Reserved-slug rejection at signup, both client- and server-side.
- `/superadmin/*` direct-hit redirect to `admin.{domain}` from a non-admin host.
- Regression check: `/join/:locationCode` and `/display/:locationId` still work unchanged.
- Confirm the superadmin-sees-tenant-data bug (from the audit) no longer reproduces: log in as a superadmin, confirm no tenant dashboard data renders anywhere under `admin.{domain}`.

## Open items carried into implementation planning

- Exact reserved-slug list to finalize (starter list above, expand if needed).
- Whether the generic root-domain `/login` page should be removed/redirected entirely now that login is subdomain-scoped, or kept as a "find your workspace" helper page.
