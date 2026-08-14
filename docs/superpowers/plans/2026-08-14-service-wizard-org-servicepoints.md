# Service Creation Wizard + Org-Level Service Points Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn `ServicePoint` into an organization-level definition (assignable to services at any location, with desk count set per service+service-point pairing), and replace the flat "Add Service" modal with a guided wizard that creates a service — optionally at every location at once — and assigns service points/desks to it in the same flow.

**Architecture:** `ServicePoint` moves from `locationId` to `organizationId`; `ServicePointInstance` (the physical desks) moves from being keyed off `ServicePoint` directly to being keyed off `ServicePointService` (the service+service-point link), since desk count is now set per that pairing. `Service` itself is untouched — still one row per location — so `Queue`, `Appointment`, `ServiceFlow`, and analytics need no changes. The wizard is a new multi-step frontend flow that creates one `Service` row per selected location in a single backend transaction.

**Tech Stack:** Express + Prisma + PostgreSQL backend, Next.js 15 App Router frontend, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-08-14-service-wizard-org-servicepoints-design.md`

## Global Constraints

- `Service` schema does not change. Every task must preserve `Service.locationId` as the sole location-scoping mechanism.
- `ServicePointService.capacity` becomes required (not nullable) everywhere it's read or written.
- No new test framework. Match this repo's established convention: vitest only for narrow backend logic (migration backfill, wizard transaction rollback), everything else verified manually via the browser/curl.
- Every backend query that currently scopes by `ServicePoint.locationId` must be rewritten to scope by `Service.locationId` through the `ServicePointService` join, since `ServicePoint.locationId` will no longer exist.

---

### Task 1: Prisma schema changes + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/<timestamp>_org_level_service_points/migration.sql`

**Interfaces:**
- Produces: `ServicePoint.organizationId` (replaces `locationId`), `ServicePointService.capacity: Int` (required, was `Int?`), `ServicePointInstance.servicePointServiceId` (replaces `servicePointId`), `QueueEntry` loses `servicePointId`/`servicePoint` relation.

- [ ] **Step 1: Edit the schema**

In `backend/prisma/schema.prisma`, replace the `ServicePoint` model:

```prisma
model ServicePoint {
  id             String                @id @default(uuid())
  organizationId String
  name           String
  displayName    String?
  type           ServicePointType      @default(OTHER)
  isActive       Boolean               @default(true)
  capacity       Int                   @default(1)
  createdAt      DateTime              @default(now())
  updatedAt      DateTime              @updatedAt
  organization   Organization          @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  services       ServicePointService[]

  @@index([organizationId, isActive])
}
```

Replace `ServicePointInstance`:

```prisma
model ServicePointInstance {
  id                     String              @id @default(uuid())
  servicePointServiceId  String
  instanceNumber         Int
  displayName            String?
  isActive               Boolean             @default(true)
  isOccupied             Boolean             @default(false)
  occupiedByUserId       String?
  occupiedAt             DateTime?
  createdAt              DateTime            @default(now())
  updatedAt              DateTime            @updatedAt
  servicePointService    ServicePointService @relation(fields: [servicePointServiceId], references: [id], onDelete: Cascade)
  occupiedBy             User?               @relation("OccupiedInstances", fields: [occupiedByUserId], references: [id], onDelete: SetNull)
  servingEntries         QueueEntry[]        @relation("InstanceServingEntries")

  @@unique([servicePointServiceId, instanceNumber])
  @@index([servicePointServiceId, isActive])
  @@index([occupiedByUserId])
}
```

Update `ServicePointService` — add the `instances` back-relation and make `capacity` required:

```prisma
model ServicePointService {
  id                  String                 @id @default(uuid())
  servicePointId      String
  serviceId           String
  isActive            Boolean                @default(true)
  capacity            Int
  isOccupied          Boolean                @default(false)
  activatedByUserId   String?
  activatedAt         DateTime?
  createdAt           DateTime               @default(now())
  updatedAt           DateTime               @updatedAt
  servicePoint        ServicePoint           @relation(fields: [servicePointId], references: [id], onDelete: Cascade)
  service             Service                @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  activatedBy         User?                  @relation("ActivatedServicePoints", fields: [activatedByUserId], references: [id], onDelete: SetNull)
  instances            ServicePointInstance[]

  @@unique([servicePointId, serviceId])
  @@index([serviceId])
  @@index([activatedByUserId])
}
```

Update `Service` — remove the now-dangling `currentInstances` relation (its other half, `ServicePointInstance.currentService`, is gone):

Find and delete this line in `model Service`:
```prisma
  currentInstances ServicePointInstance[] @relation("CurrentServiceInstances") // Instances currently serving this service
```

Update `QueueEntry` — remove `servicePointId` and its relation:

Find and delete these two lines in `model QueueEntry`:
```prisma
  servicePointId         String?               // Which service point is serving this entry
```
```prisma
  servicePoint           ServicePoint?         @relation(fields: [servicePointId], references: [id])
```

Update `Location` — remove the `servicePoints` relation (service points are no longer per-location):

Find and delete this line in `model Location`:
```prisma
  servicePoints     ServicePoint[]
```

Update `Organization` — add the new `servicePoints` relation. Find the `Organization` model and add:
```prisma
  servicePoints ServicePoint[]
```

- [ ] **Step 2: Generate the migration SQL**

The dev database container doesn't support interactive `prisma migrate dev`. Generate the SQL via diff instead:

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx prisma migrate diff --from-url "postgresql://postgres:postgres@localhost:5432/queue_management" --to-schema-datamodel prisma/schema.prisma --script > /tmp/schema_diff.sql
cat /tmp/schema_diff.sql
```

This diff will include destructive `DROP COLUMN` statements for `ServicePoint.locationId`, `ServicePointInstance.servicePointId`/`currentServiceId`, and `QueueEntry.servicePointId` before the data has been migrated to the new columns. **Do not apply it directly.** Instead, hand-write the migration below, which does the column additions, data backfill, and drops in the correct order.

- [ ] **Step 3: Write the hand-authored migration**

Create `backend/prisma/migrations/<YYYYMMDDHHMMSS>_org_level_service_points/migration.sql` (use the current UTC timestamp for the folder name, matching the format of existing migration folders):

```sql
-- 1. ServicePoint: add organizationId, backfill from location, drop locationId
ALTER TABLE "ServicePoint" ADD COLUMN "organizationId" TEXT;

UPDATE "ServicePoint" sp
SET "organizationId" = loc."organizationId"
FROM "Location" loc
WHERE sp."locationId" = loc."id";

ALTER TABLE "ServicePoint" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ServicePoint" ADD CONSTRAINT "ServicePoint_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "ServicePoint_organizationId_isActive_idx" ON "ServicePoint"("organizationId", "isActive");

DROP INDEX IF EXISTS "ServicePoint_locationId_isActive_idx";
ALTER TABLE "ServicePoint" DROP CONSTRAINT IF EXISTS "ServicePoint_locationId_fkey";
ALTER TABLE "ServicePoint" DROP COLUMN "locationId";

-- 2. ServicePointService: backfill NULL capacity from servicePoint.capacity, make required
UPDATE "ServicePointService" sps
SET "capacity" = sp."capacity"
FROM "ServicePoint" sp
WHERE sps."servicePointId" = sp."id" AND sps."capacity" IS NULL;

ALTER TABLE "ServicePointService" ALTER COLUMN "capacity" SET NOT NULL;

-- 3. ServicePointInstance: add servicePointServiceId, backfill, drop servicePointId + currentServiceId
ALTER TABLE "ServicePointInstance" ADD COLUMN "servicePointServiceId" TEXT;

-- Prefer the link matching currentServiceId if set, else the first (only, in practice) link for that service point.
UPDATE "ServicePointInstance" spi
SET "servicePointServiceId" = (
  SELECT sps.id FROM "ServicePointService" sps
  WHERE sps."servicePointId" = spi."servicePointId"
    AND (spi."currentServiceId" IS NULL OR sps."serviceId" = spi."currentServiceId")
  ORDER BY (sps."serviceId" = spi."currentServiceId") DESC, sps."createdAt" ASC
  LIMIT 1
);

-- Orphan instances (service point has zero links) can't be attached anywhere - delete them.
DELETE FROM "ServicePointInstance" WHERE "servicePointServiceId" IS NULL;

ALTER TABLE "ServicePointInstance" ALTER COLUMN "servicePointServiceId" SET NOT NULL;
ALTER TABLE "ServicePointInstance" ADD CONSTRAINT "ServicePointInstance_servicePointServiceId_fkey"
  FOREIGN KEY ("servicePointServiceId") REFERENCES "ServicePointService"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "ServicePointInstance_servicePointServiceId_instanceNumber_key" ON "ServicePointInstance"("servicePointServiceId", "instanceNumber");
CREATE INDEX "ServicePointInstance_servicePointServiceId_isActive_idx" ON "ServicePointInstance"("servicePointServiceId", "isActive");

DROP INDEX IF EXISTS "ServicePointInstance_servicePointId_isActive_idx";
DROP INDEX IF EXISTS "ServicePointInstance_servicePointId_instanceNumber_key";
ALTER TABLE "ServicePointInstance" DROP CONSTRAINT IF EXISTS "ServicePointInstance_servicePointId_fkey";
ALTER TABLE "ServicePointInstance" DROP CONSTRAINT IF EXISTS "ServicePointInstance_currentServiceId_fkey";
ALTER TABLE "ServicePointInstance" DROP COLUMN "servicePointId";
ALTER TABLE "ServicePointInstance" DROP COLUMN "currentServiceId";

-- 4. QueueEntry: drop the legacy direct servicePointId FK (servicePointInstanceId is the only path going forward)
ALTER TABLE "QueueEntry" DROP CONSTRAINT IF EXISTS "QueueEntry_servicePointId_fkey";
ALTER TABLE "QueueEntry" DROP COLUMN "servicePointId";
```

- [ ] **Step 4: Apply the migration**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx prisma migrate deploy
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx prisma generate
```

- [ ] **Step 5: Verify the migration on the dev database**

```bash
docker exec qms-backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const sp = await p.servicePoint.findMany({ select: { id: true, name: true, organizationId: true } });
  console.log('ServicePoints:', JSON.stringify(sp, null, 2));
  const inst = await p.servicePointInstance.findMany({ select: { id: true, servicePointServiceId: true, instanceNumber: true } });
  console.log('Instances:', JSON.stringify(inst, null, 2));
  const links = await p.servicePointService.findMany({ select: { id: true, capacity: true } });
  console.log('Links (capacity must be non-null):', JSON.stringify(links, null, 2));
  await p.\$disconnect();
})();
"
```
Expected: every `ServicePoint` has a non-null `organizationId`, every `ServicePointInstance` has a `servicePointServiceId`, every `ServicePointService.capacity` is a number (not null).

