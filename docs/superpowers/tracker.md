# Work Tracker

Living checklist, updated in place as work lands. `[x]` done, `[ ]` open, `[~]` in progress.
Branch: `arch-review-fixes`. Origin: architecture review of 2026-09-25.

## Batch 1: Security and build fixes

- [x] Tenant isolation: every resource route checks the caller's org (queues, locations, services, service points, instances, flows, analytics, data sources, field mappings, appointments, notifications, users, invites) via `middleware/tenantScope.middleware.ts`; verified live by `tests/tenant-isolation-smoke.js`
- [x] `GET /users` scoped to the caller's org (was returning every tenant's users)
- [x] Role escalation: `createUser`/`updateUser` cannot grant a role above the caller's; org is forced to the caller's org
- [x] Invite registration crash + public invite preview (`/public/invites/:code`) + accept-invite UI on `/register?invite=` (verified in browser: invite → account → tenant login → dashboard)
- [x] Stripe v22: renewal/failure webhooks read the subscription ID from `invoice.parent.subscription_details`
- [x] Backend `tsc --noEmit` clean (13 errors)
- [x] Frontend `tsc --noEmit` clean (3 errors fixed)
- [x] JWT secret: no hardcoded fallback in production; one source of truth
- [x] One-time codes stored in the DB instead of process memory
- [x] Rate limiting on login, OTP, public join (DB-backed so it works serverless)
- [x] Data-source credentials encrypted at rest and masked on read
- [x] Single shared Prisma client (auth controller had its own)
- [x] Encryption tests pass without a manually set `MASTER_ENCRYPTION_KEY`

- [x] Org signup trusted a client-sent `emailVerified` flag; now verified + consumed server-side
- [x] Three different JWT fallback secrets unified in `lib/jwt.ts`; production refuses weak/default secrets
- [x] Deactivated users could still log in
- [x] CORS allowed every origin; now root domain, subdomains, `ALLOWED_ORIGINS`, verified custom domains
- [x] `updateService` mass assignment (could repoint `locationId` to another org)
- [x] Error handler leaked internal error messages in production
- [x] `REGISTRATION_MODE=open` removed (let anyone self-assign any role); registration is invite-only
- [x] Invites: 128-bit codes, 7-day default expiry, atomic claim, role capped by inviter's role
- [x] Failed sign-in reloaded the page (global 401 redirect) so the error never showed

## Batch 2: PRD gaps

