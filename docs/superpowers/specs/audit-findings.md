# Queue Management SaaS — Design & Functionality Audit

Living document. Updated in place as pages are reviewed. Not a spec — this feeds the specs for redesign, multi-tenancy, and billing work.

Started: 2026-08-11

## Legend
- 🎨 Design/AI-slop issue (generic layout, default shadcn look, poor hierarchy, spacing, etc.)
- 🐛 Broken/non-functional
- ⚠️ Partially functional / unclear behavior
- 🧩 Missing feature entirely (needed for SaaS scope: subdomains, billing, payment config)

## Environment
- Frontend: http://localhost:8003
- Backend: http://localhost:8004/api/v1
- Tenant login: harrisyn@gmail.com / 12345678
- Started via `docker-compose up`

## Pages Reviewed

### Marketing landing page (`/`)
🎨 **Textbook AI-slop SaaS template.** Dark navy background, purple/violet gradient accent color used identically to thousands of AI-generated landing pages. Emoji used as icons everywhere (🏥🏦🏛️🏪🎓 as "trusted by" client logos, ⚡📱📊🔔🏢🔒 as feature icons) instead of a real icon set or actual customer logos.
🎨 Fabricated social proof: "Trusted by 500+ organizations", "50K+ Customers Served Daily", "45% Average Wait Time Reduction", "99.9% Uptime Guarantee", "4.9★ Customer Rating" — all unverifiable/fake stats with no source.
🎨 Fake testimonial ("James Wilson, Operations Director, TechServe Inc" / "Dr. Sarah Chen, Chief Medical Officer, Metro Health Center") — invented quotes, invented people, invented companies.
🎨 Generic "3 simple steps" numbered-card section and gradient CTA banner — boilerplate SaaS-template structure, not specific to queue management or this product's actual differentiators.
🎨 Product name is "QueueFlow" in the landing page but the app/repo is "queue-management" — inconsistent branding, no real product name decided yet.
🧩 No mention anywhere of subdomain-per-tenant signup flow, pricing tiers actually matching `SubscriptionPlan` data, or how a visitor gets from "Get Started Free" to a live tenant subdomain.
Screenshot: landing.png

### Tenant dashboard (`/`, post-login)
🎨 Generic admin-template look: purple gradient header banner, pastel rounded-square emoji icons for stat cards (📍⚙️📋✅), "Welcome back, Harrison! 👋" wave-emoji greeting, yellow "💡 Pro Tip" banner. Same visual language as thousands of shadcn/Tailwind AI-scaffolded dashboards — no distinct brand identity.
🎨 Quick Action cards use raw emoji (📋⚙️📍✉️🏢📊) as icons instead of a real icon set.
🐛 **Backend bug, confirmed via logs**: every authenticated page fires `GET /api/v1/subscription` → 500. Root cause: `backend/src/middleware/subscription.middleware.ts:280` calls `prisma.organizationSubscription.findUnique({ where: { organizationId } })`, but the schema (`OrganizationSubscription` model) has no `organizationId` field — the FK actually lives on `Organization.subscriptionId` pointing the other way, with `OrganizationSubscription.organizations` as the (potentially multi-org) back-relation. This is a schema/code mismatch from the recent subscription-model migration. **This breaks all subscription/feature-limit checks app-wide and blocks the tenant pricing page work**, since `getMySubscription`, `loadSubscription`, `checkLimit`, `enforceLimit`, `getOrganizationFeatures` in that file all use the same broken query pattern.

### Queue Management page (`/queues`)
🎨 Purple gradient header banner repeated (same pattern as dashboard) — consistent but generic/templated.
⚠️ "No service desks linked to this service" warning + disabled "Call Next" button + "Please select a service desk above to start calling customers" — functional but the setup dependency (must link a service desk before calling customers) isn't explained anywhere in onboarding; easy to hit as a dead end.
Screenshot: dashboard.png, queues.png

### Services / Locations / Service Points / Flow Designer / QR Codes / Invites / Data Sources / Settings (all `/admin/*`)
🎨 Consistent AI-slop visual language across every one of these: purple gradient page-header banner, white rounded-2xl cards, raw emoji as icons (🏢💉👨‍⚕️💰💊🔬 for service point types; 📧/✉️ envelope for invites-empty-state; 🔌 plug for data-sources-empty-state; 💡 yellow tip banners repeated on QR Codes page too). This is the single most consistent, fixable pattern across the whole app — same template repeated ~10 times.
🎨 Empty states ("No invites yet", "No data sources configured", "No flow connections defined") are all the same generic centered-icon-plus-CTA pattern — fine functionally, just visually generic.
✅ Not broken: Service Points, Flow Designer, QR Codes (QR image renders correctly, false alarm on first check — was mid-render), Invites, Data Sources, Settings all load and function correctly once hit via their real `/admin/*` routes.
🧩 **Settings → General already has an "Organization Slug" field with a "Generate" button** — this is a half-built foundation for subdomain-per-tenant routing (`nyaho.{domain}`). Worth checking during the multi-tenancy spec whether this slug is actually wired to anything yet, or just a UI stub.
🎨 Analytics page header appeared to render with a faded/ghosted icon and semi-transparent subtitle text in one screenshot — likely just a loading-skeleton frame caught mid-paint, not confirmed as a real bug. Re-check during redesign work.