- [ ] **Step 6: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations
git commit -m "feat: make ServicePoint org-level, re-key ServicePointInstance to ServicePointService"
```

---

### Task 2: Rewrite servicepoint.controller.ts — org-level CRUD + instance sync

**Files:**
- Modify: `backend/src/controllers/servicepoint.controller.ts`

**Interfaces:**
- Consumes: schema from Task 1 (`ServicePoint.organizationId`, `ServicePointService.capacity: Int`, `ServicePointInstance.servicePointServiceId`).
- Produces: `syncInstancesForServicePointService(servicePointServiceId: string): Promise<void>` — used by Task 3's `linkServicePointToService`/`updateServicePointLink`.

- [ ] **Step 1: Replace the sync helper**

Replace the `syncInstancesForServicePoint` function (top of the file) with:

```typescript
// Ensure a service-point-to-service assignment has exactly `capacity` active
// ServicePointInstance rows. Creates missing instances and deactivates
// (never deletes) excess ones.
async function syncInstancesForServicePointService(servicePointServiceId: string) {
  const link = await prisma.servicePointService.findUnique({
    where: { id: servicePointServiceId },
    include: { instances: true, servicePoint: true },
  });

  if (!link) return;

  const currentCount = link.instances.length;
  const targetCount = link.capacity;

  if (currentCount < targetCount) {
    for (let i = currentCount + 1; i <= targetCount; i++) {
      await prisma.servicePointInstance.create({
        data: {
          servicePointServiceId,
          instanceNumber: i,
          displayName: `${link.servicePoint.displayName || link.servicePoint.name} ${i}`,
          isActive: link.isActive,
        },
      });
    }
  }

  if (currentCount > targetCount) {
    await prisma.servicePointInstance.updateMany({
      where: { servicePointServiceId, instanceNumber: { gt: targetCount } },
      data: { isActive: false },
    });
  }

  await prisma.servicePointInstance.updateMany({
    where: { servicePointServiceId, instanceNumber: { lte: targetCount } },
    data: { isActive: link.isActive },
  });
}
```

- [ ] **Step 2: Rewrite `getServicePoints` to list org-level definitions**

```typescript
// Get all service point definitions for an organization
export const getServicePoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.params;

    const servicePoints = await prisma.servicePoint.findMany({
      where: { organizationId },
      orderBy: [{ type: 'asc' }, { name: 'asc' }],
      include: {
        services: {
          where: { isActive: true },
          select: { serviceId: true },
        },
      },
    });

    res.json(servicePoints.map((sp: typeof servicePoints[number]) => ({
      id: sp.id,
      organizationId: sp.organizationId,
      name: sp.name,
      displayName: sp.displayName,
      type: sp.type,
      isActive: sp.isActive,
      capacity: sp.capacity,
      usedInServicesCount: sp.services.length,
    })));
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Rewrite `createServicePoint`**

```typescript
// Create a service point definition
export const createServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId, name, displayName, type, capacity } = req.body;

    const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    const servicePoint = await prisma.servicePoint.create({
      data: {
        organizationId,
        name,
        displayName: displayName || name,
        type: type || 'OTHER',
        capacity: capacity || 1,
      },
    });

    res.status(201).json(servicePoint);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 4: Rewrite `updateServicePoint`**

```typescript
// Update a service point definition
export const updateServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { name, displayName, type, capacity, isActive } = req.body;

    const servicePoint = await prisma.servicePoint.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(displayName !== undefined && { displayName }),
        ...(type !== undefined && { type }),
        ...(capacity !== undefined && { capacity }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json(servicePoint);
  } catch (error) {
    next(error);
  }
};
```

Note: `capacity` on the definition is now just a default suggestion for new assignments (Task 3's `linkServicePointToService`), not authoritative for existing desks — so updating it no longer needs to re-sync instances.

- [ ] **Step 5: Rewrite `deleteServicePoint`**

```typescript
// Delete a service point definition
export const deleteServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const activeLinks = await prisma.servicePointService.count({
      where: { servicePointId: id, isActive: true },
    });

    if (activeLinks > 0) {
      return res.status(400).json({
        error: `This service point is still assigned to ${activeLinks} service${activeLinks > 1 ? 's' : ''}. Remove it from those services first.`,
      });
    }

    await prisma.servicePoint.delete({ where: { id } });

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 6: Rewrite `getServicePoint` (single fetch)**

```typescript
// Get a single service point definition, with its current service assignments
export const getServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const servicePoint = await prisma.servicePoint.findUnique({
      where: { id },
      include: {
        organization: { select: { id: true, name: true } },
        services: {
          where: { isActive: true },
          include: { service: { select: { id: true, name: true, locationId: true } } },
        },
      },
    });

    if (!servicePoint) {
      return res.status(404).json({ error: 'Service point not found' });
    }

    res.json(servicePoint);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 7: Verify types compile**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx tsc --noEmit 2>&1 | grep servicepoint.controller
```
Expected: no output yet for these functions (remaining functions in the file are fixed in Task 3, so the file as a whole will still show errors until then — that's expected, don't worry about it here).

- [ ] **Step 8: Commit**

```bash
git add backend/src/controllers/servicepoint.controller.ts
git commit -m "feat: rewrite service point CRUD for org-level definitions"
```

---

### Task 3: Rewrite servicepoint.controller.ts — linking, instances, display-board queries + routes

**Files:**
- Modify: `backend/src/controllers/servicepoint.controller.ts`
- Modify: `backend/src/routes/servicepoint.routes.ts`

**Interfaces:**
- Consumes: `syncInstancesForServicePointService` from Task 2.
- Produces: `linkServicePointToService` now requires `capacity` in the request body; `GET /service-points/organization/:organizationId` replaces `GET /service-points/location/:locationId`; `POST /service-points/:servicePointId/instances/sync` route removed.

- [ ] **Step 1: Rewrite `getActiveServicePoints` (public display board data source)**

