# Usage Tracking & Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce queue-throughput limits (daily + billing-period caps) on subscription plans, and surface all tracked usage (locations, users, services, queue entries) to organizations on the billing page and admin dashboard.

**Architecture:** Extend the existing `checkLimit` live-COUNT pattern in `subscription.middleware.ts` with two new limit types backed by `QueueEntry.joinedAt`, scoped through the existing `queue → service → location → organizationId` join chain. No new tables besides one nullable column. A new shared `UsageBar` component (matching the existing `Checkbox`/`Switch`/`Modal` pattern in `components/ui`) renders usage on both frontend surfaces from the single `getMySubscription` endpoint.

**Tech Stack:** Express + Prisma + PostgreSQL (backend), Next.js + React (frontend), Vitest (backend tests).

**Spec:** `docs/superpowers/specs/2026-08-25-usage-tracking-limits-design.md`

## Global Constraints

- Hitting a daily or period queue-entry cap is a **hard block** — both public join and staff add-to-queue refuse new entries until the cap resets.
- The period cap resets on the org's billing cycle (`OrganizationSubscription.currentPeriodStart`), not a fixed calendar month.
- The period cap is an **independent plan field** (`maxQueueEntriesPerPeriod`), not derived from the daily cap.
- Usage is computed via **live COUNT queries** — no denormalized counters, no aggregation jobs.
- Usage is surfaced via **one endpoint** (`GET /subscription` / `getMySubscription`), consumed by both the billing page and the dashboard widget.
- `null` on `maxQueueEntriesPerDay` / `maxQueueEntriesPerPeriod` means unlimited (no cap enforced, no bar shown).

---

### Task 1: Add `maxQueueEntriesPerPeriod` column to `SubscriptionPlan`

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Create: `backend/prisma/migrations/20260825190000_add_queue_entries_period_limit/migration.sql`

**Interfaces:**
- Produces: `SubscriptionPlan.maxQueueEntriesPerPeriod: number | null` (Prisma Client field), consumed by Task 2 and Task 4.

- [ ] **Step 1: Add the field to the schema**

In `backend/prisma/schema.prisma`, in the `SubscriptionPlan` model, add the new column directly below `maxQueueEntriesPerDay`:

```prisma
  maxQueueEntriesPerDay Int?                     // Max daily queue entries across all queues
  maxQueueEntriesPerPeriod Int?                  // Max queue entries across the current billing period (null = unlimited)
```

- [ ] **Step 2: Write the migration SQL**

Create `backend/prisma/migrations/20260825190000_add_queue_entries_period_limit/migration.sql`:

```sql
ALTER TABLE "SubscriptionPlan" ADD COLUMN "maxQueueEntriesPerPeriod" INTEGER;
```

- [ ] **Step 3: Apply the migration and regenerate the client**

Run:
```bash
docker compose restart backend
docker logs qms-backend --tail 30
```

Expected: logs show `npx prisma migrate deploy` applying `20260825190000_add_queue_entries_period_limit` successfully, then the dev server starting with no errors.

- [ ] **Step 4: Verify the column exists**