⚠️ **Testing note**: sidebar links are all correctly under `/admin/*` (`/admin/locations`, `/admin/service-points`, `/admin/flow-designer`, `/admin/qr`, `/admin/invites`, `/admin/data-sources`, `/admin/settings`). Guessing bare paths like `/servicepoints` or `/flow-designer` hits the `[orgId]` dynamic catch-all route and renders a false "Organization Not Found" page — that was a testing artifact, not an app bug, but it does reveal that `/[orgId]` has no guard against colliding with reserved words, which matters once real org slugs are used in subdomains (see audit note above on restricted-subdomain handling).

Screenshots: admin-locations.png, admin-service-points.png, admin-flow-designer.png, admin-qr.png, admin-invites.png, admin-data-sources.png, admin-settings.png, analytics.png

### Superadmin panel (`/superadmin`, `/superadmin/organizations`, `/superadmin/organizations/:id`, `/superadmin/plans`)
No superadmin account existed in the dev DB — created a temporary test account (`superadmin@qms.local` / `12345678`, role `SUPER_ADMIN`, no org) directly via Prisma for this audit. Flagging in case it should be removed before this DB is used for anything real.
🐛 **Cross-tenant data exposure on login**: a `SUPER_ADMIN` user with no `organizationId` who logs in and lands on `/` (the normal post-login redirect) is shown a full tenant dashboard — "Managing Nyaho Medical Center" — with real org data (locations, services, queue counts), not an empty state or a prompt to pick an org. This means the regular tenant app shell doesn't actually check whether the logged-in user belongs to the org it's displaying; it appears to default to "first org" (or similarly permissive fallback) when `organizationId` is null. **This needs to be fixed as part of the multi-tenancy/subdomain design** — a superadmin (or any user without an org) should never silently render another tenant's dashboard. Worth checking whether this also affects `PATIENT`-role guest users who somehow end up without a valid org scope.
✅ **Resolved by the subdomain multi-tenancy work (2026-08-11/12 plan)**: login is now subdomain-scoped — tenant login only succeeds for users whose `organizationId` matches the org resolved from the subdomain, and `SUPER_ADMIN` accounts can only authenticate via the dedicated `admin.{domain}` login, landing on the superadmin dashboard rather than any tenant's app shell. Verified end-to-end in Task 11 (this plan's final verification pass): a superadmin logging in on `admin.localhost` sees only the superadmin org list/metrics, no tenant queue/service/location data from any specific org; an org-scoped user cannot log in on a different org's subdomain; an unknown subdomain shows a "Workspace not found" page instead of falling through to any tenant's data. The specific cross-tenant leak described above no longer reproduces.
🎨 Superadmin panel uses a distinct dark navy/indigo theme from the light tenant app — good instinct (visually signals "you're in a different context"), but it's the same purple-accent AI-template look underneath, and dashboard stat tiles still use raw emoji icons (🏢✅💰📍👥) and a green "$0.00 Monthly Revenue" money-bag emoji tile.
✅ Organizations list, search/filter controls, and the org detail drill-down (`/superadmin/organizations/:id`) all work: shows org details, usage stats, linked locations, and full user list with roles. "Delete Organization" danger-zone action present and appropriately styled as destructive.
🧩 **No way to assign/change a subscription plan for an org from the detail page** — "Subscription" panel just says "No active subscription" with no action to attach a plan. The `updateOrganizationSubscription` endpoint already exists server-side (`PATCH /superadmin/organizations/:id/subscription`), so this is a frontend gap, not a missing backend capability.
🧩 **No payment-provider configuration UI anywhere** (no Stripe/Paystack key entry, no toggle to enable/disable a provider) — confirms this is a from-scratch feature for the billing spec, not a partially-built one.
🧩 Organization has an empty `SLUG` field shown as "—" — confirms the org-slug-to-subdomain wiring doesn't exist yet even though the tenant Settings page has a slug generator UI stub (see tenant findings above).
🧩 Subscription Plans page (`/superadmin/plans`) is fully empty ("No subscription plans created yet") — didn't test plan creation in this pass since it risks polluting the plan the redesign work will need to define anyway; flagging that create/edit plan forms should be walked as part of the billing spec, not assumed to work.

