# Service Creation Wizard + Org-Level Service Points — Design

## Problem Statement

Today `ServicePoint` (a physical desk resource like "Reception" or "Consultation Room") belongs to exactly one `Location`. Creating the same kind of desk at a second location means recreating it from scratch and re-linking it to services there — there's no shared, organization-wide notion of "the service points we have." `Service` creation is a single flat modal with no concept of applying the same service to multiple locations at once, and there's no guided way to pick which service points staff a new service or how many desks each gets.

This spec covers restructuring `ServicePoint` into an org-level definition, moving desk-instance ownership onto the (service point × service) assignment, and replacing the flat "Add Service" modal with a wizard that creates a service (optionally at every location at once) and assigns service points/desks to it in the same flow.

## Goals

- `ServicePoint` becomes an organization-level definition (name, type, default desk count), assignable to services at any of the org's locations.
- Desk count is set per (service point, service) assignment — the same service point can have a different desk count at two different services, even at the same location.
- Adding a service is a guided wizard: basic info → target location(s) → schedule → service points & desks → review.
- A service can be created for one specific location or for every location in the org in one step, sharing the same name and configuration. Each created copy is then independently editable (per earlier design discussion: only the name is treated as shared/grouping — everything else, including schedule and desk assignment, can diverge after creation).
- Editing an existing service reuses the same schedule + service-points/desks building blocks as the wizard, without the location-picking step.

## Non-Goals

- `Service` itself does **not** become a shared multi-location record. It stays exactly as it is today: one row per location. The wizard is a convenience that creates several such rows in one step; it does not introduce any new relationship for `Queue`, `Appointment`, `ServiceFlow`, or analytics to resolve.
- No automatic merging of duplicate service-point definitions created before this migration (e.g. two locations that both separately created a "Reception" service point become two separate org-level definitions after migration; consolidating them is a manual cleanup, not part of this work).
- No inline "create a new service point definition" step inside the wizard for this iteration — if the desired service point doesn't exist yet, the user creates it first on the Service Points page, then runs the wizard. (Noted as a reasonable future enhancement, not required now.)

## Data Model

### `ServicePoint` (org-level definition)

```prisma
model ServicePoint {
  id             String   @id @default(uuid())
  organizationId String                          // was: locationId
  name           String
  displayName    String?
  type           ServicePointType @default(OTHER)
  isActive       Boolean  @default(true)          // enable/disable the definition itself
  capacity       Int      @default(1)             // default desk count, prefilled in the wizard; not authoritative
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  services       ServicePointService[]

  @@index([organizationId, isActive])
}
```

Drops `locationId`, the direct `entries` relation, and the direct `instances` relation (desks move under `ServicePointService`, see below).

### `ServicePointService` (the assignment — existing model, one behavior change)

Unchanged shape, except `capacity` becomes **required** (currently nullable/optional-override). It is now the single source of truth for how many desks this service point provides for this specific service — always set explicitly when the wizard or edit flow links a service point to a service, prefilled from `ServicePoint.capacity`.

### `ServicePointInstance` (physical desks — re-keyed)

```prisma
model ServicePointInstance {
  id                    String   @id @default(uuid())
  servicePointServiceId String                          // was: servicePointId
  instanceNumber        Int
  displayName           String?
  isActive              Boolean  @default(true)
  isOccupied            Boolean  @default(false)
  occupiedByUserId      String?
  occupiedAt            DateTime?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  servicePointService    ServicePointService @relation(fields: [servicePointServiceId], references: [id], onDelete: Cascade)
  occupiedBy             User? @relation("OccupiedInstances", fields: [occupiedByUserId], references: [id], onDelete: SetNull)
  servingEntries         QueueEntry[] @relation("InstanceServingEntries")

  @@unique([servicePointServiceId, instanceNumber])
  @@index([servicePointServiceId, isActive])
  @@index([occupiedByUserId])
}
```

Drops `currentServiceId` — redundant once the instance's service is implied by `servicePointService.serviceId`. `syncInstancesForServicePoint` (added in the earlier service-desk bug fix) becomes `syncInstancesForServicePointService(servicePointServiceId)`, sizing instances off `ServicePointService.capacity`.

### `Service`

No schema changes.

### `QueueEntry`

The legacy direct `servicePointId` FK (used only as a fallback alongside `servicePointInstanceId`) is dropped. `callNextWithServicePoint` and the display-board "currently serving" query (`getActiveServicePoints`) are rewritten to always resolve through `servicePointInstanceId → servicePointService → servicePoint`, which is now the only path and is simpler than the dual-path logic that exists today (the instance-to-service link is now structurally guaranteed, so the manual "is this service point linked to this service" cross-check in `callNextWithServicePoint` is removed as dead weight).

## Migration

Mechanical, since every existing `ServicePoint` already belongs to exactly one location (and therefore one org):