```typescript
// Get active service points with current status, scoped by location via
// the services assigned there (ServicePoint itself is org-level now).
export const getActiveServicePoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: { organization: { select: { defaultDisplayMode: true } } },
    });

    const orgDefaultDisplayMode = location?.organization?.defaultDisplayMode || 'TICKET_ONLY';

    const links = await prisma.servicePointService.findMany({
      where: {
        isActive: true,
        servicePoint: { isActive: true },
        service: { locationId, isActive: true },
      },
      include: {
        servicePoint: true,
        service: { select: { name: true, displayMode: true } },
        instances: {
          where: { isActive: true },
          include: {
            servingEntries: {
              where: { status: 'SERVING' },
              include: { user: { select: { firstName: true, lastName: true } } },
            },
          },
          orderBy: { instanceNumber: 'asc' },
        },
      },
      orderBy: [{ servicePoint: { type: 'asc' } }, { servicePoint: { name: 'asc' } }],
    });

    const displayData = links.map((link: typeof links[number]) => {
      const servingInstance = link.instances.find((i: typeof link.instances[number]) => i.servingEntries.length > 0);
      const entry = servingInstance?.servingEntries[0];
      const displayMode = link.service.displayMode || orgDefaultDisplayMode;

      return {
        id: link.servicePoint.id,
        name: link.servicePoint.name,
        displayName: link.servicePoint.displayName || link.servicePoint.name,
        type: link.servicePoint.type,
        displayMode,
        currentlyServing: entry ? {
          ticketNumber: entry.ticketNumber,
          customerName: `${entry.user.firstName} ${entry.user.lastName}`,
          serviceName: link.service.name,
        } : null,
      };
    });

    res.json(displayData);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Rewrite `getServicePointsForService`**

```typescript
// Get service points linked to a specific service
export const getServicePointsForService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;

    const links = await prisma.servicePointService.findMany({
      where: { serviceId, isActive: true, servicePoint: { isActive: true } },
      include: {
        servicePoint: true,
        activatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { servicePoint: { name: 'asc' } },
    });

    const servicePoints = links.map((link: typeof links[number]) => ({
      id: link.servicePoint.id,
      name: link.servicePoint.name,
      displayName: link.servicePoint.displayName,
      type: link.servicePoint.type,
      capacity: link.capacity,
      isOccupied: link.isOccupied,
      activatedBy: link.activatedBy,
      activatedAt: link.activatedAt,
      linkId: link.id,
    }));

    res.json(servicePoints);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Rewrite `linkServicePointToService` (capacity now required, auto-syncs instances)**

```typescript
// Link a service point to a service with a desk count
export const linkServicePointToService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId, serviceId, capacity } = req.body;

    if (!capacity || capacity < 1) {
      return res.status(400).json({ error: 'capacity is required and must be at least 1' });
    }

    const existing = await prisma.servicePointService.findUnique({
      where: { servicePointId_serviceId: { servicePointId, serviceId } },
    });

    let link;
    if (existing) {
      link = await prisma.servicePointService.update({
        where: { id: existing.id },
        data: { isActive: true, capacity },
      });
    } else {
      link = await prisma.servicePointService.create({
        data: { servicePointId, serviceId, capacity },
      });
    }

    await syncInstancesForServicePointService(link.id);

    res.status(existing ? 200 : 201).json(link);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 4: Keep `unlinkServicePointFromService` as-is**

No change needed — it already works purely off `(servicePointId, serviceId)` and doesn't reference the fields that moved. Confirm it's still present unchanged.

- [ ] **Step 5: Rewrite `updateServicePointLink`**

```typescript
// Update a service point link's desk count
export const updateServicePointLink = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { linkId } = req.params;
    const { capacity } = req.body;

    if (capacity === undefined || capacity < 1) {
      return res.status(400).json({ error: 'capacity must be at least 1' });
    }

    const updated = await prisma.servicePointService.update({
      where: { id: linkId },
      data: { capacity },
      include: {
        servicePoint: true,
        activatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await syncInstancesForServicePointService(linkId);

    res.json({
      id: updated.servicePoint.id,
      name: updated.servicePoint.name,
      displayName: updated.servicePoint.displayName,
      type: updated.servicePoint.type,
      capacity: updated.capacity,
      isOccupied: updated.isOccupied,
      activatedBy: updated.activatedBy,
      activatedAt: updated.activatedAt,
      linkId: updated.id,
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 6: Rewrite `getOccupiedServicePoints`**

```typescript
// Get all occupied service points for a location (for display)
export const getOccupiedServicePoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const occupied = await prisma.servicePointService.findMany({
      where: {
        isOccupied: true,
        isActive: true,
        service: { locationId },
        servicePoint: { isActive: true },
      },
      include: {
        servicePoint: true,
        service: { select: { id: true, name: true } },
        activatedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(occupied.map((link: typeof occupied[number]) => ({
      servicePointId: link.servicePoint.id,
      servicePointName: link.servicePoint.displayName || link.servicePoint.name,
      serviceId: link.service.id,
      serviceName: link.service.name,
      activatedBy: link.activatedBy,
      activatedAt: link.activatedAt,
    })));
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 7: Rewrite `getServicePointInstances` (all instances for a definition, across all its service links)**

```typescript
// Get all instances for a service point definition, across every service it's assigned to
export const getServicePointInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { servicePointId } = req.params;

    const instances = await prisma.servicePointInstance.findMany({
      where: { servicePointService: { servicePointId } },
      include: {
        occupiedBy: { select: { id: true, firstName: true, lastName: true } },
        servicePointService: { include: { service: { select: { id: true, name: true } } } },
      },
      orderBy: [{ servicePointServiceId: 'asc' }, { instanceNumber: 'asc' }],
    });

    res.json(instances);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 8: Delete `syncServicePointInstances`**

Remove the entire `syncServicePointInstances` exported function — sync now happens automatically inside `linkServicePointToService`/`updateServicePointLink` from Steps 3 and 5.

- [ ] **Step 9: Rewrite `activateServicePointInstance`**

```typescript
// Activate an instance (operator claims a desk instance)
export const activateServicePointInstance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const instance = await prisma.servicePointInstance.findUnique({
      where: { id: instanceId },
      include: { servicePointService: { include: { servicePoint: true } } },
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    if (!instance.isActive) {
      return res.status(400).json({ error: 'Instance is not active' });
    }

    if (!instance.servicePointService.servicePoint.isActive || !instance.servicePointService.isActive) {
      return res.status(400).json({ error: 'Service point is not active' });
    }

    if (instance.isOccupied) {
      return res.status(400).json({ error: 'Instance is already occupied' });
    }

    const updated = await prisma.servicePointInstance.update({
      where: { id: instanceId },
      data: {
        isOccupied: true,
        occupiedByUserId: userId,
        occupiedAt: new Date(),
      },
      include: {
        occupiedBy: { select: { id: true, firstName: true, lastName: true } },
        servicePointService: {
          include: {
            servicePoint: true,
            service: { select: { id: true, name: true } },
          },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 10: Rewrite `vacateServicePointInstance`**

```typescript
// Vacate an instance (operator releases a desk instance)
export const vacateServicePointInstance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.params;
    const userId = (req as any).user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const instance = await prisma.servicePointInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const isAdmin = ['SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'].includes(user?.role || '');
    if (instance.occupiedByUserId !== userId && !isAdmin) {
      return res.status(403).json({ error: 'You can only vacate your own instance' });
    }

    const updated = await prisma.servicePointInstance.update({
      where: { id: instanceId },
      data: {
        isOccupied: false,
        occupiedByUserId: null,
        occupiedAt: null,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 11: Rewrite `getLocationInstances` (display board)**

```typescript
// Get all instances for a location (for display board), scoped via each
// instance's service, since ServicePoint itself is org-level now.
export const getLocationInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;

    const instances = await prisma.servicePointInstance.findMany({
      where: {
        isActive: true,
        servicePointService: {
          isActive: true,
          service: { locationId, isActive: true },
          servicePoint: { isActive: true },
        },
      },
      include: {
        servicePointService: {
          include: {
            servicePoint: true,
            service: { select: { id: true, name: true, displayMode: true } },
          },
        },
        occupiedBy: { select: { id: true, firstName: true, lastName: true } },
        servingEntries: {
          where: { status: 'SERVING' },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: [
        { servicePointService: { servicePoint: { type: 'asc' } } },
        { servicePointService: { servicePoint: { name: 'asc' } } },
        { instanceNumber: 'asc' },
      ],
    });

    const location = await prisma.location.findUnique({
      where: { id: locationId },
      include: { organization: { select: { defaultDisplayMode: true } } },
    });

    const orgDefaultDisplayMode = location?.organization?.defaultDisplayMode || 'TICKET_ONLY';

    const displayData = instances.map((inst: typeof instances[number]) => {
      const entry = inst.servingEntries[0];
      const service = inst.servicePointService.service;
      const displayMode = service?.displayMode || orgDefaultDisplayMode;

      return {
        id: inst.id,
        servicePointId: inst.servicePointService.servicePoint.id,
        instanceNumber: inst.instanceNumber,
        displayName: inst.displayName,
        servicePointType: inst.servicePointService.servicePoint.type,
        displayMode,
        isOccupied: inst.isOccupied,
        currentService: service ? { id: service.id, name: service.name } : null,
        occupiedBy: inst.occupiedBy,
        currentlyServing: entry ? {
          ticketNumber: entry.ticketNumber,
          customerName: `${entry.user.firstName} ${entry.user.lastName}`,
        } : null,
      };
    });

    res.json(displayData);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 12: Rewrite `toggleInstanceActive`**

```typescript
// Toggle instance active state (admin only)
export const toggleInstanceActive = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { instanceId } = req.params;
    const { isActive } = req.body;

    const instance = await prisma.servicePointInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }

    const updated = await prisma.servicePointInstance.update({
      where: { id: instanceId },
      data: {
        isActive,
        ...(isActive === false ? {
          isOccupied: false,
          occupiedByUserId: null,
          occupiedAt: null,
        } : {}),
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 13: Rewrite `getServiceInstances` (desk selector for operators — response shape unchanged)**

```typescript
// Get instances by service (for operator's desk selection)
export const getServiceInstances = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;

    const links = await prisma.servicePointService.findMany({
      where: { serviceId, isActive: true, servicePoint: { isActive: true } },
      include: {
        servicePoint: true,
        instances: {
          where: { isActive: true },
          include: { occupiedBy: { select: { id: true, firstName: true, lastName: true } } },
          orderBy: { instanceNumber: 'asc' },
        },
      },
    });

    const instances = links.flatMap((link: typeof links[number]) =>
      link.instances.map((inst: typeof link.instances[number]) => ({
        id: inst.id,
        servicePointId: link.servicePoint.id,
        servicePointName: link.servicePoint.displayName || link.servicePoint.name,
        instanceNumber: inst.instanceNumber,
        displayName: inst.displayName,
        isOccupied: inst.isOccupied,
        occupiedBy: inst.occupiedBy,
      }))
    );

    res.json(instances);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 14: Update routes**

Replace `backend/src/routes/servicepoint.routes.ts` in full:

```typescript
import { Router } from 'express';
import {
  getServicePoints,
  getServicePoint,
  createServicePoint,
  updateServicePoint,
  deleteServicePoint,
  getActiveServicePoints,
  getServicePointsForService,
  linkServicePointToService,
  unlinkServicePointFromService,
  activateServicePoint,
  vacateServicePoint,
  getOccupiedServicePoints,
  updateServicePointLink,
  // Instance management
  getServicePointInstances,
  activateServicePointInstance,
  vacateServicePointInstance,
  getLocationInstances,
  toggleInstanceActive,
  getServiceInstances,
} from '../controllers/servicepoint.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Service point definitions (org-level)
router.get('/organization/:organizationId', getServicePoints);
router.get('/location/:locationId/active', getActiveServicePoints);
router.get('/location/:locationId/occupied', getOccupiedServicePoints);
router.get('/location/:locationId/instances', getLocationInstances);
router.get('/service/:serviceId', getServicePointsForService);
router.get('/service/:serviceId/instances', getServiceInstances);
router.get('/:id', getServicePoint);
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createServicePoint);
router.patch('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateServicePoint);
router.delete('/:id', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), deleteServicePoint);

// Service point to service linking (admin)
router.post('/link', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), linkServicePointToService);
router.post('/unlink', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), unlinkServicePointFromService);
router.patch('/link/:linkId', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), updateServicePointLink);

// Activation (operator can activate/vacate their desk) - legacy link-level path
router.post('/activate', activateServicePoint);
router.post('/vacate', vacateServicePoint);

// Instance management
router.get('/:servicePointId/instances', getServicePointInstances);
router.post('/instances/:instanceId/activate', activateServicePointInstance);
router.post('/instances/:instanceId/vacate', vacateServicePointInstance);
router.patch('/instances/:instanceId/toggle', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), toggleInstanceActive);

export default router;
```

- [ ] **Step 15: Verify types compile**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx tsc --noEmit 2>&1 | grep -E "servicepoint.controller|servicepoint.routes"
```
Expected: no output.

- [ ] **Step 16: Commit**

```bash
git add backend/src/controllers/servicepoint.controller.ts backend/src/routes/servicepoint.routes.ts
git commit -m "feat: rewrite service point linking, instances, and display-board queries for org-level model"
```

---

### Task 4: Fix queue.controller.ts call sites

**Files:**
- Modify: `backend/src/controllers/queue.controller.ts`

**Interfaces:**
- Consumes: `ServicePointInstance.servicePointServiceId` from Task 1.

- [ ] **Step 1: Rewrite `callNextWithServicePoint`**

Find the function (currently starting around line 910) and replace it in full:

```typescript
// Call next with service point assignment
export const callNextWithServicePoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { servicePointInstanceId } = req.body;

    const queue = await prisma.queue.findUnique({
      where: { id },
      select: { serviceId: true }
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    if (servicePointInstanceId) {
      const instance = await prisma.servicePointInstance.findUnique({
        where: { id: servicePointInstanceId },
        include: { servicePointService: { include: { servicePoint: true } } },
      });

      if (!instance || !instance.isActive) {
        return res.status(400).json({ error: 'Invalid or inactive service point instance' });
      }

      if (!instance.servicePointService.servicePoint.isActive || !instance.servicePointService.isActive) {
        return res.status(400).json({ error: 'Invalid or inactive service point' });
      }

      if (instance.servicePointService.serviceId !== queue.serviceId) {
        return res.status(400).json({ error: 'Service point instance is not authorized for this service' });
      }
    }

    const nextEntry = await prisma.queueEntry.findFirst({
      where: {
        queueId: id,
        status: 'WAITING',
      },
      orderBy: [
        { priority: 'desc' },
        { sortOrder: 'asc' },
        { joinedAt: 'asc' }
      ],
    });

    if (!nextEntry) {
      return res.status(404).json({ error: 'No waiting entries in queue' });
    }

    const entry = await prisma.queueEntry.update({
      where: { id: nextEntry.id },
      data: {
        status: 'SERVING',
        calledAt: new Date(),
        servicePointInstanceId: servicePointInstanceId || null,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        servicePointInstance: {
          include: { servicePointService: { include: { servicePoint: true } } },
        },
      },
    });

    const servicePointForPayload = entry.servicePointInstance?.servicePointService?.servicePoint ?? null;

    const locationId = await getLocationIdFromQueue(id);
    emitToQueueAndLocation(id, locationId, SOCKET_EVENTS.ENTRY_STATUS_CHANGED, {
      queueId: id,
      entryId: entry.id,
      status: 'SERVING',
      entry: { ...entry, servicePoint: servicePointForPayload },
      servicePoint: servicePointForPayload,
      servicePointInstance: entry.servicePointInstance,
    });

    res.json({ ...entry, servicePoint: servicePointForPayload });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 2: Rewrite the `entries` include in `getQueueEntriesForOperator`**

Find this block (currently around line 1067-1072):

```typescript
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
            servicePoint: true,
          },
```

Replace with:

```typescript
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
            servicePointInstance: {
              include: { servicePointService: { include: { servicePoint: true } } },
            },
          },
```

Then find where `serving`/`waiting` are derived (currently `const serving = queue.entries.filter(e => e.status === 'SERVING');` and the `waiting` line right after it) and replace both with a mapped version that flattens the nested service point onto the entry, matching what the frontend already reads (`entry.servicePoint.displayName`/`.name`):

```typescript
    const attachServicePoint = (e: typeof queue.entries[number]) => ({
      ...e,
      servicePoint: e.servicePointInstance?.servicePointService?.servicePoint
        ? {
            id: e.servicePointInstance.servicePointService.servicePoint.id,
            name: e.servicePointInstance.servicePointService.servicePoint.name,
            displayName: e.servicePointInstance.servicePointService.servicePoint.displayName,
          }
        : null,
    });

    const serving = queue.entries.filter(e => e.status === 'SERVING').map(attachServicePoint);
    const waiting = queue.entries.filter(e => e.status === 'WAITING').map(attachServicePoint);
```

- [ ] **Step 3: Fix `getLocationQueues` (display board swimlanes)**

Find the entries include inside the `queues` include (currently around line 1502-1509):

```typescript
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true }
                },
                servicePoint: {
                  select: { id: true, name: true, displayName: true }
                }
              },
```

Replace with:

```typescript
              include: {
                user: {
                  select: { id: true, firstName: true, lastName: true }
                },
                servicePointInstance: {
                  include: {
                    servicePointService: {
                      include: { servicePoint: { select: { id: true, name: true, displayName: true } } }
                    }
                  }
                }
              },
```

Find the `spLinks` query (currently around line 1523-1532):

```typescript
    const spLinks = await prisma.servicePointService.findMany({
      where: {
        isActive: true,
        servicePoint: { locationId, isActive: true },
      },
      include: {
        servicePoint: { select: { id: true, name: true, displayName: true, isActive: true } },
        service: { select: { id: true } },
      },
    });
```

Replace the `where` clause:

```typescript
    const spLinks = await prisma.servicePointService.findMany({
      where: {
        isActive: true,
        servicePoint: { isActive: true },
        service: { locationId, isActive: true },
      },
      include: {
        servicePoint: { select: { id: true, name: true, displayName: true, isActive: true } },
        service: { select: { id: true } },
      },
    });
```

Find the `currentlyServing` mapping (currently around line 1622):

```typescript
          servicePoint: e.servicePoint ? (e.servicePoint.displayName || e.servicePoint.name) : null,
```

Replace with:

```typescript
          servicePoint: e.servicePointInstance?.servicePointService?.servicePoint
            ? (e.servicePointInstance.servicePointService.servicePoint.displayName || e.servicePointInstance.servicePointService.servicePoint.name)
            : null,
```

- [ ] **Step 4: Verify types compile**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx tsc --noEmit 2>&1 | grep queue.controller
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add backend/src/controllers/queue.controller.ts
git commit -m "fix: resolve queue controller's service point references through the re-keyed instance chain"
```

---

### Task 5: Fix location.controller.ts and superadmin.controller.ts service-point counts

**Files:**
- Modify: `backend/src/controllers/location.controller.ts`
- Modify: `backend/src/controllers/superadmin.controller.ts`

**Interfaces:**
- Consumes: schema from Task 1 (`Location` no longer has a `servicePoints` relation).

- [ ] **Step 1: Fix `getPublicLocationInfo`**

In `backend/src/controllers/location.controller.ts`, find `getPublicLocationInfo` (currently around line 157-179). Replace the `select` block:

```typescript
      select: {
        id: true,
        name: true,
        address: true,
        timezone: true,
        publicCode: true,
        organization: { select: { id: true, name: true } },
        _count: { select: { services: true } },
      },
```

Then, after the `if (!location) { ... }` check, add a separate count query and merge it into the response (the display board reads `locationInfo._count?.servicePoints`, so keep that exact response shape):

```typescript
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    const servicePointsCount = await prisma.servicePointService.count({
      where: { isActive: true, service: { locationId } },
    });

    res.json({
      ...location,
      _count: { ...location._count, servicePoints: servicePointsCount },
    });
```

Remove the old `res.json(location);` line that this replaces.

- [ ] **Step 2: Fix superadmin's org-detail location counts**

In `backend/src/controllers/superadmin.controller.ts`, find the `locations: { include: { _count: { select: { services: true, servicePoints: true } } } }` block (currently around line 85-94) and remove `servicePoints: true`:

```typescript
        locations: {
          include: {
            _count: {
              select: {
                services: true,
              },
            },
          },
        },
```

- [ ] **Step 3: Verify types compile**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx tsc --noEmit 2>&1 | grep -E "location.controller|superadmin.controller"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add backend/src/controllers/location.controller.ts backend/src/controllers/superadmin.controller.ts
git commit -m "fix: rescope service-point counts now that ServicePoint is org-level"
```

---

### Task 6: Multi-location service creation (bulk wizard backend) + edit reconciliation

**Files:**
- Modify: `backend/src/controllers/service.controller.ts`
- Modify: `backend/src/routes/service.routes.ts`

**Interfaces:**
- Consumes: `syncInstancesForServicePointService`-equivalent behavior via `linkServicePointToService`'s pattern (duplicated inline here since it lives in a different controller file — see Step 1).
- Produces: `POST /services` accepting `{ name, description, type, requiresName, requiresPhone, allowAnonymous, displayMode, slotDuration, concurrentLimit, activeDays, startTime, endTime, isActive, locationIds: string[], servicePoints: [{ servicePointId, capacity }] }`, returning `{ services: Service[] }`. `PATCH /services/:id` accepting an additional `servicePoints` array.

- [ ] **Step 1: Add a shared instance-sync helper to service.controller.ts**

At the top of `backend/src/controllers/service.controller.ts`, add (this mirrors `syncInstancesForServicePointService` from `servicepoint.controller.ts` — duplicated rather than imported to keep the two controllers independently readable, matching this codebase's existing pattern of small per-controller helpers):

```typescript
import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { checkLimit } from '../middleware/subscription.middleware';

async function syncInstancesForServicePointService(servicePointServiceId: string) {
  const link = await prisma.servicePointService.findUnique({
    where: { id: servicePointServiceId },
    include: { instances: true, servicePoint: true },
  });

  if (!link) return;

  const currentCount = link.instances.length;
  const targetCount = link.capacity;

  if (currentCount < targetCount) {
    for (let i = currentCount + 1; i <= targetCount; i++) {
      await prisma.servicePointInstance.create({
        data: {
          servicePointServiceId,
          instanceNumber: i,
          displayName: `${link.servicePoint.displayName || link.servicePoint.name} ${i}`,
          isActive: link.isActive,
        },
      });
    }
  }

  if (currentCount > targetCount) {
    await prisma.servicePointInstance.updateMany({
      where: { servicePointServiceId, instanceNumber: { gt: targetCount } },
      data: { isActive: false },
    });
  }
}
```

This replaces the current `import { Request, Response, NextFunction } from 'express';\nimport prisma from '../lib/prisma';` two-line header.

- [ ] **Step 2: Replace `createService` with the multi-location bulk version**

Replace the existing `createService` function in full:

```typescript
export const createService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      name,
      description,
      type,
      slotDuration,
      concurrentLimit,
      activeDays,
      startTime,
      endTime,
      requiresName,
      requiresPhone,
      allowAnonymous,
      displayMode,
      isActive,
      locationIds,
      servicePoints,
    } = req.body;

    if (!Array.isArray(locationIds) || locationIds.length === 0) {
      return res.status(400).json({ error: 'At least one locationId is required' });
    }

    // Resolve the organization from the first location and verify every
    // requested location belongs to it, so a caller can't slip in another org's location.
    const locations = await prisma.location.findMany({ where: { id: { in: locationIds } } });
    if (locations.length !== locationIds.length) {
      return res.status(404).json({ error: 'One or more locations not found' });
    }
    const organizationId = locations[0].organizationId;
    if (locations.some((l: typeof locations[number]) => l.organizationId !== organizationId)) {
      return res.status(400).json({ error: 'All target locations must belong to the same organization' });
    }

    const { current, limit } = await checkLimit(organizationId, 'services');
    if (current + locationIds.length > limit) {
      return res.status(403).json({
        error: 'Limit reached',
        message: `Creating ${locationIds.length} service(s) would exceed your plan's limit of ${limit} services (currently at ${current}).`,
        limitType: 'services',
        current,
        limit,
        upgradeRequired: true,
      });
    }

    if (servicePoints && Array.isArray(servicePoints)) {
      for (const sp of servicePoints) {
        if (!sp.servicePointId || !sp.capacity || sp.capacity < 1) {
          return res.status(400).json({ error: 'Each service point assignment needs a servicePointId and a capacity of at least 1' });
        }
      }
    }

    const createdServices = await prisma.$transaction(async (tx) => {
      const results: Awaited<ReturnType<typeof tx.service.create>>[] = [];
      for (const locationId of locationIds) {
        const service = await tx.service.create({
          data: {
            locationId,
            name,
            description,
            type: type || 'GENERAL',
            slotDuration: slotDuration || 15,
            concurrentLimit: concurrentLimit || 1,
            activeDays: activeDays || '1,2,3,4,5',
            startTime: startTime || '09:00',
            endTime: endTime || '17:00',
            requiresName: requiresName ?? true,
            requiresPhone: requiresPhone ?? false,
            allowAnonymous: allowAnonymous ?? false,
            displayMode: displayMode || null,
            isActive: isActive ?? true,
          },
        });

        if (servicePoints && Array.isArray(servicePoints)) {
          for (const sp of servicePoints) {
            await tx.servicePointService.create({
              data: { servicePointId: sp.servicePointId, serviceId: service.id, capacity: sp.capacity },
            });
          }
        }

        results.push(service);
      }
      return results;
    });

    // Instance sync happens outside the transaction (it's not itself
    // transactional business logic, just desk-row bookkeeping).
    if (servicePoints && Array.isArray(servicePoints)) {
      for (const service of createdServices) {
        const links = await prisma.servicePointService.findMany({ where: { serviceId: service.id } });
        for (const link of links) {
          await syncInstancesForServicePointService(link.id);
        }
      }
    }

    res.status(201).json({ services: createdServices });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 3: Extend `updateService` to reconcile service point assignments**

