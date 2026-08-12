# Visual Redesign — Design Spec

Status: Approved by user (2026-08-12), pending implementation plan.
Feeds from: `docs/superpowers/specs/audit-findings.md` (full audit that motivated this), `project-saas-redesign-initiative` memory (sub-project 4 of the SaaS redesign decomposition).

## Problem

The audit found a consistent "AI-slop" visual signature repeated across nearly every page: purple/indigo gradient accents, raw emoji used as icons, glowing-gradient CTA buttons, and a generic centered-icon-plus-CTA empty-state pattern repeated ~6 times. The marketing landing page additionally contains fabricated social proof (invented testimonials, fake stats, emoji "client logos"). Two screens — the public join/ticket-confirmation flow and the display board — are already well-executed, dark, and restrained, and should anchor the redesign rather than starting from zero. The app also has an unresolved naming inconsistency ("QMS" in-app vs "QueueFlow" on the landing page).

## Goals

1. Eliminate the AI-slop signature everywhere it appears: no more purple/indigo gradients as a default treatment, no raw emoji as icons, no glowing-gradient buttons, no fabricated social proof.
2. Settle product naming on **QueueFlow** across every surface (app chrome, sidebar, page titles, marketing page).
3. Establish one small shared component library so future pages don't re-introduce the same duplicated-inline-style pattern that produced the current inconsistency.
4. Preserve and lightly polish the two screens the audit already praised (join/ticket flow, display board) rather than rebuilding them from scratch.
5. Ship in independently-verifiable phases rather than one big-bang change, matching the convention set by the subdomain-multitenancy plan.

## Non-goals

- No functional/behavioral changes. This redesign changes how pages look, not what they do, what routes exist, or how data flows — same boundary the multi-tenancy spec drew for itself.
- No new automated test framework. This repo's existing convention (manual verification via `docker compose up` + the browse skill) continues to apply; visual changes are inherently manual-verification territory anyway.
- No CMS or real customer testimonials system. Fabricated social proof is removed outright; if real customer proof becomes available later, that's a follow-up, not part of this spec.
- No accessibility audit beyond what falls out naturally from using real icons with labels and sufficient color contrast in the new token set — a dedicated a11y pass is out of scope here.

## Product naming