1. **`ServicePoint`**: add `organizationId`, backfill from `location.organizationId` via the existing `locationId`, then drop `locationId`.
2. **`ServicePointService.capacity`**: backfill any `NULL` from the linked `servicePoint.capacity`, then make the column required.
3. **`ServicePointInstance`**: re-point each existing instance from `servicePointId` to the matching `ServicePointService` row — resolved via `instance.currentServiceId` if set, else the first (only, in current data) service link for that service point. If a service point has zero service links, its orphan instances are deleted (logged with a count) since they have nowhere to attach.
4. **`QueueEntry.servicePointId`**: for historical rows, backfill is unnecessary for display purposes (the field is being dropped entirely and nothing reads it going forward); the column is simply dropped after confirming (during implementation) that no other call site outside `callNextWithServicePoint`/`getActiveServicePoints` reads it directly.

Written as an explicit, inspectable SQL migration (via `prisma migrate diff` + manual review), matching the pattern used for the payment-provider migration.

## API Changes

**Service Points (org-level CRUD)**:
- `GET /service-points/organization/:organizationId` replaces `GET /service-points/location/:locationId`.
- `POST /service-points`, `PATCH /service-points/:id`, `DELETE /service-points/:id` — same shape, `organizationId` instead of `locationId` in the body. Delete is blocked if the definition has any active service links, in addition to the existing "can't delete while serving" check.

**Service point ↔ service links**: `POST /service-points/link` and `PATCH /service-points/link/:linkId` now require `capacity` in the body. Both auto-run instance sync (create/deactivate desk instances to match the new count) — the standalone `/instances/sync` route is removed since sync is no longer a separate manual step.

**Desk lookup for the Queue Management desk selector** (`GET /service-points/service/:serviceId/instances`): no contract change. It already resolves through `ServicePointService`; only the internal query shape changes.

**Display boards** (`GET /service-points/location/:locationId/active`): no contract change. Internals scope through `Service.locationId` (unchanged) instead of the old `ServicePoint.locationId`.

**Service creation**: `POST /services` (replacing the nested `POST /locations/:locationId/services`, whose only caller — the current "Add Service" modal — is being replaced) accepts:
```
{
  name, description, type, requiresName, requiresPhone, allowAnonymous, displayMode,
  slotDuration, concurrentLimit, activeDays, startTime, endTime, isActive,
  locationIds: string[],                              // one or many
  servicePoints: [{ servicePointId, capacity }]        // applied identically to every created service
}
```
Loops over `locationIds`, creating one `Service` row per location with identical field values, then creates the requested `ServicePointService` links (with instance sync) for each. Wrapped in a transaction — a bad service-point pick or a subscription-limit violation on any target location rolls back the whole request rather than leaving a partial set of services behind. The existing `enforceLimit('services')` check is adapted to check `current count + locationIds.length` against the plan limit up front.

**Service edit** (`PATCH /services/:id`): extended to accept the same `servicePoints` array, reconciling links (add/update-capacity/remove, re-syncing instances) — this is what the "Edit Service" panel uses.

**Nested `GET /locations/:locationId/services`**: unchanged (still used to list a location's services).

## Frontend

**Service Points admin page** (`/admin/service-points`): drops the location selector entirely — becomes an org-wide list of definitions (name, type, default capacity, and a "used in N services" count derived from linked `ServicePointService` rows). Create/edit is a simple modal (name, displayName, type, default capacity); linking to services no longer happens here — that moves into the service wizard/edit flow.

**Add Service wizard** (new, replaces the current flat modal on `/services`):
1. **Basic Info** — name, description, type, ticket rules (requiresName/Phone, allowAnonymous, displayMode).
2. **Location(s)** — choose one specific location, or "all locations" (every location in the org).
3. **Schedule** — activeDays, startTime, endTime, slotDuration, concurrentLimit, isActive. Applies identically to every location chosen in step 2.
4. **Service Points & Desks** — multi-select from the org's service point definitions; each selected one gets a desk-count field (prefilled from that definition's default capacity, editable).
5. **Review & Create** — summary of everything, submit.

**Edit Service panel**: reuses steps 1, 3, and 4 as tabs (no location step, since the service already belongs to one location) — the same pattern already used elsewhere in the app (e.g. `AdminSettingsPage`'s tabs).

## Error Handling

- Deleting a service-point definition still linked to any active service: blocked with a clear "still assigned to N services — remove it from those services first" error, mirroring the existing "can't delete while serving" pattern.
- Wizard "all locations" creation failing partway (e.g. a subscription-limit violation on one of the target locations): the whole request is rolled back via transaction; nothing is created, error surfaced to the user with which location failed.
- Migration: service points with zero service links get their orphaned instances deleted with a logged count (should be a no-op on current data, but the dev DB will be inspected before/after to confirm).

## Testing Plan

Following this repo's established convention (vitest introduced narrowly for the payment-provider work, not adopted repo-wide): unit tests for the migration backfill logic (instance re-keying edge cases: zero links, single link, `currentServiceId` set vs. unset) and for the wizard's multi-location transactional creation (mocked Prisma, verifying rollback-on-failure). Everything else — the wizard UI, edit flow, Service Points admin page, desk selection on the Queue Management page — verified manually via the browser, matching how the rest of this session's work was verified.

## Open Items

None — all points raised during brainstorming were resolved before this write-up.