- [x] Appointments: backend fixed (future-date slots, atomic booking, double-cancel guard, check-in via real ticket sequence, patient search) + `/appointments` page (book with patient search or new patient, reschedule, cancel, check in); verified in browser
- [x] "Send to next service": `POST /queues/:id/entry/:entryId/transfer` + Complete-modal buttons wired (auto-transfer alert replaced with inline notice)
- [x] Turn-approaching / now-serving / joined notifications fired from the queue flow (once per entry+type; threshold per org)
- [x] Email + SMS channels (Twilio via env; console in dev), metered with EMAIL/SMS credits
- [x] Notification settings UI: Settings → Notifications tab
- [x] Forgot-password / reset-password flow (`/forgot-password`, `/reset-password`; single-use 1h tokens, link goes to the user's own subdomain; verified via Mailpit)
- [x] `/privacy` and `/terms` pages (describe what the product actually does; operator must add legal entity + `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`)
- [x] Audit log backend (`AuditLog`, `GET /orgs/:id/audit-logs`) for join/call/serve/cancel/no-show/transfer/reorder/status + appointments
- [x] Audit log page (`/admin/audit-log`, org admins)
- [x] Outbound webhooks backend: signed (HMAC-SHA256), retried with backoff via `/cron/frequent`, SSRF-guarded; verified by `tests/queue-flow-smoke.js`
- [x] Webhooks UI (`/admin/integrations`): add/edit/enable/test/rotate secret/delivery log
- [x] Display board: "Display not found" state for an invalid code/ID, polling stops

- [x] Customer journeys were never created (Journeys analytics always empty); now start on join, extend on transfer, close when done
- [x] Transfers never set `previousEntryId` ("total transfers" always 0); auto-transfer in markServed dropped session/sortOrder
- [x] `callNext` ignored manual reordering (`sortOrder`); one shared waiting order everywhere
- [x] Three different queue-position formulas unified (`computePosition`)
- [x] `waitDuration` / `serviceDuration` now recorded (analytics + AI need them)
- [x] Data-source fetches and webhooks blocked from private network addresses (SSRF)

## Batch 3: Single deployment (Next.js + Vercel)

- [x] Backend moved into the Next app (`frontend/src/server`); Express served from `src/pages/api/v1/[...path].ts`; `backend/` removed
- [x] Socket.IO replaced with Pusher-protocol real-time (Soketi locally, Pusher/Ably in prod). Payloads reduced to IDs/statuses (no PII), so channels can stay public; events flushed before the response ends; polling fallback when unconfigured. Verified by `tests/realtime-smoke.js`
- [x] API client uses same-origin `/api/v1` (`lib/apiBase.ts`); obsolete `NEXT_PUBLIC_API_URL` lines in local `.env` files commented out
- [x] Middleware runs on the Node runtime and resolves tenants from the DB (60s cache); `/api` and static files excluded
- [x] Custom domains attach to the Vercel project via the Domains API when `VERCEL_TOKEN`/`VERCEL_PROJECT_ID` are set; verify uses Vercel's DNS/cert check
- [x] `vercel.json` (build runs migrations, crons, function duration), Prisma `rhel-openssl-3.0.x` target, `.env.example` rewritten, `docs/DEPLOYMENT.md`
- [x] docker-compose: one `app` service + Soketi + Mailpit
- [x] Production Dockerfile (Debian slim, standalone, migrations on start) built and booted
- [x] Redis removed

- [x] `next build` passes (fixed nullable navigation hooks once a `pages/` dir exists)
- [x] Checkout success/cancel URLs pointed at the root domain (users came back signed out); now return to the tenant origin
- [x] Data-source router's router-level auth turned every unknown API path into a 401
- [x] `create-superadmin.js` refuses default credentials in production
- [x] README rewritten for the single-app layout

## Batch 4: AI layer

- [x] LLM-agnostic provider layer (`server/services/ai`): Anthropic (default `claude-opus-5`, adaptive thinking, server-side refusal fallback), OpenAI, Gemini, any OpenAI-compatible endpoint; superadmin **AI Providers** page (key encrypted, one active, test button); env fallback (`AI_PROVIDER` + key)
- [x] Gating: plan `ai` feature + org toggle (Analytics page) + 1 AI credit per question/digest; rate limited
- [x] "Ask your data" panel on Analytics: 8 org-scoped aggregate tools, answers stored with their source numbers ("Show the numbers"). Verified end to end through the UI with a scripted OpenAI-compatible mock
- [x] Daily AI digest (`/cron/daily`), stored + emailed to org admins; shown on the Analytics panel
- [x] Statistical wait forecast (`/ai/forecast/:serviceId`, also an AI tool): median service time × people waiting ÷ active desks, arrivals by weekday/hour
- [x] Live wait-spike alerts on the Queues page (statistical; no provider needed)

- [x] Appointment reminders for tomorrow (`/cron/daily`, email/SMS per org settings, once per appointment)
- [ ] Live AI call not verified with a real vendor key in this session (no key available) — run **Test connection** on AI Providers after adding one
- [ ] Wait forecast could replace the naive estimate shown on public ticket/status pages

## UI pass (as pages are touched)

- [~] Headed-browser pass so far: invite, forgot/reset password, login, dashboard, appointments, audit log, integrations, settings, analytics, display 404, privacy, superadmin AI providers + payment providers. Not yet walked: services, locations, service points, flow designer, QR, data sources, billing, join/status/display (happy path), superadmin orgs/plans
- [x] New shared `AuthShell` (dark bg, single card) for invite / forgot / reset pages
- [x] Emails: shared flat-teal layout replaces purple-gradient + emoji header
- [x] Login page: solid hero heading; layout collapses to one column under 900px
- [x] Login page `/join` dead link → `/locations`
- [ ] Receptionist dashboard shows a "Generate QR" header button for a page they can't open
- [x] Tenant app main column had no `min-width: 0` → wide tables pushed the whole page sideways
- [x] Settings tabs wrapped onto two lines at laptop widths
- [x] Settings save failed for every org without the customBranding feature (always sent branding fields)
- [x] Analytics: removed a hardcoded "+12%" trend badge (fabricated number)
- [ ] Sidebar: Services and Settings share the same gear icon
- [ ] Sidebar now has 15 items — group into sections (Operations / Setup / Admin)
- [ ] Shared `RequireRole` guard exists; ~15 older page wrappers still copy the guard logic

## Improvements noticed (not yet scheduled)

- [ ] Plan editor feature keys (`multipleLocations`, `emailNotifications`…) don't match backend feature keys (`multiLocation`, …) — some plan toggles do nothing
- [ ] `INIT_SYSTEM_NOW.js` (repo root) scaffolds the old two-app layout; delete it
- [ ] `npm audit` reports vulnerabilities in the merged dependency tree — review

- [x] AI tools return aggregates + service/location names only (enforced in `ai/metrics.ts`)

- [ ] Dates are server-timezone based (`getStartOfDay`); `Location.timezone` is ignored
- [ ] SMS provider configured by env only; could get a superadmin UI like payment providers

- [ ] `DataSource.config.headers` values aren't encrypted (only `auth.token/password/apiKey` are)
- [ ] README still documents `REGISTRATION_MODE`
- [ ] Old plaintext data-source secrets get encrypted only on next save (no backfill script)

- [ ] Slug change in Settings silently locks the admin out (no redirect to the new subdomain)
- [ ] "No organization" empty-state JSX duplicated across ~8 pages
- [ ] Replace `alert()` error handling with inline/toast errors
- [ ] Delete temp `superadmin@qms.local` dev account before any non-dev use
- [ ] Real-money Stripe/Paystack checkout verification with test-mode keys