Run:
```bash
docker exec qms-backend node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.subscriptionPlan.findFirst({ select: { code: true, maxQueueEntriesPerPeriod: true } }).then(r => { console.log(JSON.stringify(r)); process.exit(0); });
"
```
Expected: JSON output with `maxQueueEntriesPerPeriod: null` (no error).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260825190000_add_queue_entries_period_limit
git commit -m "feat: add maxQueueEntriesPerPeriod column to SubscriptionPlan"
```

---

### Task 2: Extend `checkLimit` with queue-entry limit types

**Files:**
- Modify: `backend/src/middleware/subscription.middleware.ts:223-275` (the `checkLimit` function)
- Create: `backend/src/middleware/subscription.middleware.test.ts`

**Interfaces:**
- Consumes: `SubscriptionPlan.maxQueueEntriesPerDay: number | null`, `SubscriptionPlan.maxQueueEntriesPerPeriod: number | null` (Task 1), `getStartOfDay(date?: Date): Date` from `backend/src/utils/date.ts`.
- Produces: `checkLimit(organizationId: string, limitType: 'locations' | 'services' | 'users' | 'queueEntriesDaily' | 'queueEntriesPeriod'): Promise<{ current: number; limit: number | null; allowed: boolean }>` — the widened signature and two new cases, consumed by Task 3 (`joinQueue`).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/middleware/subscription.middleware.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    organization: { findUnique: vi.fn() },
    queueEntry: { count: vi.fn() },
  },
}));

import prisma from '../lib/prisma';
import { checkLimit } from './subscription.middleware';

function mockActiveOrg(planOverrides: Record<string, any>, periodStart = new Date('2026-08-01T00:00:00Z')) {
  (prisma.organization.findUnique as any).mockResolvedValue({
    subscription: {
      id: 'sub1',
      status: 'ACTIVE',
      trialEndsAt: null,
      planId: 'plan1',
      currentPeriodStart: periodStart,
      plan: {
        id: 'plan1',
        expiredFallbackPlanId: null,
        maxQueueEntriesPerDay: null,
        maxQueueEntriesPerPeriod: null,
        ...planOverrides,
      },
    },
  });
}

describe('checkLimit - queueEntriesDaily', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is unlimited (allowed=true, limit=null) when maxQueueEntriesPerDay is null', async () => {
    mockActiveOrg({});
    (prisma.queueEntry.count as any).mockResolvedValue(500);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 500, limit: null, allowed: true });
  });

  it('blocks once the daily count reaches the plan limit', async () => {
    mockActiveOrg({ maxQueueEntriesPerDay: 10 });
    (prisma.queueEntry.count as any).mockResolvedValue(10);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 10, limit: 10, allowed: false });
  });

  it('allows joins below the daily limit', async () => {
    mockActiveOrg({ maxQueueEntriesPerDay: 10 });
    (prisma.queueEntry.count as any).mockResolvedValue(9);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 9, limit: 10, allowed: true });
  });

  it('hard-blocks (limit=0) when the subscription is not usable', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({
      subscription: {
        id: 'sub1',
        status: 'PAST_DUE',
        trialEndsAt: null,
        planId: 'plan1',
        currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
        plan: { id: 'plan1', expiredFallbackPlanId: null, maxQueueEntriesPerDay: 100, maxQueueEntriesPerPeriod: 1000 },
      },
    });
    (prisma.queueEntry.count as any).mockResolvedValue(0);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 0, limit: 0, allowed: false });
  });
});

describe('checkLimit - queueEntriesPeriod', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts from the subscription currentPeriodStart, not a calendar month', async () => {
    const periodStart = new Date('2026-08-10T00:00:00Z');
    mockActiveOrg({ maxQueueEntriesPerPeriod: 50 }, periodStart);
    (prisma.queueEntry.count as any).mockResolvedValue(20);

    const result = await checkLimit('org1', 'queueEntriesPeriod');

    expect(result).toEqual({ current: 20, limit: 50, allowed: true });
    expect(prisma.queueEntry.count).toHaveBeenCalledWith({
      where: {
        queue: { service: { location: { organizationId: 'org1' } } },
        joinedAt: { gte: periodStart },
      },
    });
  });

  it('blocks once the period count reaches the plan limit', async () => {
    mockActiveOrg({ maxQueueEntriesPerPeriod: 50 });
    (prisma.queueEntry.count as any).mockResolvedValue(50);

    const result = await checkLimit('org1', 'queueEntriesPeriod');

    expect(result).toEqual({ current: 50, limit: 50, allowed: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/middleware/subscription.middleware.test.ts`