Replace the existing `updateService` function in full:

```typescript
export const updateService = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { servicePoints, ...updates } = req.body;

    const service = await prisma.service.update({
      where: { id },
      data: updates,
    });

    if (servicePoints && Array.isArray(servicePoints)) {
      for (const sp of servicePoints) {
        if (!sp.servicePointId || !sp.capacity || sp.capacity < 1) {
          return res.status(400).json({ error: 'Each service point assignment needs a servicePointId and a capacity of at least 1' });
        }
      }

      const existingLinks = await prisma.servicePointService.findMany({
        where: { serviceId: id, isActive: true },
      });

      const requestedIds = new Set(servicePoints.map((sp: { servicePointId: string }) => sp.servicePointId));

      // Deactivate links that are no longer selected
      for (const link of existingLinks) {
        if (!requestedIds.has(link.servicePointId)) {
          await prisma.servicePointService.update({
            where: { id: link.id },
            data: { isActive: false, isOccupied: false, activatedByUserId: null, activatedAt: null },
          });
        }
      }

      // Create or update the requested links
      for (const sp of servicePoints) {
        const existing = existingLinks.find((l: typeof existingLinks[number]) => l.servicePointId === sp.servicePointId);
        let linkId: string;
        if (existing) {
          await prisma.servicePointService.update({
            where: { id: existing.id },
            data: { isActive: true, capacity: sp.capacity },
          });
          linkId = existing.id;
        } else {
          const created = await prisma.servicePointService.create({
            data: { servicePointId: sp.servicePointId, serviceId: id, capacity: sp.capacity },
          });
          linkId = created.id;
        }
        await syncInstancesForServicePointService(linkId);
      }
    }

    res.json(service);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 4: Update routes**

In `backend/src/routes/service.routes.ts`, replace the create route. Find:

```typescript
router.post('/locations/:locationId/services', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), enforceLimit('services'), createService);
```

Replace with (the top-level route no longer nests under a single location, and the bulk-aware limit check now lives inside the controller itself instead of the generic single-location `enforceLimit` middleware):

```typescript
router.post('/', authorize('SUPER_ADMIN', 'ORG_ADMIN', 'LOCATION_ADMIN'), createService);
```

The `enforceLimit` import becomes unused in this file — remove `import { enforceLimit } from '../middleware/subscription.middleware';` if `createService`'s route was its only use (verify with a search over the file before removing).

- [ ] **Step 5: Verify types compile**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx tsc --noEmit 2>&1 | grep -E "service.controller|service.routes"
```
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/service.controller.ts backend/src/routes/service.routes.ts
git commit -m "feat: bulk multi-location service creation with service-point/desk assignment"
```

---

### Task 7: Frontend API client + types updates

**Files:**
- Modify: `frontend/src/api/client.ts`
- Modify: `frontend/src/types/index.ts`

**Interfaces:**
- Produces: `api.getServicePoints(organizationId)`, `api.createServicePointBulkService(...)` (new), `api.updateServiceWithServicePoints(...)` (extends existing `updateService`), updated `ServicePoint` type (no `locationId`, has `organizationId`).

- [ ] **Step 1: Update `ServicePoint` type**

In `frontend/src/types/index.ts`, replace the `ServicePoint` interface:

```typescript
export interface ServicePoint {
  id: string;
  organizationId: string;
  name: string;
  displayName?: string;
  type: ServicePointType;
  isActive: boolean;
  capacity: number;
  usedInServicesCount?: number;
  currentlyServing?: {
    ticketNumber: string;
    customerName: string;
    serviceName: string;
  };
}
```

Remove `servicePoints?: ServicePoint[];` from the `Location` interface (it no longer has that relation).

- [ ] **Step 2: Update `api.getServicePoints` and `api.createServicePoint`**

In `frontend/src/api/client.ts`, replace:

```typescript
  async getServicePoints(locationId: string) {
    const { data } = await this.client.get(`/service-points/location/${locationId}`);
    return data;
  }