### Public join flow (`/join/:locationCode`) and ticket confirmation
✅ **Best-executed screens in the app.** Dark background with subtle dot-grid pattern, clean centered card, bold ticket number ("C002" in large purple type), dotted progress indicator, clear "Position #2 / Est. Wait ~30 min" stat pair. Functional end-to-end: selected service → filled form → got a real ticket → confirmation screen with "Track My Position" / "Get Another Ticket". Use this screen's restraint as a visual anchor for the redesign rather than starting from zero.
🎨 Minor: "Normal / Kiosk / Multi-Ticket" segmented control and glowing-gradient "Join Queue →" button are the one AI-slop tell on an otherwise clean page.
⚠️ Form field order is odd: Phone Number → Last Name → MR Number → First Name. Last name before first name (and MR Number sandwiched between them) reads like fields were added in schema order rather than a considered UX order.

### Display board (`/display/:locationId`)
✅ Functional, purpose-built dark TV-board design (queue name, serving/waiting/wait-time pills, "Next up" ticket chips, live clock) — another good anchor for the redesign, not generic-looking.
🐛 Passing an org ID instead of a location ID (easy mistake — the route is `[locationId]` but nothing in the UI clarifies which ID type is expected) leaves the page stuck forever on "Loading display..." with no error state or timeout. Low severity but worth a not-found/invalid-id state during redesign.

### Registration wizard (`/register`)
🎨 4-step wizard ("Details → Contact → Verify → Secure"), dark theme, glowing gradient "Continue →" button, subtle starfield/dot background — same AI-slop signature button treatment as elsewhere.
🧩 **Directly relevant to the subdomain requirement**: this is where a new tenant signs up, but nothing here (or anywhere in the app) creates or assigns a subdomain today. This is the natural integration point for the multi-tenancy spec — signup should end with "your queue system is live at `{slug}.{domain}`," not just an org record.
Did not complete the full 4-step flow in this pass (would create throwaway org data) — worth walking end-to-end when scoping the multi-tenancy spec.

## Cross-Cutting Themes

1. **One repeated AI-slop signature, used everywhere**: purple/indigo gradient accent, raw emoji as icons instead of a real icon set, glowing-gradient CTA buttons, fabricated social proof on the landing page, generic empty-state pattern (centered icon + heading + CTA) repeated ~6 times. Fixing the icon system and the gradient-button/badge treatment once would visually fix most pages at once.
2. **Two genuinely well-executed screens already exist** (public join/ticket confirmation, display board) — both dark, purpose-built, restrained. These are better redesign anchors than the marketing landing page or admin dashboard.
3. **The subscription-fetch 500 fires on almost every authenticated page** (`subscription.middleware.ts:280`, schema/code field mismatch) — this is a pre-existing bug, not something the redesign introduces, and it blocks any subscription-aware UI (upgrade prompts, plan badges) from working today.
4. **Superadmin showed tenant data to an org-less superadmin by default** — an authorization gap that needs to be closed before subdomain-based tenant isolation is designed, or it'll get baked into the new routing.
5. **Billing is a fully greenfield feature**: no payment-provider config UI, no plan-assignment UI, no tenant pricing page anywhere — matches what the Prisma schema/superadmin routes suggested going in.
6. **Subdomain groundwork exists but is disconnected**: tenant Settings has an org-slug field + "Generate" button, org detail in superadmin shows a (currently empty) slug — but nothing resolves a subdomain to an org yet, and the `/[orgId]` dynamic route has no guard against reserved words (`admin`, etc.), which matters once `admin.{domain}` needs to be an off-limits tenant slug.

## Open Questions / Decisions Needed

1. Product name: is it staying "QMS" (used in the actual app chrome) or "QueueFlow" (used only on the marketing landing page)? Needs to be decided before the redesign so both surfaces agree.
2. Should the `subscription.middleware.ts` bug be fixed as a quick standalone patch now, or folded into the billing spec since that spec will likely redesign the subscription data flow anyway?
3. Delete the temporary `superadmin@qms.local` test account before this DB is used for anything beyond local dev audit work (created 2026-08-11 for this audit, password `12345678`). **Still open as of Task 11 verification (2026-08-12)** — the account remains in the dev DB and was reused for this task's superadmin login checks; not deleted since dev testing is still ongoing, but this must happen before any non-dev use.