Expected: FAIL — `checkLimit` throws or returns wrong shape for `'queueEntriesDaily'`/`'queueEntriesPeriod'` (the switch statement has no matching case yet, so `current`/`limit` stay `0`, and `queueEntry.count` from the mock is never invoked as expected by the period test's `toHaveBeenCalledWith` assertion).

- [ ] **Step 3: Extend `checkLimit`'s type signature and implementation**

In `backend/src/middleware/subscription.middleware.ts`, add the import at the top (alongside the existing imports):

```typescript
import { getStartOfDay } from '../utils/date';
```

Replace the `checkLimit` function (lines 223-275) with:

```typescript
export const checkLimit = async (
  organizationId: string,
  limitType: 'locations' | 'services' | 'users' | 'queueEntriesDaily' | 'queueEntriesPeriod'
): Promise<{ current: number; limit: number | null; allowed: boolean }> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  let subscription = org?.subscription ?? null;
  if (subscription) {
    subscription = await applyExpiryIfNeeded(subscription);
  }

  const isUsable = subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL');
  // Limit numbers live on the plan's dedicated columns (maxLocations /
  // maxServicesPerLoc / maxUsersPerOrg / maxQueueEntriesPerDay /
  // maxQueueEntriesPerPeriod), not in the features JSON blob — nothing
  // populates those keys in `features`. An unusable subscription (e.g.
  // EXPIRED with no fallback) still resolves to a hard 0, matching the
  // previous features-based fallback behavior for that case.
  const planLimits = isUsable
    ? {
        maxLocations: subscription!.plan.maxLocations,
        maxServicesPerLoc: subscription!.plan.maxServicesPerLoc,
        maxUsersPerOrg: subscription!.plan.maxUsersPerOrg,
        maxQueueEntriesPerDay: subscription!.plan.maxQueueEntriesPerDay,
        maxQueueEntriesPerPeriod: subscription!.plan.maxQueueEntriesPerPeriod,
      }
    : { maxLocations: 0, maxServicesPerLoc: 0, maxUsersPerOrg: 0, maxQueueEntriesPerDay: 0, maxQueueEntriesPerPeriod: 0 };

  let current = 0;
  let limit: number | null = 0;

  switch (limitType) {
    case 'locations':
      current = await prisma.location.count({ where: { organizationId } });
      limit = planLimits.maxLocations ?? DEFAULT_FEATURES.maxLocations ?? 1;
      break;
    case 'services':
      current = await prisma.service.count({
        where: { location: { organizationId } },
      });
      limit = planLimits.maxServicesPerLoc ?? DEFAULT_FEATURES.maxServices ?? 3;
      break;
    case 'users':
      current = await prisma.user.count({ where: { organizationId } });
      limit = planLimits.maxUsersPerOrg ?? DEFAULT_FEATURES.maxUsers ?? 5;
      break;
    case 'queueEntriesDaily':
      current = await prisma.queueEntry.count({
        where: {
          queue: { service: { location: { organizationId } } },
          joinedAt: { gte: getStartOfDay() },
        },
      });
      limit = planLimits.maxQueueEntriesPerDay;
      break;
    case 'queueEntriesPeriod': {
      const periodStart = isUsable ? subscription!.currentPeriodStart : new Date(0);
      current = await prisma.queueEntry.count({
        where: {
          queue: { service: { location: { organizationId } } },
          joinedAt: { gte: periodStart },
        },
      });
      limit = planLimits.maxQueueEntriesPerPeriod;
      break;
    }
  }

  return {
    current,
    limit,
    allowed: limit === null ? true : current < limit,
  };
};
```

Note: this changes the exported `limit` type from `number` to `number | null` for all callers. `enforceLimit` (the next function in this file) reads `limit`/`allowed` off the result but never inspects `limit`'s type beyond interpolating it into a message string, so no changes are needed there — `null` interpolates as the string `"null"`, but `enforceLimit` is never called with `'queueEntriesDaily'`/`'queueEntriesPeriod'` (Task 3 calls `checkLimit` directly), so this is unreachable in practice.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/middleware/subscription.middleware.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Run the full backend test suite to check for regressions**

Run: `cd backend && npm test`
Expected: PASS — in particular `src/controllers/__tests__/serviceWizardTransaction.test.ts` (which mocks `checkLimit`) and `src/lib/subscriptionExpiry.test.ts` still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/subscription.middleware.ts backend/src/middleware/subscription.middleware.test.ts
git commit -m "feat: extend checkLimit with queueEntriesDaily and queueEntriesPeriod limit types"
```

---

### Task 3: Enforce queue-entry limits on join

**Files:**
- Modify: `backend/src/controllers/queue.controller.ts:143-231` (the `joinQueue` function)
- Create: `backend/src/controllers/__tests__/joinQueue.test.ts`

**Interfaces:**
- Consumes: `checkLimit(organizationId, limitType)` from Task 2.
- Produces: `POST /queues/:id/join` now returns `403 { error: 'Limit reached', message, limitType, current, limit }` when a cap is hit — consumed by the frontend join flow (out of scope for this plan to change; the existing generic error-toast handling on the join page already surfaces any non-2xx `error`/`message` field, verified in Task 9).

- [ ] **Step 1: Write the failing tests**

Create `backend/src/controllers/__tests__/joinQueue.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    queue: { findUnique: vi.fn() },
    queueEntry: { findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
  },
}));

vi.mock('../../middleware/subscription.middleware', () => ({
  checkLimit: vi.fn(),
}));