**QueueFlow** becomes the name everywhere: sidebar/nav branding, `<title>` tags, page headers, the marketing landing page (already uses it), and any place currently hardcoded to "QMS" (e.g. `LoginPage.tsx`'s `logoText`). This is a small find-and-replace done as part of Phase 2 (see Rollout below), not a separate effort.

## Design tokens (`frontend/src/app/globals.css`)

- Replace the `--primary-50`…`--primary-900` purple/indigo scale with a teal scale (anchor: `--primary-500: #14b8a6`, i.e. promote the existing-but-unused `--accent-teal` token to be the primary brand color).
- Add an `--amber-50`…`--amber-600` scale, used only for "active/serving now" emphasis (current ticket being called, live queue status) — not a general secondary color.
- Remove `--gradient-primary` and `--shadow-glow` as general-purpose tokens used by buttons/cards/badges. Keep exactly one gradient token, `--gradient-ticket`, reserved for the hero ticket-number display on the display board and ticket-confirmation screen (the one place the audit's praised restraint still benefits from a moment of visual energy).
- Replace the `--font-sans` / `--font-display` two-family pairing with a single family: **Geist** (via the `geist` npm package, Next.js-native). One family everywhere — UI text and headings alike.
- Spacing, radius, shadow (non-glow), and the success/warning/error color scales are unchanged — they aren't part of the AI-slop signature and don't need touching.
- `.btn-primary`, `.btn-success`, `.card-hover`'s translateY-on-hover, and `.ticket-number-display`'s gradient-text treatment are updated to match (flat colors for buttons/cards; gradient-text treatment stays only on the ticket number itself).

## Icon system

Replace all raw emoji icons (🏢💉👨‍⚕️💰💊🔬📧🔌💡📍⚙️📋✅✉️🔔📱⚡🔒🏪🎓 etc.) with **Lucide** (`lucide-react`, new dependency — open-source, tree-shakeable, consistent single-weight stroke icons, no license cost). Icon choice per use-site is an implementation-time judgment call (pick the closest semantic match: e.g. `Building2` for organization, `Stethoscope` or `Activity` for medical service points, `Mail` for invites, `Lightbulb` for tips) — no need to pre-enumerate every mapping in this spec.

## Shared component library (`frontend/src/components/ui/`)

New directory, five components, each a thin wrapper matching the token system above:

- **`Button`** — `variant: 'primary' | 'secondary' | 'ghost'`, `size: 'sm' | 'md' | 'lg'`. Primary is solid teal, no gradient, no hover-glow — replaces the current `.btn-primary`/`.btn-success` gradient treatment.
- **`Card`** — flat background (white in light contexts, `--gray-800`-equivalent in dark contexts), single subtle border, no hover-lift by default (an explicit `hoverable` prop opts in where genuinely useful, e.g. clickable list items).
- **`Badge`** — `tone: 'primary' | 'success' | 'warning' | 'error' | 'neutral'`, flat color-on-tint (e.g. teal text on teal-50 background) — replaces the current bright/gradient badge styles. Used for queue status, subscription plan tags, superadmin org status.
- **`EmptyState`** — `icon`, `title`, `description`, optional `action`. Directly replaces the empty-state JSX currently duplicated across `AdminLocationsPage.tsx`, `AdminQRPage.tsx`, `AdminSettingsPage.tsx`, `AnalyticsPage.tsx`, `DashboardPage.tsx`, `app/admin/flow-designer/page.tsx`, `app/admin/service-points/page.tsx`, and `QueueManagementPage.tsx` — the exact 8-file duplication flagged as a follow-up after the multi-tenancy merge.
- **`PageHeader`** — `title`, optional `subtitle`/breadcrumb, optional right-aligned actions slot. Replaces the purple gradient banner currently repeated across ~10 admin pages plus the dashboard — the audit's single most consistent, most fixable pattern.

Every redesigned page imports from this directory instead of hand-rolling inline `style={}` objects for these five patterns. Pages may still use local inline styles for genuinely page-specific layout — the shared library targets only the patterns that were being copy-pasted, not a full component-per-element rewrite.

## Landing page

Full rebuild on QueueFlow branding using the new component set:

- Hero: clear value proposition, no fabricated stats.
- Feature highlights: grounded in real, shipped capabilities (subdomain-per-tenant workspaces, real-time queue updates, QR-code join flow, display boards) rather than generic SaaS feature-card copy.
- "How it works": specific to queue management (e.g. "Create a location → Configure services → Share a join link/QR → Manage the queue live"), not a generic numbered-step template.
- Single clear CTA to the registration wizard.
- **No testimonials, no "trusted by" logos, no unverifiable stats section.** Removed outright per the fabricated-content finding — not replaced with placeholders, not marked "illustrative." If real customer proof exists later, that's a separate follow-up.

## Screens preserved, lightly polished

**Public join/ticket-confirmation flow** and **display board**: layout, structure, and dark restrained aesthetic are kept as-is. The only changes are (a) swap the "Normal / Kiosk / Multi-Ticket" segmented control and glowing-gradient "Join Queue →" button to the new flat `Button` component (the one AI-slop tell the audit found on an otherwise clean page), and (b) confirm color tokens resolve to the new teal/amber scale instead of hardcoded purple hex values, if any are hardcoded rather than token-driven.

## Rollout order

Phases are independently shippable and verifiable, matching the multi-tenancy plan's convention of manual verification via `docker compose up` + the browse skill rather than a new test framework:

1. **Foundation** — token updates in `globals.css`, `geist` + `lucide-react` installed, the five `ui/` components built with no consumers yet (verify via a throwaway style-guide page or Storybook-free visual smoke check).
2. **First impressions** — landing page rebuild, register wizard, login page (including the "find your workspace" root-login state added during the multi-tenancy work) — these are what a new visitor or returning tenant sees first, and also where the QueueFlow rename is most visible.
3. **Tenant app** — dashboard + all `/admin/*` pages (locations, services, service points, flow designer, QR codes, invites, data sources, settings, analytics, queue management). Largest page count; every one currently repeats the purple-banner + emoji-icon pattern, so this phase is where `PageHeader`/`EmptyState`/`Icon` adoption pays off most.
4. **Superadmin panel** — dashboard, organizations list/detail, plans. Keeps its own dark navy/indigo-adjacent theme concept from the audit (a deliberate "different context" signal) but re-themed onto the new teal accent and flat-component system instead of the current purple-under-the-hood treatment, with real icons replacing the emoji stat tiles.
5. **Public-screen polish** — the two already-good screens get their icon/button touch-up (described above) last, since they need the least work and lowest risk of regression.

## Testing plan

- No new automated test framework (matches this repo's existing convention).
- Per phase, manual verification via the browse skill against the running dev stack (`docker compose up`):
  - Screenshot each redesigned page before/after.
  - Confirm no emoji remain where a Lucide icon was substituted.
  - Confirm no purple/indigo hex values or `--gradient-primary`/`--shadow-glow` usages remain outside the reserved `--gradient-ticket` use.
  - Confirm empty states render through the shared `EmptyState` component (spot-check at least 3 of the 8 previously-duplicated sites).
  - Spot-check responsive breakpoints on the landing page, join flow, and display board (the three screens most likely to be viewed on varied devices — marketing visitors, public queue-joiners, and TV boards respectively).
- Regression check: confirm no functional behavior changed — forms still submit, navigation still works, data still loads — since this spec's non-goal is explicitly "look, not behavior."

## Open items carried into implementation planning

- Exact Lucide icon chosen per use-site (semantic mapping is an implementation-time judgment call, not pre-specified here).
- Whether the superadmin panel's "different context" dark theme needs its own small token subset or can reuse the public-screen dark tokens as-is — worth confirming once Phase 4 starts and the superadmin pages are looked at directly.
- Geist font licensing/self-hosting vs `next/font` loading approach — default to the `geist` npm package's documented Next.js integration; revisit only if it doesn't work cleanly in this app's Next 15 setup.