```

with:

```typescript
  async getServicePoints(organizationId: string) {
    const { data } = await this.client.get(`/service-points/organization/${organizationId}`);
    return data;
  }
```

Replace:

```typescript
  async createServicePoint(payload: {
    locationId: string;
    name: string;
    displayName?: string;
    type?: string;
    capacity?: number;
  }) {
    const { data } = await this.client.post('/service-points', payload);
    return data;
  }
```

with:

```typescript
  async createServicePoint(payload: {
    organizationId: string;
    name: string;
    displayName?: string;
    type?: string;
    capacity?: number;
  }) {
    const { data } = await this.client.post('/service-points', payload);
    return data;
  }
```

- [ ] **Step 3: Update `linkServicePointToService`, remove `syncServicePointInstances`**

Replace:

```typescript
  async linkServicePointToService(servicePointId: string, serviceId: string) {
    const { data } = await this.client.post('/service-points/link', { servicePointId, serviceId });
    return data;
  }
```

with:

```typescript
  async linkServicePointToService(servicePointId: string, serviceId: string, capacity: number) {
    const { data } = await this.client.post('/service-points/link', { servicePointId, serviceId, capacity });
    return data;
  }
```

Delete the `syncServicePointInstances` method entirely (the endpoint no longer exists):

```typescript
  async syncServicePointInstances(servicePointId: string) {
    const { data } = await this.client.post(`/service-points/${servicePointId}/instances/sync`);
    return data;
  }
```

- [ ] **Step 4: Replace `createService` with the bulk-capable version**

Replace:

```typescript
  async createService(locationId: string, service: Partial<Service>) {
    const { data } = await this.client.post(`/services/locations/${locationId}/services`, service);
    return data;
  }
```

with:

```typescript
  async createService(payload: Partial<Service> & {
    locationIds: string[];
    servicePoints?: { servicePointId: string; capacity: number }[];
  }) {
    const { data } = await this.client.post('/services', payload);
    return data as { services: Service[] };
  }