vi.mock('../../lib/socket', () => ({
  emitToQueue: vi.fn(),
  emitToService: vi.fn(),
  emitToLocation: vi.fn(),
  emitToQueueAndLocation: vi.fn(),
  SOCKET_EVENTS: { QUEUE_UPDATED: 'queue:updated' },
}));

vi.mock('../../utils/ticket', () => ({
  generateTicketNumber: vi.fn(() => 'A-001'),
  getNextSequence: vi.fn(async () => 1),
  generateQRData: vi.fn(() => 'qr-data'),
}));

import prisma from '../../lib/prisma';
import { checkLimit } from '../../middleware/subscription.middleware';
import { joinQueue } from '../queue.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const mockQueue = {
  id: 'queue1',
  status: 'ACTIVE',
  service: {
    id: 'service1',
    name: 'Consultation',
    location: { id: 'loc1', organizationId: 'org1' },
  },
};

describe('joinQueue - subscription limit enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (prisma.queue.findUnique as any).mockResolvedValue(mockQueue);
    (prisma.queueEntry.findFirst as any).mockResolvedValue(null);
  });

  it('blocks the join with 403 when the daily queue-entry limit is reached', async () => {
    (checkLimit as any).mockImplementation(async (_orgId: string, limitType: string) =>
      limitType === 'queueEntriesDaily'
        ? { current: 10, limit: 10, allowed: false }
        : { current: 2, limit: 100, allowed: true }
    );

    const req: any = { params: { id: 'queue1' }, body: { userId: 'user1' } };
    const res = makeRes();
    const next = vi.fn();

    await joinQueue(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ limitType: 'queueEntriesDaily', current: 10, limit: 10 }));
    expect(prisma.queueEntry.create).not.toHaveBeenCalled();
  });

  it('blocks the join with 403 when the period queue-entry limit is reached', async () => {
    (checkLimit as any).mockImplementation(async (_orgId: string, limitType: string) =>
      limitType === 'queueEntriesPeriod'
        ? { current: 500, limit: 500, allowed: false }
        : { current: 2, limit: 100, allowed: true }
    );

    const req: any = { params: { id: 'queue1' }, body: { userId: 'user1' } };
    const res = makeRes();
    const next = vi.fn();

    await joinQueue(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ limitType: 'queueEntriesPeriod', current: 500, limit: 500 }));
    expect(prisma.queueEntry.create).not.toHaveBeenCalled();
  });

  it('allows the join through to creation when both limits are under cap', async () => {
    (checkLimit as any).mockResolvedValue({ current: 2, limit: 100, allowed: true });
    (prisma.queueEntry.create as any).mockResolvedValue({
      id: 'entry1',
      queueId: 'queue1',
      userId: 'user1',
      priority: 0,
      joinedAt: new Date(),
      queue: { service: {} },
      user: {},
    });
    (prisma.queueEntry.count as any).mockResolvedValue(0);

    const req: any = { params: { id: 'queue1' }, body: { userId: 'user1' } };
    const res = makeRes();
    const next = vi.fn();

    await joinQueue(req, res, next);

    expect(prisma.queueEntry.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && npx vitest run src/controllers/__tests__/joinQueue.test.ts`
Expected: FAIL — `checkLimit` is never called (no enforcement code yet), so all three tests fail: the first two expect a 403 that never happens, and `queueEntry.create` gets called even when the mock says a limit was reached.

- [ ] **Step 3: Add enforcement to `joinQueue`**

In `backend/src/controllers/queue.controller.ts`, add the import at the top:

```typescript
import { checkLimit } from '../middleware/subscription.middleware';
```

In the `joinQueue` function, insert this block immediately after the existing `if (queue.status !== 'ACTIVE') { ... }` check (i.e. right before the "Check if user is already in this queue" comment):

```typescript
    const organizationId = queue.service.location.organizationId;
    const [dailyCheck, periodCheck] = await Promise.all([
      checkLimit(organizationId, 'queueEntriesDaily'),
      checkLimit(organizationId, 'queueEntriesPeriod'),
    ]);

    if (!dailyCheck.allowed) {
      return res.status(403).json({
        error: 'Limit reached',
        message: `This location has reached its daily queue entry limit (${dailyCheck.limit}). Please try again tomorrow.`,
        limitType: 'queueEntriesDaily',
        current: dailyCheck.current,
        limit: dailyCheck.limit,
      });
    }

    if (!periodCheck.allowed) {
      return res.status(403).json({
        error: 'Limit reached',
        message: `This organization has reached its queue entry limit for the current billing period (${periodCheck.limit}).`,
        limitType: 'queueEntriesPeriod',
        current: periodCheck.current,
        limit: periodCheck.limit,
      });
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && npx vitest run src/controllers/__tests__/joinQueue.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Run the full backend test suite to check for regressions**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/queue.controller.ts backend/src/controllers/__tests__/joinQueue.test.ts
git commit -m "feat: enforce daily and period queue-entry limits on join"
```

---

### Task 4: Surface queue-entry usage in `getMySubscription`

**Files:**
- Modify: `backend/src/middleware/subscription.middleware.ts:344-467` (the `getMySubscription` function)

**Interfaces:**
- Consumes: `getStartOfDay` (already imported in Task 2).
- Produces: `GET /subscription` response gains `limits.queueEntriesDaily: { current, limit, allowed }` and `limits.queueEntriesPeriod: { current, limit, allowed }` — consumed by Task 7 (billing page) and Task 8 (dashboard widget).

- [ ] **Step 1: Add queue-entry counts and limits to the response**

In `backend/src/middleware/subscription.middleware.ts`, inside `getMySubscription`, find the block:

```typescript
    // Get current counts
    const [locationCount, serviceCount, userCount] = await Promise.all([
      prisma.location.count({ where: { organizationId: user.organizationId } }),
      prisma.service.count({ where: { location: { organizationId: user.organizationId } } }),
      prisma.user.count({ where: { organizationId: user.organizationId } }),
    ]);
```

Replace it with:

```typescript
    // Get current counts
    const periodStart = isUsable ? subscription!.currentPeriodStart : new Date(0);
    const [locationCount, serviceCount, userCount, queueEntriesTodayCount, queueEntriesPeriodCount] = await Promise.all([
      prisma.location.count({ where: { organizationId: user.organizationId } }),
      prisma.service.count({ where: { location: { organizationId: user.organizationId } } }),
      prisma.user.count({ where: { organizationId: user.organizationId } }),
      prisma.queueEntry.count({
        where: {
          queue: { service: { location: { organizationId: user.organizationId } } },
          joinedAt: { gte: getStartOfDay() },
        },
      }),
      prisma.queueEntry.count({
        where: {
          queue: { service: { location: { organizationId: user.organizationId } } },
          joinedAt: { gte: periodStart },
        },
      }),
    ]);

    // Queue-entry limits: null means unlimited (real plan value flows through
    // when usable); any non-usable subscription hard-blocks to 0, same as
    // checkLimit's convention for these two limit types.
    const queueEntryLimits = isUsable
      ? {
          maxQueueEntriesPerDay: subscription!.plan.maxQueueEntriesPerDay,
          maxQueueEntriesPerPeriod: subscription!.plan.maxQueueEntriesPerPeriod,
        }
      : { maxQueueEntriesPerDay: 0, maxQueueEntriesPerPeriod: 0 };
```

- [ ] **Step 2: Add the two new entries to the `limits` object in the JSON response**

Find the `limits: { locations: {...}, services: {...}, users: {...} }` block inside the final `res.json({...})` call and add two siblings after `users`:

```typescript
        users: {
          current: userCount,
          limit: mergedLimits.maxUsersPerOrg,
          allowed: userCount < mergedLimits.maxUsersPerOrg,
        },
        queueEntriesDaily: {
          current: queueEntriesTodayCount,
          limit: queueEntryLimits.maxQueueEntriesPerDay,
          allowed: queueEntryLimits.maxQueueEntriesPerDay === null ? true : queueEntriesTodayCount < queueEntryLimits.maxQueueEntriesPerDay,
        },
        queueEntriesPeriod: {
          current: queueEntriesPeriodCount,
          limit: queueEntryLimits.maxQueueEntriesPerPeriod,
          allowed: queueEntryLimits.maxQueueEntriesPerPeriod === null ? true : queueEntriesPeriodCount < queueEntryLimits.maxQueueEntriesPerPeriod,
        },
```

- [ ] **Step 3: Also add the two new entries to the no-organization early-return response**

Find the earlier early return for users with no organization:

```typescript
      return res.json({
        subscription: null,
        features: DEFAULT_FEATURES,
        limits: {
          locations: { current: 0, limit: DEFAULT_FEATURES.maxLocations, allowed: true },
          services: { current: 0, limit: DEFAULT_FEATURES.maxServices, allowed: true },
          users: { current: 0, limit: DEFAULT_FEATURES.maxUsers, allowed: true },
        },
        activeProviders,
      });
```

Replace the `limits` block with:

```typescript
        limits: {
          locations: { current: 0, limit: DEFAULT_FEATURES.maxLocations, allowed: true },
          services: { current: 0, limit: DEFAULT_FEATURES.maxServices, allowed: true },
          users: { current: 0, limit: DEFAULT_FEATURES.maxUsers, allowed: true },
          queueEntriesDaily: { current: 0, limit: null, allowed: true },
          queueEntriesPeriod: { current: 0, limit: null, allowed: true },
        },
```

- [ ] **Step 4: Manually verify the endpoint**

Run:
```bash
docker compose restart backend
```
Then, using the browser session already logged in as a tenant admin (or via curl with a valid bearer token), call `GET http://localhost:8004/api/v1/subscription` and confirm the JSON response includes `limits.queueEntriesDaily` and `limits.queueEntriesPeriod`, each with `current`, `limit`, and `allowed` keys.

- [ ] **Step 5: Run the full backend test suite to check for regressions**

Run: `cd backend && npm test`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/src/middleware/subscription.middleware.ts
git commit -m "feat: surface queue-entry usage and limits in getMySubscription"
```

---

### Task 5: Add the shared `UsageBar` component

**Files:**
- Create: `frontend/src/components/ui/UsageBar.tsx`
- Modify: `frontend/src/components/ui/index.ts`
- Modify: `frontend/src/app/globals.css`

**Interfaces:**
- Produces: `<UsageBar label={string} current={number} limit={number | null} />` — consumed by Task 6, Task 7, Task 8.

- [ ] **Step 1: Add the CSS classes**

In `frontend/src/app/globals.css`, add this block right before the `/* Number Counter Animation */` section (the same location the `Checkbox`/`Switch`/`Modal` CSS blocks were added):

```css
/* ========================================
   Usage Bar
   ======================================== */

.usage-bar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.usage-bar-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.875rem;
}

.usage-bar-label {
  color: var(--gray-500);
}

.usage-bar-value {
  color: var(--gray-900);
  font-weight: 600;
}

.usage-bar-track {
  height: 6px;
  background: var(--gray-100);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.usage-bar-fill {
  height: 100%;
  border-radius: var(--radius-full);
  transition: width var(--transition-base);
}

.usage-bar-fill-ok {
  background: var(--primary-500);
}

.usage-bar-fill-warning {
  background: var(--warning-500);
}

.usage-bar-fill-error {
  background: var(--error-500);
}
```

- [ ] **Step 2: Create the component**

Create `frontend/src/components/ui/UsageBar.tsx`:

```tsx
'use client';

import React from 'react';

export interface UsageBarProps {
  label: string;
  current: number;
  limit: number | null;
}

export const UsageBar: React.FC<UsageBarProps> = ({ label, current, limit }) => {
  const percentage = limit === null ? 0 : limit === 0 ? 100 : Math.min(100, (current / limit) * 100);
  const tone = limit === null || percentage < 80 ? 'ok' : percentage < 100 ? 'warning' : 'error';

  return (
    <div className="usage-bar">
      <div className="usage-bar-header">
        <span className="usage-bar-label">{label}</span>
        <span className="usage-bar-value">
          {current}
          {limit !== null ? ` / ${limit}` : ' used'}
        </span>
      </div>
      {limit !== null && (
        <div className="usage-bar-track">
          <div className={`usage-bar-fill usage-bar-fill-${tone}`} style={{ width: `${percentage}%` }} />
        </div>
      )}
    </div>
  );
};

export default UsageBar;
```

- [ ] **Step 3: Export it from the barrel file**

In `frontend/src/components/ui/index.ts`, add after the `Modal` export block:

```typescript
export { UsageBar } from './UsageBar';
export type { UsageBarProps } from './UsageBar';
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors (the three pre-existing unrelated errors in `flow-designer/page.tsx`, `AdminDataSourcesPage.tsx`, `ServicesPage.tsx` are unaffected).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/UsageBar.tsx frontend/src/components/ui/index.ts frontend/src/app/globals.css
git commit -m "feat: add shared UsageBar component"
```

---

### Task 6: Refactor the SuperAdmin org detail page to use `UsageBar`

**Files:**
- Modify: `frontend/src/app/superadmin/organizations/[id]/page.tsx`

**Interfaces:**
- Consumes: `<UsageBar>` from Task 5.

- [ ] **Step 1: Replace the inline usage markup**

In `frontend/src/app/superadmin/organizations/[id]/page.tsx`, find the "Usage Stats" card body (the `<div style={usageGrid}>` block rendering Locations/Users/Queue Entries Today/Entries This Month with manual `usageHeader`/`progressBar`/`progressFill` markup) and replace its contents with:

```tsx
              <div style={usageGrid}>
                <UsageBar label="Locations" current={usage.usage.locations.used} limit={usage.usage.locations.limit} />
                <UsageBar label="Users" current={usage.usage.users.used} limit={usage.usage.users.limit} />
                <UsageBar label="Queue Entries Today" current={usage.usage.queueEntries.today} limit={usage.usage.queueEntries.dailyLimit} />
                <div>
                  <div style={usageHeader}>
                    <span style={usageLabel}>Entries This Month</span>
                    <span style={usageValue}>{usage.usage.queueEntries.thisMonth}</span>
                  </div>
                </div>
              </div>
```

Add the import at the top of the file, alongside the other `@/components/ui` imports:

```typescript
import { Icon, Card, Badge, Button, UsageBar } from '@/components/ui';
```

(This replaces the existing `import { Icon, Card, Badge, Button } from '@/components/ui';` line — just add `UsageBar` to the same import.)

Remove the now-unused `progressBar` and `progressFill` style constant declarations at the bottom of the file (they're no longer referenced). Leave `usageGrid`, `usageHeader`, `usageLabel`, `usageValue` in place — still used by the "Entries This Month" row.

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 3: Visually verify**

Using the browser session logged in as superadmin, navigate to `http://admin.localhost:8003/superadmin/organizations`, open an organization with a subscription (e.g. Nyaho Medical Center), and confirm the Usage card renders identically in spirit (progress bars for Locations/Users/Queue Entries Today, plain text for Entries This Month) with no visual regression.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/superadmin/organizations/[id]/page.tsx
git commit -m "refactor: use shared UsageBar in superadmin org detail page"
```

---

### Task 7: Add a Usage section to the billing page

**Files:**
- Modify: `frontend/src/app/admin/billing/page.tsx`

**Interfaces:**
- Consumes: `GET /subscription`'s new `limits.queueEntriesDaily`/`limits.queueEntriesPeriod` (Task 4), `<UsageBar>` (Task 5).

- [ ] **Step 1: Extend the `SubscriptionData` interface**

In `frontend/src/app/admin/billing/page.tsx`, extend the `SubscriptionData` interface:

```typescript
interface UsageLimit {
  current: number;
  limit: number | null;
  allowed: boolean;
}

interface SubscriptionData {
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  } | null;
  activeProviders: ('stripe' | 'paystack')[];
  upgradePlan: { id: string; name: string } | null;
  isExpiredNoFallback: boolean;
  limits?: {
    locations: UsageLimit;
    services: UsageLimit;
    users: UsageLimit;
    queueEntriesDaily: UsageLimit;
    queueEntriesPeriod: UsageLimit;
  };
}
```

- [ ] **Step 2: Import `UsageBar`**

Update the existing components import line:

```typescript
import { Button, Card, Badge, PageHeader, Icon, UsageBar } from '@/components/ui';
```

- [ ] **Step 3: Render the Usage card**

Insert this block right after the `<PageHeader ... />` element and before the `{data?.isExpiredNoFallback && (...)}` block:

```tsx
        {data?.limits && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--gray-900)' }}>Usage</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.25rem' }}>
              <UsageBar label="Locations" current={data.limits.locations.current} limit={data.limits.locations.limit} />
              <UsageBar label="Users" current={data.limits.users.current} limit={data.limits.users.limit} />
              <UsageBar label="Services" current={data.limits.services.current} limit={data.limits.services.limit} />
              <UsageBar label="Queue entries today" current={data.limits.queueEntriesDaily.current} limit={data.limits.queueEntriesDaily.limit} />
              <UsageBar label="Queue entries this period" current={data.limits.queueEntriesPeriod.current} limit={data.limits.queueEntriesPeriod.limit} />
            </div>
          </Card>
        )}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 5: Visually verify**

Navigate to `http://localhost:8003/admin/billing` as a tenant admin and confirm the new Usage card renders above the upgrade callout, with five progress bars showing sensible current/limit values.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/app/admin/billing/page.tsx
git commit -m "feat: show usage breakdown on the billing page"
```

---

### Task 8: Add a usage widget to the tenant dashboard

**Files:**
- Modify: `frontend/src/components/pages/DashboardPage.tsx`

**Interfaces:**
- Consumes: `api.getMySubscription()` (existing, `frontend/src/api/client.ts:209`), `<UsageBar>` (Task 5).

- [ ] **Step 1: Fetch subscription data**

In `frontend/src/components/pages/DashboardPage.tsx`, add a new piece of state alongside the existing `stats`/`organization` state:

```typescript
interface UsageLimit {
  current: number;
  limit: number | null;
  allowed: boolean;
}

interface SubscriptionLimits {
  locations: UsageLimit;
  services: UsageLimit;
  users: UsageLimit;
  queueEntriesDaily: UsageLimit;
  queueEntriesPeriod: UsageLimit;
}
```

Add `const [limits, setLimits] = useState<SubscriptionLimits | null>(null);` next to the existing `useState` declarations.

In `loadDashboard`, inside the `if (user?.organizationId) { ... }` branch, after the existing `setStats(statsData);` line, add:

```typescript
        const subData = await api.getMySubscription();
        if (subData.limits) setLimits(subData.limits);