```

- [ ] **Step 5: Extend `updateService`'s payload type**

Replace:

```typescript
  async updateService(id: string, payload: Partial<Service>) {
```

with:

```typescript
  async updateService(id: string, payload: Partial<Service> & {
    servicePoints?: { servicePointId: string; capacity: number }[];
  }) {
```

(the method body — `const { data } = await this.client.patch(...)` etc. — stays the same, only the parameter type changes; find it a few lines below `createService` in the file, near the other service methods).

- [ ] **Step 6: Simplify `callNextWithServicePoint`'s client signature**

Replace:

```typescript
  async callNextWithServicePoint(queueId: string, servicePointId?: string, servicePointInstanceId?: string) {
```

with (drop the now-unused legacy `servicePointId` parameter — find the full method body a few lines below and update its call accordingly, e.g. `this.client.post(...,  { servicePointInstanceId })`):

```typescript
  async callNextWithServicePoint(queueId: string, servicePointInstanceId?: string) {
```

- [ ] **Step 7: Update the one caller in `QueueManagementPage.tsx`**

In `frontend/src/components/pages/QueueManagementPage.tsx`, find `handleCallNext` (around line 349-373) and simplify it — remove the `baseId`/`getBaseServicePointId` resolution since the backend no longer needs it:

```typescript
  const handleCallNext = async () => {
    if (!operatorData?.queue?.id) return;

    const instanceId = selectedInstanceId;
    const servicePointId = selectedServicePoint;

    if (!instanceId && !servicePointId) {
      setError('Please select a service desk before calling the next customer');
      return;
    }

    try {
      await api.callNextWithServicePoint(operatorData.queue.id, instanceId || undefined);
      await refreshQueue();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to call next');
    }
  };
```

- [ ] **Step 8: Verify types compile**

```bash
docker exec qms-frontend npx tsc --noEmit 2>&1 | grep -E "api/client|types/index|QueueManagementPage"
```
Expected: no new errors beyond the 3 pre-existing ones noted in earlier work on this codebase (`flow-designer/page.tsx`, `AdminDataSourcesPage.tsx`, `ServicesPage.tsx`'s `queues` property).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/types/index.ts frontend/src/components/pages/QueueManagementPage.tsx
git commit -m "feat: update frontend API client and types for org-level service points"
```

---

### Task 8: Service Points admin page → org-level rewrite

**Files:**
- Modify: `frontend/src/app/admin/service-points/page.tsx`

**Interfaces:**
- Consumes: `api.getServicePoints(organizationId)`, `api.createServicePoint({ organizationId, ... })` from Task 7.

- [ ] **Step 1: Drop the location selector, fetch by organization**

Replace the state and data-loading section (currently lines 23-82) with:

```typescript
const ServicePointsPage: React.FC = () => {
  const { user } = useAuthContext();
  const [servicePoints, setServicePoints] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPoint, setEditingPoint] = useState<ServicePoint | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    type: 'OTHER' as ServicePointType,
    capacity: 1,
    isActive: true,
  });

  useEffect(() => {
    loadServicePoints();
  }, [user]);

  const loadServicePoints = async () => {
    if (!user?.organizationId) {
      setServicePoints([]);
      setLoading(false);
      return;
    }
    try {
      const points = await api.getServicePoints(user.organizationId);
      setServicePoints(points);
      setError('');
    } catch (err) {
      console.error('Failed to load service points', err);
      setError('Failed to load service points');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 2: Update the modal submit handler**

Replace `handleSubmit` (currently lines 112-131):

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingPoint) {
        await api.updateServicePoint(editingPoint.id, formData);
      } else {
        if (!user?.organizationId) return;
        await api.createServicePoint({
          organizationId: user.organizationId,
          ...formData,
        });
      }

      await loadServicePoints();
      handleCloseModal();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to save service point');
    }
  };
```

- [ ] **Step 3: Update the remaining handlers to call `loadServicePoints()` with no argument**

`handleDelete` and `handleToggleActive` currently call `loadServicePoints(selectedLocation)`. Update both call sites to `loadServicePoints()`.

- [ ] **Step 4: Remove the location selector from the header actions**

In the `PageHeader`'s `actions` prop, remove the `.selector` block (Location label + `<select>`), keeping just the "Add Service Point" button:

```typescript
          actions={
            <button className="add-btn" onClick={() => handleOpenModal()}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add Service Point
            </button>
          }
```

- [ ] **Step 5: Add a "used in N services" indicator to each card**

In the point card's `.point-details` block, add a fourth `.detail` entry after "Status":

```typescript
                    <div className="detail">
                      <span className="label">Used In</span>
                      <span className="value">{point.usedInServicesCount ?? 0} service{point.usedInServicesCount === 1 ? '' : 's'}</span>
                    </div>
```

- [ ] **Step 6: Remove the now-unused `.selector` CSS rule and `Location` import**

Remove the `.selector` and `.selector label`/`.selector select` rules from the `<style jsx>` block (no longer rendered). Remove the `import type { Location, ...} from '@/types';` — replace with just `import type { ServicePoint, ServicePointType } from '@/types';` since `Location` is no longer used anywhere in the file (verify with a search before removing — if `Location` is referenced elsewhere in the file, keep the import).

- [ ] **Step 7: Manual verification**

```
Navigate to http://nyaho.localhost:8003/admin/service-points
Expected: no location dropdown in the header; all org service points listed with a "Used In" count; create/edit/delete/toggle all still work.
```

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/admin/service-points/page.tsx
git commit -m "feat: make Service Points admin page org-level (drop location scoping)"
```

---

### Task 9: Add Service wizard — scaffold, Step 1 (Basic Info), Step 2 (Locations)

**Files:**
- Create: `frontend/src/components/services/AddServiceWizard.tsx`
- Create: `frontend/src/components/services/wizardTypes.ts`

**Interfaces:**
- Produces: `WizardData` type (shared across all wizard steps), `<AddServiceWizard organizationId locations onClose onCreated />` component shell with step state.
- Consumes: `Location` type from `@/types`.

- [ ] **Step 1: Define the shared wizard data shape**

Create `frontend/src/components/services/wizardTypes.ts`:

```typescript
import type { ServiceType } from '@/types';

export interface WizardServicePoint {
  servicePointId: string;
  name: string;
  displayName?: string;
  capacity: number;
}

export interface WizardData {
  // Step 1: Basic Info
  name: string;
  description: string;
  type: ServiceType;
  requiresName: boolean;
  requiresPhone: boolean;
  allowAnonymous: boolean;
  displayMode: '' | 'TICKET_ONLY' | 'NAME_AND_TICKET' | 'FULL_INFO';

  // Step 2: Locations
  locationScope: 'specific' | 'all';
  selectedLocationId: string;

  // Step 3: Schedule
  slotDuration: number;
  concurrentLimit: number;
  activeDays: string;
  startTime: string;
  endTime: string;
  isActive: boolean;

  // Step 4: Service Points & Desks
  servicePoints: WizardServicePoint[];
}

export const initialWizardData: WizardData = {
  name: '',
  description: '',
  type: 'GENERAL',
  requiresName: true,
  requiresPhone: false,
  allowAnonymous: false,
  displayMode: '',
  locationScope: 'specific',
  selectedLocationId: '',
  slotDuration: 15,
  concurrentLimit: 1,
  activeDays: '1,2,3,4,5',
  startTime: '09:00',
  endTime: '17:00',
  isActive: true,
  servicePoints: [],
};
```

- [ ] **Step 2: Scaffold the wizard shell with Steps 1 and 2**

Create `frontend/src/components/services/AddServiceWizard.tsx`:

```tsx
'use client';

import React, { useState } from 'react';
import type { Location } from '@/types';
import { initialWizardData, type WizardData } from './wizardTypes';

interface AddServiceWizardProps {
  locations: Location[];
  onClose: () => void;
  onSubmit: (data: WizardData) => Promise<void>;
}

const STEP_LABELS = ['Basic Info', 'Location(s)', 'Schedule', 'Service Points & Desks', 'Review'];

export const AddServiceWizard: React.FC<AddServiceWizardProps> = ({ locations, onClose, onSubmit }) => {
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(initialWizardData);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = <K extends keyof WizardData>(key: K, value: WizardData[K]) => {
    setData(prev => ({ ...prev, [key]: value }));
  };

  const canProceedFromStep1 = data.name.trim().length > 0;
  const canProceedFromStep2 = data.locationScope === 'all' || !!data.selectedLocationId;

  const handleNext = () => setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  const handleBack = () => setStep(s => Math.max(s - 1, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await onSubmit(data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string; error?: string } } };
      setError(e.response?.data?.message || e.response?.data?.error || 'Failed to create service');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-modal" onClick={e => e.stopPropagation()}>
        <div className="wizard-header">
          <h2>Add Service</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="wizard-steps">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className={`wizard-step-indicator ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
              <span className="step-number">{i + 1}</span>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="wizard-body">
          {error && <div className="wizard-error">{error}</div>}

          {step === 0 && (
            <div className="wizard-step-content">
              <div className="form-group">
                <label>Service Name *</label>
                <input
                  type="text"
                  value={data.name}
                  onChange={e => update('name', e.target.value)}
                  placeholder="e.g., General Consultation"
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={data.description}
                  onChange={e => update('description', e.target.value)}
                  rows={3}
                  placeholder="Describe the service..."
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Type</label>
                  <select value={data.type} onChange={e => update('type', e.target.value as WizardData['type'])}>
                    <option value="GENERAL">General (First come, first served)</option>
                    <option value="INDIVIDUAL">Individual (Appointment-based)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Display Mode</label>
                  <select value={data.displayMode} onChange={e => update('displayMode', e.target.value as WizardData['displayMode'])}>
                    <option value="">Use organization default</option>
                    <option value="TICKET_ONLY">Ticket number only</option>
                    <option value="NAME_AND_TICKET">Name and ticket</option>
                    <option value="FULL_INFO">Full info</option>
                  </select>
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={data.requiresName} onChange={e => update('requiresName', e.target.checked)} />
                  Require customer name to join
                </label>
                <label>
                  <input type="checkbox" checked={data.requiresPhone} onChange={e => update('requiresPhone', e.target.checked)} />
                  Require phone number to join
                </label>
                <label>
                  <input type="checkbox" checked={data.allowAnonymous} onChange={e => update('allowAnonymous', e.target.checked)} />
                  Allow anonymous ticket (no info required)
                </label>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="wizard-step-content">
              <div className="location-scope-choice">
                <button
                  type="button"
                  className={`scope-option ${data.locationScope === 'specific' ? 'selected' : ''}`}
                  onClick={() => update('locationScope', 'specific')}
                >
                  <strong>Specific location</strong>
                  <span>Create this service at one location</span>
                </button>
                <button
                  type="button"
                  className={`scope-option ${data.locationScope === 'all' ? 'selected' : ''}`}
                  onClick={() => update('locationScope', 'all')}
                >
                  <strong>All locations</strong>
                  <span>Create this service at every location in your organization ({locations.length})</span>
                </button>
              </div>

              {data.locationScope === 'specific' && (
                <div className="form-group">
                  <label>Location *</label>
                  <select value={data.selectedLocationId} onChange={e => update('selectedLocationId', e.target.value)}>
                    <option value="">Select a location...</option>
                    {locations.map(loc => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {data.locationScope === 'all' && (
                <p className="scope-hint">
                  This service will be created identically at all {locations.length} location{locations.length === 1 ? '' : 's'}.
                  Each copy can be edited independently afterward.
                </p>
              )}
            </div>
          )}

          {/* Steps 2 (schedule) and 3 (service points) are added in the next task */}
        </div>

        <div className="wizard-footer">
          {step > 0 && <button className="btn-secondary" onClick={handleBack}>Back</button>}
          <div className="wizard-footer-spacer" />
          {step === 0 && <button className="btn-primary" disabled={!canProceedFromStep1} onClick={handleNext}>Next</button>}
          {step === 1 && <button className="btn-primary" disabled={!canProceedFromStep2} onClick={handleNext}>Next</button>}
          {step === STEP_LABELS.length - 1 && (
            <button className="btn-primary" disabled={submitting} onClick={handleSubmit}>
              {submitting ? 'Creating...' : 'Create Service'}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .wizard-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 1rem;
        }
        .wizard-modal {
          background: white;
          border-radius: 16px;
          width: 100%;
          max-width: 640px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .wizard-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid #e5e7eb;
        }
        .wizard-header h2 {
          margin: 0;
          font-size: 1.25rem;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 1.5rem;
          color: #9ca3af;
          cursor: pointer;
          line-height: 1;
        }
        .wizard-steps {
          display: flex;
          padding: 1rem 1.5rem;
          gap: 0.5rem;
          border-bottom: 1px solid #e5e7eb;
          overflow-x: auto;
        }
        .wizard-step-indicator {
          display: flex;
          align-items: center;
          gap: 0.375rem;
          font-size: 0.75rem;
          color: #9ca3af;
          white-space: nowrap;
        }
        .wizard-step-indicator.active {
          color: var(--primary);
          font-weight: 600;
        }
        .wizard-step-indicator.done {
          color: #16a34a;
        }
        .step-number {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
        }
        .wizard-step-indicator.active .step-number {
          background: var(--primary);
          color: white;
        }
        .wizard-step-indicator.done .step-number {
          background: #dcfce7;
          color: #16a34a;
        }
        .wizard-body {
          padding: 1.5rem;
          overflow-y: auto;
          flex: 1;
        }
        .wizard-error {
          padding: 0.75rem 1rem;
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
          border-radius: 8px;
          margin-bottom: 1rem;
          font-size: 0.875rem;
        }
        .form-group {
          margin-bottom: 1.25rem;
        }
        .form-group label {
          display: block;
          font-size: 0.85rem;
          font-weight: 600;
          color: #374151;
          margin-bottom: 0.5rem;
        }
        .form-group input[type="text"],
        .form-group input[type="time"],
        .form-group input[type="number"],
        .form-group select,
        .form-group textarea {
          width: 100%;
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          font-size: 0.95rem;
          background: #f9fafb;
          color: #111827;
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.25rem;
        }
        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 400;
          margin-bottom: 0.5rem;
        }
        .location-scope-choice {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 1.25rem;
        }
        .scope-option {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          padding: 1rem;
          border: 2px solid #e5e7eb;
          border-radius: 12px;
          background: white;
          cursor: pointer;
          text-align: left;
        }
        .scope-option.selected {
          border-color: var(--primary);
          background: rgba(20, 184, 166, 0.06);
        }
        .scope-option span {
          font-size: 0.8rem;
          color: #6b7280;
        }
        .scope-hint {
          font-size: 0.875rem;
          color: #6b7280;
          background: #f9fafb;
          padding: 0.75rem 1rem;
          border-radius: 8px;
        }
        .wizard-footer {
          display: flex;
          align-items: center;
          padding: 1.25rem 1.5rem;
          border-top: 1px solid #e5e7eb;
          gap: 0.75rem;
        }
        .wizard-footer-spacer {
          flex: 1;
        }
        .btn-primary {
          padding: 0.75rem 1.5rem;
          background: var(--primary);
          color: white;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-secondary {
          padding: 0.75rem 1.5rem;
          background: #f1f5f9;
          color: #64748b;
          border: none;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
        }
      `}</style>
    </div>
  );
};

export default AddServiceWizard;
```

- [ ] **Step 3: Verify types compile**

```bash
docker exec qms-frontend npx tsc --noEmit 2>&1 | grep AddServiceWizard
```
Expected: no output (the file isn't imported anywhere yet, so it must type-check standalone).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/services/AddServiceWizard.tsx frontend/src/components/services/wizardTypes.ts
git commit -m "feat: scaffold Add Service wizard with basic info and location steps"
```

---

### Task 10: Add Service wizard — Step 3 (Schedule), Step 4 (Service Points & Desks)

**Files:**
- Modify: `frontend/src/components/services/AddServiceWizard.tsx`
- Create: `frontend/src/components/services/ServicePointsDeskPicker.tsx`

**Interfaces:**
- Produces: `<ServicePointsDeskPicker organizationId selected onChange />` — a reusable component (also used by Task 12's Edit panel) that lists the org's service point definitions with a checkbox + desk-count input, and calls `onChange(WizardServicePoint[])` when the selection changes.
- Consumes: `api.getServicePoints(organizationId)`.

- [ ] **Step 1: Build the reusable desk picker component**

Create `frontend/src/components/services/ServicePointsDeskPicker.tsx`:

```tsx
'use client';

import React, { useEffect, useState } from 'react';
import api from '@/api/client';
import type { ServicePoint } from '@/types';
import type { WizardServicePoint } from './wizardTypes';

interface ServicePointsDeskPickerProps {
  organizationId: string;
  selected: WizardServicePoint[];
  onChange: (selected: WizardServicePoint[]) => void;
}

export const ServicePointsDeskPicker: React.FC<ServicePointsDeskPickerProps> = ({ organizationId, selected, onChange }) => {
  const [available, setAvailable] = useState<ServicePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getServicePoints(organizationId)
      .then((points: ServicePoint[]) => setAvailable(points.filter(p => p.isActive)))
      .catch((err: unknown) => console.error('Failed to load service points', err))
      .finally(() => setLoading(false));
  }, [organizationId]);

  const isSelected = (id: string) => selected.some(s => s.servicePointId === id);
  const getCapacity = (id: string) => selected.find(s => s.servicePointId === id)?.capacity;

  const toggle = (point: ServicePoint) => {
    if (isSelected(point.id)) {
      onChange(selected.filter(s => s.servicePointId !== point.id));
    } else {
      onChange([...selected, {
        servicePointId: point.id,
        name: point.name,
        displayName: point.displayName,
        capacity: point.capacity,
      }]);
    }
  };

  const setCapacity = (id: string, capacity: number) => {
    onChange(selected.map(s => s.servicePointId === id ? { ...s, capacity } : s));
  };

  if (loading) {
    return <p className="picker-hint">Loading service points...</p>;
  }

  if (available.length === 0) {
    return (
      <p className="picker-hint">
        No service points defined yet. Create some on the{' '}
        <a href="/admin/service-points" target="_blank" rel="noreferrer">Service Points page</a>{' '}
        first, then come back here.
      </p>
    );
  }

  return (
    <div className="desk-picker">
      {available.map(point => (
        <div key={point.id} className={`desk-picker-row ${isSelected(point.id) ? 'selected' : ''}`}>
          <label className="desk-picker-checkbox">
            <input type="checkbox" checked={isSelected(point.id)} onChange={() => toggle(point)} />
            <span>{point.displayName || point.name}</span>
            <span className="desk-picker-type">{point.type}</span>
          </label>
          {isSelected(point.id) && (
            <div className="desk-picker-capacity">
              <label>Desks</label>
              <input
                type="number"
                min={1}
                value={getCapacity(point.id) ?? point.capacity}
                onChange={e => setCapacity(point.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
              />
            </div>
          )}
        </div>
      ))}
      <style jsx>{`
        .picker-hint {
          font-size: 0.875rem;
          color: #6b7280;
        }
        .desk-picker {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .desk-picker-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
        }
        .desk-picker-row.selected {
          border-color: var(--primary);
          background: rgba(20, 184, 166, 0.06);
        }
        .desk-picker-checkbox {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          font-weight: 500;
          cursor: pointer;
        }
        .desk-picker-type {
          font-size: 0.7rem;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .desk-picker-capacity {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .desk-picker-capacity label {
          font-size: 0.75rem;
          color: #6b7280;
        }
        .desk-picker-capacity input {
          width: 56px;
          padding: 0.375rem 0.5rem;
          border: 1px solid #e5e7eb;
          border-radius: 6px;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default ServicePointsDeskPicker;
```

- [ ] **Step 2: Wire Steps 2 (Schedule) and 3 (Service Points) into the wizard**

In `AddServiceWizard.tsx`, add the import:

```typescript
import { ServicePointsDeskPicker } from './ServicePointsDeskPicker';
```

Add an `organizationId` prop to `AddServiceWizardProps`:

```typescript
interface AddServiceWizardProps {
  organizationId: string;
  locations: Location[];
  onClose: () => void;
  onSubmit: (data: WizardData) => Promise<void>;
}
```

Update the component signature to destructure it: `export const AddServiceWizard: React.FC<AddServiceWizardProps> = ({ organizationId, locations, onClose, onSubmit }) => {`.

Replace the `{/* Steps 2 (schedule) and 3 (service points) are added in the next task */}` placeholder comment with:

```tsx
          {step === 2 && (
            <div className="wizard-step-content">
              <div className="form-row">
                <div className="form-group">
                  <label>Slot Duration (minutes)</label>
                  <input type="number" min={5} value={data.slotDuration} onChange={e => update('slotDuration', parseInt(e.target.value, 10) || 15)} />
                </div>
                <div className="form-group">
                  <label>Concurrent Limit</label>
                  <input type="number" min={1} value={data.concurrentLimit} onChange={e => update('concurrentLimit', parseInt(e.target.value, 10) || 1)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" value={data.startTime} onChange={e => update('startTime', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" value={data.endTime} onChange={e => update('endTime', e.target.value)} />
                </div>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input type="checkbox" checked={data.isActive} onChange={e => update('isActive', e.target.checked)} />
                  Active (customers can join this service's queue)
                </label>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="wizard-step-content">
              <p className="scope-hint">
                Pick which service points (desks/counters) can serve this service, and how many desks each provides.
                {data.locationScope === 'all' && ' This same assignment is applied at every selected location.'}
              </p>
              <ServicePointsDeskPicker
                organizationId={organizationId}
                selected={data.servicePoints}
                onChange={sps => update('servicePoints', sps)}
              />
            </div>
          )}
```

Update the footer's "Next" button logic to cover steps 2 and 3 (schedule and service points have no hard validation gate — a service can be created with zero service points assigned, to be added later):

```tsx
          {step === 0 && <button className="btn-primary" disabled={!canProceedFromStep1} onClick={handleNext}>Next</button>}
          {step === 1 && <button className="btn-primary" disabled={!canProceedFromStep2} onClick={handleNext}>Next</button>}
          {(step === 2 || step === 3) && <button className="btn-primary" onClick={handleNext}>Next</button>}
```

- [ ] **Step 3: Verify types compile**

```bash
docker exec qms-frontend npx tsc --noEmit 2>&1 | grep -E "AddServiceWizard|ServicePointsDeskPicker"
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/services/AddServiceWizard.tsx frontend/src/components/services/ServicePointsDeskPicker.tsx
git commit -m "feat: add schedule and service-points/desks steps to the service wizard"
```

---

### Task 11: Add Service wizard — Step 5 (Review) + wire into ServicesPage

**Files:**
- Modify: `frontend/src/components/services/AddServiceWizard.tsx`
- Modify: `frontend/src/components/pages/ServicesPage.tsx`

**Interfaces:**
- Consumes: `api.createService(payload)` from Task 7.
- Produces: `<AddServiceWizard>` fully wired into `ServicesPage`'s "Add Service" button, replacing the old flat modal for creation (the flat modal's edit path is handled separately in Task 12).

- [ ] **Step 1: Add the Review step**

In `AddServiceWizard.tsx`, add a `getDayNames` helper near the top of the file (module scope, above the component):

```typescript
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const formatDays = (activeDays: string) => activeDays.split(',').map(d => DAY_NAMES[parseInt(d, 10)] || d).join(', ');
```

Add the Review step content, right after the Step 3 block from Task 10:

```tsx
          {step === 4 && (
            <div className="wizard-step-content">
              <div className="review-section">
                <h3>{data.name}</h3>
                {data.description && <p className="review-desc">{data.description}</p>}
                <div className="review-grid">
                  <div><span>Type</span><strong>{data.type}</strong></div>
                  <div><span>Hours</span><strong>{data.startTime} - {data.endTime}</strong></div>
                  <div><span>Days</span><strong>{formatDays(data.activeDays)}</strong></div>
                  <div><span>Slot Duration</span><strong>{data.slotDuration} min</strong></div>
                </div>
              </div>
              <div className="review-section">
                <h4>Location(s)</h4>
                <p>
                  {data.locationScope === 'all'
                    ? `All ${locations.length} location${locations.length === 1 ? '' : 's'} in your organization`
                    : locations.find(l => l.id === data.selectedLocationId)?.name || 'None selected'}
                </p>
              </div>
              <div className="review-section">
                <h4>Service Points & Desks</h4>
                {data.servicePoints.length === 0 ? (
                  <p className="review-empty">None assigned yet — you can add these after creating the service.</p>
                ) : (
                  <ul className="review-list">
                    {data.servicePoints.map(sp => (
                      <li key={sp.servicePointId}>{sp.displayName || sp.name} — {sp.capacity} desk{sp.capacity === 1 ? '' : 's'}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
```

Add the corresponding CSS to the `<style jsx>` block:

```css
        .review-section {
          margin-bottom: 1.5rem;
        }
        .review-section h3 {
          margin: 0 0 0.25rem;
        }
        .review-section h4 {
          margin: 0 0 0.5rem;
          font-size: 0.9rem;
          color: #374151;
        }
        .review-desc {
          color: #6b7280;
          margin: 0 0 0.75rem;
        }
        .review-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 0.75rem;
        }
        .review-grid div {
          display: flex;
          flex-direction: column;
          gap: 0.125rem;
          font-size: 0.85rem;
        }
        .review-grid span {
          color: #6b7280;
          font-size: 0.75rem;
        }
        .review-list {
          margin: 0;
          padding-left: 1.25rem;
          font-size: 0.875rem;
          color: #374151;
        }
        .review-empty {
          font-size: 0.875rem;
          color: #6b7280;
        }
```

- [ ] **Step 2: Wire the wizard into `ServicesPage.tsx`**

In `frontend/src/components/pages/ServicesPage.tsx`, add the import:

```typescript
import { AddServiceWizard } from '@/components/services/AddServiceWizard';
import type { WizardData } from '@/components/services/wizardTypes';
```

Add wizard-visibility state alongside the existing `showForm`/`showDetails` state:

```typescript
  const [showWizard, setShowWizard] = useState(false);
```

Add a submit handler, near `handleCreateService`:

```typescript
  const handleWizardSubmit = async (data: WizardData) => {
    const locationIds = data.locationScope === 'all'
      ? locations.map(l => l.id)
      : [data.selectedLocationId];

    await api.createService({
      name: data.name,
      description: data.description,
      type: data.type,
      requiresName: data.requiresName,
      requiresPhone: data.requiresPhone,
      allowAnonymous: data.allowAnonymous,
      displayMode: data.displayMode || undefined,
      slotDuration: data.slotDuration,
      concurrentLimit: data.concurrentLimit,
      activeDays: data.activeDays,
      startTime: data.startTime,
      endTime: data.endTime,
      isActive: data.isActive,
      locationIds,
      servicePoints: data.servicePoints.map(sp => ({ servicePointId: sp.servicePointId, capacity: sp.capacity })),
    });

    await loadServices(selectedLocation);
    await refreshSubscription();
    setShowWizard(false);
  };
```

Change the "Add Service" button's `onClick` (in the `PageHeader`'s `actions`) from `() => { resetForm(); setShowForm(true); }` to `() => setShowWizard(true)`.

Render the wizard near the bottom of the JSX, right before the closing `</div>` that wraps the page content (after the "Create/Edit Service Form" block, since editing still uses the old flat form until Task 12):

```tsx
        {showWizard && user?.organizationId && (
          <AddServiceWizard
            organizationId={user.organizationId}
            locations={locations}
            onClose={() => setShowWizard(false)}
            onSubmit={handleWizardSubmit}
          />
        )}
```

- [ ] **Step 3: Remove the now-dead create path from the old flat form**

The existing `showForm`/`handleCreateService`/`startEdit`-for-create path is only needed for editing now (Task 12 replaces edit too, but do this task's scope narrowly: just stop the "Add Service" button from opening it). Leave `handleCreateService` itself in place for now — Task 12 removes it once the edit flow is migrated too, to avoid a half-broken intermediate state.

- [ ] **Step 4: Manual verification**

```
Navigate to http://nyaho.localhost:8003/services
Click "Add Service" -> wizard opens
Step through: name "Checkup", location "specific" -> pick a location, schedule defaults, pick a service point with 2 desks, review, Create Service
Expected: service appears in the grid; check the desk count in Queue Management's desk selector for that service shows 2 options for the assigned service point.

Repeat with "All locations" (if more than one location exists) and confirm one service is created per location, all named identically.
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/services/AddServiceWizard.tsx frontend/src/components/pages/ServicesPage.tsx
git commit -m "feat: wire Add Service wizard into ServicesPage with review step"
```

---

### Task 12: Edit Service panel — reuse schedule + service-points/desks, remove old flat form

**Files:**
- Modify: `frontend/src/components/pages/ServicesPage.tsx`

**Interfaces:**
- Consumes: `ServicePointsDeskPicker` from Task 10, `api.updateService(id, { ...fields, servicePoints })` from Task 7.
- Produces: replaces the flat "Create/Edit Service Form" with an edit-only panel (creation now only happens via the wizard).

- [ ] **Step 1: Load the service's current service-point assignments when editing starts**

Replace `startEdit` (currently lines 179-193):

```typescript
  const startEdit = async (service: Service) => {
    setEditingService(service);
    setFormData({
      name: service.name,
      description: service.description || '',
      type: service.type,
      slotDuration: service.slotDuration,
      concurrentLimit: service.concurrentLimit,
      startTime: service.startTime || '09:00',
      endTime: service.endTime || '17:00',
      activeDays: service.activeDays || '1,2,3,4,5',
    });
    const linked = await api.getServicePointsForService(service.id);
    setEditServicePoints(linked.map((sp: LinkedServicePoint) => ({
      servicePointId: sp.id,
      name: sp.name,
      displayName: sp.displayName,
      capacity: sp.capacity,
    })));
    setShowForm(true);
    setShowDetails(false);
  };
```

Add the new state near the existing `formData` state:

```typescript
  const [editServicePoints, setEditServicePoints] = useState<WizardServicePoint[]>([]);
```

Add the import at the top:

```typescript
import { ServicePointsDeskPicker } from '@/components/services/ServicePointsDeskPicker';
import type { WizardServicePoint } from '@/components/services/wizardTypes';
```

- [ ] **Step 2: Include `servicePoints` in the update call**

Replace `handleUpdateService` (currently lines 145-156):

```typescript
  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    try {
      await api.updateService(editingService.id, {
        ...formData,
        servicePoints: editServicePoints.map(sp => ({ servicePointId: sp.servicePointId, capacity: sp.capacity })),
      });
      await loadServices(selectedLocation);
      resetForm();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update service');
    }
  };
```

- [ ] **Step 3: Reset `editServicePoints` in `resetForm`**

In `resetForm` (currently lines 195-210), add `setEditServicePoints([]);` alongside the other resets.

- [ ] **Step 4: Remove the create path — the form is edit-only now**

Delete `handleCreateService` entirely (Task 11 already stopped the "Add Service" button from calling it — nothing else references it after this).

Change the form's `onSubmit` from `editingService ? handleUpdateService : handleCreateService` to just `handleUpdateService`, since `showForm` now only ever opens via `startEdit`.

Change the form's conditional title/button text from `editingService ? 'Edit Service' : 'Create New Service'` to just `'Edit Service'` (and similarly `editingService ? 'Save Changes' : 'Create Service'` to just `'Save Changes'`), since a null `editingService` can no longer reach this form.

Remove the "No Services Yet" empty state's `onClick={() => setShowForm(true)}` button — replace it with one that opens the wizard instead: `onClick={() => setShowWizard(true)}`.

- [ ] **Step 5: Add the desk picker into the edit form**

In the form JSX, right after the `formFieldFull` description block and before `formActions`, add:

```tsx
              <div style={formFieldFull}>
                <label style={labelStyle}>Service Points & Desks</label>
                {editingService && (
                  <ServicePointsDeskPicker
                    organizationId={user?.organizationId || ''}
                    selected={editServicePoints}
                    onChange={setEditServicePoints}
                  />
                )}
              </div>
```

- [ ] **Step 6: Remove the now-redundant standalone "Manage Service Points" panel**

The `showServicePointsPanel` block (currently lines 472-666) and its supporting state/handlers (`locationServicePoints`, `linkedServicePoints`, `showServicePointsPanel`, `loadLocationServicePoints`, `loadLinkedServicePoints`, `handleLinkServicePoint`, `handleUnlinkServicePoint`, `handleUpdateLinkCapacity`, `openServicePointsPanel`) are superseded by the desk picker now embedded directly in the edit form. Remove the JSX block and all the listed state/handlers. Remove the "Manage Service Points" button from the details panel's actions (`detailsActions`) — it called `openServicePointsPanel`, which no longer exists.

- [ ] **Step 7: Verify types compile**

```bash
docker exec qms-frontend npx tsc --noEmit 2>&1 | grep ServicesPage
```
Expected: only the pre-existing `Property 'queues' does not exist on type 'Service'` error, nothing new.

- [ ] **Step 8: Manual verification**

```
Navigate to http://nyaho.localhost:8003/services
Click a service card -> Edit Service
Expected: form shows current schedule fields plus a Service Points & Desks picker pre-checked with its current assignments.
Change desk count on an assigned service point, save.
Expected: Queue Management's desk selector for that service reflects the new desk count.
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/pages/ServicesPage.tsx
git commit -m "feat: reuse service-points/desks picker in Edit Service, remove old standalone linking panel"
```

---

### Task 13: Migration backfill unit tests + wizard transaction test

**Files:**
- Create: `backend/src/controllers/__tests__/servicePointMigrationBackfill.test.ts`
- Create: `backend/src/controllers/__tests__/serviceWizardTransaction.test.ts`

**Interfaces:**
- Consumes: none beyond `vitest` (already a dev dependency from the payment-provider work).

- [ ] **Step 1: Write a backfill-logic test against a throwaway schema fixture**

Since the migration SQL itself (Task 1) is a one-time operation against the real database rather than application code, the meaningful thing to unit-test is the *edge-case logic* it encodes: which `ServicePointService` link an orphaned instance should attach to. Extract that as a pure function so it's testable without a database.

Create `backend/src/lib/instanceBackfill.ts`:

```typescript
export interface BackfillLink {
  id: string;
  serviceId: string;
  createdAt: Date;
}

export interface BackfillInstance {
  servicePointId: string;
  currentServiceId: string | null;
}

// Mirrors the SQL migration's ORDER BY (serviceId = currentServiceId) DESC, createdAt ASC, LIMIT 1:
// prefer the link matching currentServiceId if set, else the earliest-created link.
export function resolveBackfillLink(instance: BackfillInstance, linksForServicePoint: BackfillLink[]): string | null {
  if (linksForServicePoint.length === 0) return null;

  if (instance.currentServiceId) {
    const matching = linksForServicePoint.find(l => l.serviceId === instance.currentServiceId);
    if (matching) return matching.id;
  }

  const sorted = [...linksForServicePoint].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  return sorted[0].id;
}
```

Create `backend/src/controllers/__tests__/servicePointMigrationBackfill.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { resolveBackfillLink } from '../../lib/instanceBackfill';

describe('resolveBackfillLink', () => {
  it('returns null when the service point has zero links', () => {
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: null }, []);
    expect(result).toBeNull();
  });

  it('picks the single link when there is exactly one', () => {
    const links = [{ id: 'link1', serviceId: 'svc1', createdAt: new Date('2026-01-01') }];
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: null }, links);
    expect(result).toBe('link1');
  });

  it('prefers the link matching currentServiceId over an earlier-created one', () => {
    const links = [
      { id: 'link1', serviceId: 'svc1', createdAt: new Date('2026-01-01') },
      { id: 'link2', serviceId: 'svc2', createdAt: new Date('2026-01-02') },
    ];
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: 'svc2' }, links);
    expect(result).toBe('link2');
  });

  it('falls back to the earliest-created link when currentServiceId matches nothing', () => {
    const links = [
      { id: 'link1', serviceId: 'svc1', createdAt: new Date('2026-01-02') },
      { id: 'link2', serviceId: 'svc2', createdAt: new Date('2026-01-01') },
    ];
    const result = resolveBackfillLink({ servicePointId: 'sp1', currentServiceId: 'svc-nonexistent' }, links);
    expect(result).toBe('link2');
  });
});
```

- [ ] **Step 2: Run the backfill test**

```bash
cd backend
npx vitest run src/controllers/__tests__/servicePointMigrationBackfill.test.ts
```
Expected: 4 tests passing.

- [ ] **Step 3: Write the wizard bulk-creation rollback test**

Create `backend/src/controllers/__tests__/serviceWizardTransaction.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';

// Mirrors the transactional loop from service.controller.ts's createService:
// if any location's service creation throws, nothing already created in
// this call should survive - simulated here with a fake $transaction that
// rolls back its recorded writes on throw, the same contract Prisma provides.
async function createServicesTransactionally(
  locationIds: string[],
  createOne: (locationId: string) => Promise<{ id: string }>
): Promise<{ id: string }[]> {
  const created: { id: string }[] = [];
  try {
    for (const locationId of locationIds) {
      created.push(await createOne(locationId));
    }
    return created;
  } catch (err) {
    created.length = 0; // simulates transaction rollback discarding all writes
    throw err;
  }
}

describe('service wizard bulk creation', () => {
  it('creates one service per location on success', async () => {
    const createOne = vi.fn(async (locationId: string) => ({ id: `service-${locationId}` }));
    const result = await createServicesTransactionally(['loc1', 'loc2', 'loc3'], createOne);
    expect(result).toHaveLength(3);
    expect(createOne).toHaveBeenCalledTimes(3);
  });

  it('discards all created services if any location fails', async () => {
    const createOne = vi.fn(async (locationId: string) => {
      if (locationId === 'loc2') throw new Error('limit exceeded');
      return { id: `service-${locationId}` };
    });

    await expect(createServicesTransactionally(['loc1', 'loc2', 'loc3'], createOne)).rejects.toThrow('limit exceeded');
  });
});
```

- [ ] **Step 4: Run the wizard transaction test**

```bash
cd backend
npx vitest run src/controllers/__tests__/serviceWizardTransaction.test.ts
```
Expected: 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/instanceBackfill.ts backend/src/controllers/__tests__/servicePointMigrationBackfill.test.ts backend/src/controllers/__tests__/serviceWizardTransaction.test.ts
git commit -m "test: cover migration backfill link resolution and wizard bulk-creation rollback"
```

---

### Task 14: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Confirm backend and frontend containers are running from the merged branch**

```bash
docker inspect qms-backend --format '{{json .Mounts}}'
docker inspect qms-frontend --format '{{json .Mounts}}'
```
Expected: both mount from the repo root currently checked out (not a stale worktree — this bit the team earlier in this project's history, so it's worth re-checking here too).

- [ ] **Step 2: Run the full vitest suite**

```bash
cd backend
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx vitest run
```
Expected: all tests passing, including the new ones from Task 13 and the pre-existing payment-provider tests.

- [ ] **Step 3: Full type-check both sides**

```bash
cd backend && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/queue_management" npx tsc --noEmit
docker exec qms-frontend npx tsc --noEmit
```
Expected: backend clean; frontend shows only the 3 pre-existing unrelated errors noted throughout this plan.

- [ ] **Step 4: Browser walkthrough**

```
1. /admin/service-points — create 2-3 service point definitions if the dev DB doesn't already have some usable ones.
2. /services — run the wizard for a specific location, assigning at least one service point with 2 desks. Confirm the service appears.
3. /queues — select that service, confirm the desk selector shows 2 options for the assigned service point, and that selecting one works without logging you out (the bug fixed earlier this session).
4. /services — edit that service, remove one service point assignment, add a different one, save. Confirm /queues reflects the change.
5. /admin/locations — if there's more than one location, run the wizard again with "All locations" and confirm one service is created per location, all with the same name.
6. /display/<locationId> — confirm the display board still loads and shows currently-serving info without errors (this exercises the getActiveServicePoints/getLocationQueues rewrites from Task 4).
```

- [ ] **Step 5: Report completion**

No code changes in this task — if all checks above pass, the feature is complete and ready to hand off via the finishing-a-development-branch skill.