```

- [ ] **Step 2: Render the widget**

Insert this block right after the closing `</div>` of the Stats Grid section (`{/* Stats Grid */} ... </div>`) and before the `{/* Quick Actions */}` section, gated to admins only:

```tsx
        {/* Usage Widget - only near-limit resources, full breakdown lives on the billing page */}
        {isAdmin && limits && (() => {
          const nearLimitEntries = (
            [
              ['Locations', limits.locations],
              ['Users', limits.users],
              ['Services', limits.services],
              ['Queue entries today', limits.queueEntriesDaily],
              ['Queue entries this period', limits.queueEntriesPeriod],
            ] as [string, UsageLimit][]
          ).filter(([, l]) => l.limit !== null && l.current / l.limit >= 0.8);

          if (nearLimitEntries.length === 0) return null;

          return (
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Usage</h2>
              <div className="card" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                {nearLimitEntries.map(([label, l]) => (
                  <UsageBar key={label} label={label} current={l.current} limit={l.limit} />
                ))}
              </div>
            </section>
          );
        })()}
```

Add `UsageBar` to the existing `@/components/ui` import:

```typescript
import { Icon, PageHeader, UsageBar } from '@/components/ui';
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no new errors.

- [ ] **Step 4: Visually verify both states**

Navigate to `http://localhost:8003/` as a tenant admin whose org is well within all limits — confirm no Usage section renders (empty `nearLimitEntries`). Then, using the superadmin org-detail page's Cancel/Subscription tools or a direct DB update, temporarily set an org's plan usage near a cap (e.g. add users until `users.current / users.limit >= 0.8`) and confirm the widget appears with the correct bar(s), then revert the change.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/DashboardPage.tsx
git commit -m "feat: show near-limit usage widget on the tenant dashboard"
```

---

### Task 9: End-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full backend test suite**

Run: `cd backend && npm test`
Expected: all tests pass, including the new tests from Tasks 2 and 3.

- [ ] **Step 2: Run the frontend typecheck**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: only the three pre-existing, unrelated errors remain (`flow-designer/page.tsx`, `AdminDataSourcesPage.tsx`, `ServicesPage.tsx`).

- [ ] **Step 3: Manually verify hard-block behavior end to end**

Using the superadmin plans page, set a test plan's "Max Queue Entries/Day" to `1` and assign it to a test organization's subscription (via the superadmin organizations page's Subscription modal). Log in as that organization (or use its public join page), join the queue once (should succeed), then attempt to join again the same day (should be blocked with a 403 and the message "This location has reached its daily queue entry limit (1). Please try again tomorrow."). Revert the test plan's limit afterward.

- [ ] **Step 4: Confirm no regressions in existing subscription flows**

Re-verify (from the browser) that: the billing page's plan cards, upgrade callout, and checkout flow still work; the superadmin plans/payment-providers pages still work (from the earlier redesign); creating a location/service/user still respects the existing `enforceLimit`-based caps unchanged.

- [ ] **Step 5: Final commit (if any cleanup was needed)**

```bash
git status
```
If nothing is pending, this task requires no commit — it's verification only.
