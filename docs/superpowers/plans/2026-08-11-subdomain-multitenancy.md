# Subdomain Multi-Tenancy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `{slug}.{domain}` resolve to a tenant's app and `admin.{domain}` resolve to the superadmin panel, with per-subdomain login, reserved-slug protection, and the superadmin cross-tenant data leak closed.

**Architecture:** A Next.js `middleware.ts` inspects the `Host` header on every request, derives the subdomain against a configurable base-domain env var, and either passes through (root/marketing), rewrites to `/superadmin/*` (admin subdomain), or resolves the slug against a new public backend endpoint and rewrites to a "workspace not found" page on failure (tenant subdomain). Login becomes subdomain-aware: the frontend tells the backend which slug (or "admin") context it's authenticating against, and the backend rejects cross-context credentials. Sessions remain independent per subdomain (localStorage-based, no shared cookies).

**Tech Stack:** Next.js 15 App Router (frontend, `frontend/src`), Express + Prisma (backend, `backend/src`), Postgres. No test framework is installed in either package — this repo's existing convention (see `tests/smoke-test.js`) is plain Node scripts run against the live dev stack (`docker compose up`), plus manual verification via the browse skill for UI-only changes. This plan follows that same convention rather than introducing Jest/Vitest.

## Global Constraints

- Base domain must be read from an env var, not hardcoded: `NEXT_PUBLIC_APP_DOMAIN` (client+server, e.g. `localhost:8003` in dev, `enqueueq.com` in prod).
- Middleware runs server-side inside the frontend container/Edge runtime and cannot reach the backend via `NEXT_PUBLIC_API_URL` (`http://localhost:8004`) in the Docker dev setup — that URL only works from the browser. A separate server-only env var (`API_INTERNAL_URL`) is needed for middleware-to-backend calls, defaulting to `http://backend:9000/api/v1` (the Docker Compose service name) in dev.
- Reserved subdomain list: `admin, www, api, app, mail, ftp, ns1, ns2, status, docs, support, staging, dev, test, blog, assets, static, cdn, help, login, register, auth`. Defined once per codebase (backend is source of truth, frontend mirrors it for instant UX feedback) — both copies must stay in sync; a comment in each file points at the other.
- Sessions are independent per subdomain. No shared cookies, no cross-subdomain SSO in this plan.
- JWT payload shape (`{ userId, role }`) is unchanged — do not add `organizationId` to the token; it continues to be read fresh from the DB per request.
- Do not touch `/join/:locationCode` or `/display/:locationId` routing — the audit confirmed these already work well and don't need to move under tenant subdomains.

---

## Task 1: Backend reserved-slug list and slug utilities

**Files:**
- Create: `backend/src/constants/reservedSlugs.ts`
- Create: `backend/src/utils/slug.ts`
- Test: `tests/slug-utils-smoke.js`

**Interfaces:**
- Produces: `RESERVED_SLUGS: string[]` (named export from `reservedSlugs.ts`), `slugify(input: string): string` and `generateUniqueSlug(baseName: string): Promise<string>` (named exports from `slug.ts`). Later tasks (2, 3, 4) import both.

- [ ] **Step 1: Create the reserved-slug constant**

`backend/src/constants/reservedSlugs.ts`:
```typescript
// Mirrored in frontend/src/lib/reservedSlugs.ts for client-side validation —
// keep both lists in sync when adding entries.
export const RESERVED_SLUGS = [
  'admin', 'www', 'api', 'app', 'mail', 'ftp', 'ns1', 'ns2',
  'status', 'docs', 'support', 'staging', 'dev', 'test', 'blog',
  'assets', 'static', 'cdn', 'help', 'login', 'register', 'auth',
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
```

- [ ] **Step 2: Create the slug utility**

`backend/src/utils/slug.ts`:
```typescript
import prisma from '../lib/prisma';
import { isReservedSlug } from '../constants/reservedSlugs';

export function slugify(input: string): string {
  const base = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return base || 'org';
}

/**
 * Generates a slug from a base name, appending -2, -3, ... on collision
 * with an existing organization or a reserved word.
 */
export async function generateUniqueSlug(baseName: string): Promise<string> {
  const base = slugify(baseName);
  let candidate = base;
  let suffix = 2;

  while (true) {
    if (!isReservedSlug(candidate)) {
      const existing = await prisma.organization.findUnique({ where: { slug: candidate } });
      if (!existing) return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
```

- [ ] **Step 3: Write a smoke script and run it**

`tests/slug-utils-smoke.js`:
```javascript
/**
 * Smoke test for slug generation: verifies reserved words are rejected
 * and collisions get a numeric suffix. Run against the live backend
 * container so it exercises the real Prisma connection.
 */
const { execSync } = require('child_process');

function runInBackend(expr) {
  const out = execSync(
    `docker compose exec -T backend node -e "${expr.replace(/"/g, '\\"')}"`,
    { encoding: 'utf-8', cwd: __dirname + '/..' }
  );
  return out.trim();
}

const script = `
const { slugify, generateUniqueSlug } = require('./dist/utils/slug');
const { isReservedSlug } = require('./dist/constants/reservedSlugs');
(async () => {
  console.log('slugify:', slugify('Nyaho Medical Center!!'));
  console.log('isReservedSlug(admin):', isReservedSlug('admin'));
  console.log('isReservedSlug(nyaho):', isReservedSlug('nyaho'));
  const s = await generateUniqueSlug('Nyaho Medical Center');
  console.log('generateUniqueSlug:', s);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
`;

// Requires a build first since ts-node isn't set up for one-off exec; see Step 4.
console.log(runInBackend(script));
```

Since the backend runs via `ts-node-dev` in dev (no compiled `dist/`), run the equivalent check directly with `ts-node` instead of requiring a build:

```bash
docker compose exec -T backend npx ts-node -e "
import { slugify, generateUniqueSlug } from './src/utils/slug';
import { isReservedSlug } from './src/constants/reservedSlugs';
(async () => {
  console.log('slugify:', slugify('Nyaho Medical Center!!'));
  console.log('isReservedSlug(admin):', isReservedSlug('admin'));
  console.log('isReservedSlug(nyaho):', isReservedSlug('nyaho'));
  console.log('generateUniqueSlug:', await generateUniqueSlug('Nyaho Medical Center'));
  process.exit(0);
})();
"
```

Expected output before implementation exists: `Cannot find module './src/utils/slug'` (fails, as expected since Steps 1-2 must run first — reorder: run this check *after* Steps 1-2, verify it prints `slugify: nyaho-medical-center`, `isReservedSlug(admin): true`, `isReservedSlug(nyaho): false`, `generateUniqueSlug: nyaho-medical-center-2` (there's already an org named similarly in the dev DB from earlier manual testing, so a suffix is expected — if the base is unique in your DB it'll print `nyaho-medical-center` with no suffix, which is also correct).

- [ ] **Step 4: Run the check and confirm output matches expectations above**

- [ ] **Step 5: Commit**

```bash
git add backend/src/constants/reservedSlugs.ts backend/src/utils/slug.ts
git commit -m "feat(backend): add reserved-slug list and slug generation utility"
```

---

## Task 2: Backend public org-by-slug lookup endpoint

**Files:**
- Modify: `backend/src/controllers/organization.controller.ts` (add `getPublicOrganizationBySlug`, after existing `getPublicOrganization`)
- Modify: `backend/src/routes/index.ts:66-69` (add route)
- Test: `tests/org-by-slug-smoke.js`

**Interfaces:**
- Consumes: none new.
- Produces: `GET /api/v1/public/orgs/by-slug/:slug` → `200 { id, name, slug }` or `404 { error: 'Organization not found' }`. Consumed by frontend middleware (Task 7) and login page (Task 9).

- [ ] **Step 1: Write the smoke script (will fail — route doesn't exist yet)**

`tests/org-by-slug-smoke.js`:
```javascript
const API_BASE = process.env.API_BASE || 'http://localhost:8004/api/v1';

async function run() {
  // Unknown slug should 404
  const missRes = await fetch(`${API_BASE}/public/orgs/by-slug/does-not-exist-xyz`);
  if (missRes.status !== 404) {
    throw new Error(`Expected 404 for unknown slug, got ${missRes.status}`);
  }
  console.log('Unknown slug correctly returns 404');

  // A slug that exists should resolve (requires an org with a slug set —
  // set one first via: docker compose exec -T backend npx ts-node -e "..."
  // or just check the shape of the 404 case is right for now if no slugged org exists yet)
  console.log('org-by-slug smoke test passed');
  process.exit(0);
}

run().catch((err) => {
  console.error('org-by-slug smoke test failed:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `node tests/org-by-slug-smoke.js`
Expected: FAIL — `Expected 404 for unknown slug, got 404` won't be the failure; the actual failure is a connection/404-shape mismatch because the route doesn't exist at all yet, so Express's default 404 handler responds and the body won't match `{ error: 'Organization not found' }` — but since the script only checks `status`, it will actually pass by accident once any 404 is returned (including Express's default "not found" for an unmatched route). To make this a meaningful red/green test, add a second check: unknown-slug body must contain `error`.

Update the script's miss-check to:
```javascript
  const missBody = await missRes.json().catch(() => null);
  if (missRes.status !== 404 || !missBody || missBody.error !== 'Organization not found') {
    throw new Error(`Expected 404 with { error: 'Organization not found' }, got ${missRes.status} ${JSON.stringify(missBody)}`);
  }
```
Run again: `node tests/org-by-slug-smoke.js` — Expected: FAIL (no route matches `/public/orgs/by-slug/:slug` yet, so Express returns its default HTML 404 page, `missRes.json()` throws, `missBody` is `null`, assertion fails as expected).

- [ ] **Step 3: Implement the controller function**

Add to `backend/src/controllers/organization.controller.ts`, directly after the existing `getPublicOrganization` function (ends around line 125):

```typescript
// Public endpoint: resolve an organization by its subdomain slug
export const getPublicOrganizationBySlug = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;

    const organization = await prisma.organization.findUnique({
      where: { slug },
      select: { id: true, name: true, slug: true },
    });

    if (!organization) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    res.json(organization);
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 4: Wire the route**

In `backend/src/routes/index.ts`, immediately after the existing block at line 66-69 (`router.get('/public/orgs/:orgId', ...)`), insert (order matters — place this **before** the `:orgId` route so `by-slug` isn't swallowed as an `orgId` value... actually Express matches static-looking segments fine either order since `:orgId` is a param not a wildcard, but to avoid any ambiguity keep `by-slug` as its own literal path, which Express treats correctly regardless of declaration order since `/public/orgs/by-slug/:slug` has an extra path segment. Add it anywhere in the public block, e.g. right after line 69):

```typescript
router.get('/public/orgs/by-slug/:slug', (req, res, next) => {
  const { getPublicOrganizationBySlug } = require('../controllers/organization.controller');
  return getPublicOrganizationBySlug(req, res, next as any);
});
```

- [ ] **Step 5: Run the smoke script again, confirm it passes**

Run: `node tests/org-by-slug-smoke.js`
Expected: PASS — prints `Unknown slug correctly returns 404` and `org-by-slug smoke test passed`.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/organization.controller.ts backend/src/routes/index.ts tests/org-by-slug-smoke.js
git commit -m "feat(backend): add public org-by-slug lookup endpoint"
```

---

## Task 3: Backend — set and validate slug on org registration, enforce reserved words on update

**Files:**
- Modify: `backend/src/controllers/organization.controller.ts:7-93` (`registerOrganization`)
- Modify: `backend/src/controllers/organization.controller.ts` (`updateOrganization`, the function containing the existing slug-validation block found around line 190-215)
- Test: `tests/org-slug-registration-smoke.js`

**Interfaces:**
- Consumes: `slugify`, `generateUniqueSlug` from Task 1 (`backend/src/utils/slug.ts`); `isReservedSlug` from Task 1 (`backend/src/constants/reservedSlugs.ts`).
- Produces: `registerOrganization` now accepts an optional `slug` field in `req.body` and always returns `organization.slug` populated in its response.

- [ ] **Step 1: Write the smoke script (will fail — slug isn't set on registration yet)**

`tests/org-slug-registration-smoke.js`:
```javascript
const API_BASE = process.env.API_BASE || 'http://localhost:8004/api/v1';

async function run() {
  const suffix = Date.now();
  const res = await fetch(`${API_BASE}/public/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: `Smoke Test Org ${suffix}`,
      adminEmail: `smoketest+${suffix}@example.com`,
      adminPassword: 'testpass123',
      adminFirstName: 'Smoke',
      adminLastName: 'Test',
      emailVerified: true,
    }),
  });

  const body = await res.json();
  if (res.status !== 201) {
    throw new Error(`Expected 201, got ${res.status}: ${JSON.stringify(body)}`);
  }
  if (!body.organization.slug) {
    throw new Error(`Expected organization.slug to be set, got: ${JSON.stringify(body.organization)}`);
  }
  console.log('Auto-generated slug:', body.organization.slug);

  // Reserved slug should be rejected
  const reservedRes = await fetch(`${API_BASE}/public/register-org`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationName: `Reserved Slug Test ${suffix}`,
      slug: 'admin',
      adminEmail: `reserved+${suffix}@example.com`,
      adminPassword: 'testpass123',
      adminFirstName: 'Reserved',
      adminLastName: 'Test',
      emailVerified: true,
    }),
  });
  const reservedBody = await reservedRes.json();
  if (reservedRes.status !== 400) {
    throw new Error(`Expected 400 for reserved slug, got ${reservedRes.status}: ${JSON.stringify(reservedBody)}`);
  }
  console.log('Reserved slug correctly rejected:', reservedBody.error);
  console.log('org-slug-registration smoke test passed');
  process.exit(0);
}

run().catch((err) => {
  console.error('org-slug-registration smoke test failed:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `node tests/org-slug-registration-smoke.js`
Expected: FAIL at `Expected organization.slug to be set` — today's `registerOrganization` never sets a slug.

- [ ] **Step 3: Implement slug handling in `registerOrganization`**

In `backend/src/controllers/organization.controller.ts`, add the import at the top of the file:
```typescript
import { slugify, generateUniqueSlug } from '../utils/slug';
import { isReservedSlug } from '../constants/reservedSlugs';
```

Inside `registerOrganization`, destructure `slug` from `req.body` (line 9-18 currently destructures `organizationName, email, phone, adminEmail, ...` — add `slug` to that list), then before the `prisma.$transaction` call (currently starting at line 43), add:

```typescript
    // Resolve the org's subdomain slug: use the caller's choice if valid,
    // otherwise auto-generate one from the org name.
    let resolvedSlug: string;
    if (slug) {
      const normalized = slugify(slug);
      if (normalized !== slug.toLowerCase()) {
        return res.status(400).json({ error: 'Slug must be lowercase letters, numbers, and hyphens only' });
      }
      if (isReservedSlug(normalized)) {
        return res.status(400).json({ error: 'This slug is reserved and cannot be used' });
      }
      const existingOrgWithSlug = await prisma.organization.findUnique({ where: { slug: normalized } });
      if (existingOrgWithSlug) {
        return res.status(400).json({ error: 'This slug is already taken' });
      }
      resolvedSlug = normalized;
    } else {
      resolvedSlug = await generateUniqueSlug(organizationName);
    }
```

Then inside the transaction, in the `organization.create` call (currently `data: { name: organizationName, email: ..., phone: ... }` around line 45-51), add `slug: resolvedSlug,` to the `data` object.

- [ ] **Step 4: Run the smoke script again, confirm the first half passes**

Run: `node tests/org-slug-registration-smoke.js`
Expected: now fails at the *second* assertion (`Expected 400 for reserved slug`) since reserved-word rejection isn't wired to the `slug` field passed by the caller yet — wait, Step 3 already includes that check. Re-run and expect: PASS on both assertions. If it still fails, check that `slug.toLowerCase()` comparison isn't rejecting valid lowercase input by mistake (the check should only fire when the user's input isn't already normalized, e.g. contains uppercase or invalid characters — read the error message printed to see which branch failed).

- [ ] **Step 5: Add reserved-word enforcement to `updateOrganization`**

Find the existing slug-validation block in `updateOrganization` (identified during planning around the section that does `const slugRegex = /^[a-z0-9-]+$/`). Immediately after the regex check and before the uniqueness check (`const existing = await prisma.organization.findUnique({ where: { slug } })`), add:

```typescript
      if (isReservedSlug(slug)) {
        return res.status(400).json({ error: 'This slug is reserved and cannot be used' });
      }
```

(Add the same `isReservedSlug` import from Step 3 if this function is in the same file — it is, so the import already covers it.)

- [ ] **Step 6: Manually verify the update-path reserved-word check**

```bash
docker compose exec -T backend npx ts-node -e "
import prisma from './src/lib/prisma';
(async () => {
  const org = await prisma.organization.findFirst();
  console.log('Testing against org:', org?.id);
  process.exit(0);
})();
"
```
Then hit the update endpoint with `curl` (replace `<ORG_ID>` and `<TOKEN>` with real values from a logged-in session):
```bash
curl -s -X PATCH http://localhost:8004/api/v1/orgs/<ORG_ID> \
  -H "Authorization: Bearer <TOKEN>" -H "Content-Type: application/json" \
  -d '{"slug":"admin"}'
```
Expected: `{"error":"This slug is reserved and cannot be used"}`.

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/organization.controller.ts tests/org-slug-registration-smoke.js
git commit -m "feat(backend): assign slug on org registration, enforce reserved words"
```

---

## Task 4: Backend — subdomain-scoped login

**Files:**
- Modify: `backend/src/controllers/auth.controller.ts:82-125` (`login`)
- Test: `tests/login-scoping-smoke.js`

**Interfaces:**
- Consumes: none new from earlier tasks (queries `prisma.organization` directly by slug — same pattern as Task 2's controller, kept separate since this is a different concern/response shape).
- Produces: `POST /api/v1/auth/login` now accepts optional `slug: string` (tenant context) or `adminLogin: boolean` (superadmin context) in the body. Behavior is backward-compatible: omitting both fields preserves today's unscoped login (used by the existing generic `/login` page until Task 9 updates it).

- [ ] **Step 1: Write the smoke script (will fail — scoping doesn't exist yet)**

`tests/login-scoping-smoke.js`:
```javascript
const API_BASE = process.env.API_BASE || 'http://localhost:8004/api/v1';

// Assumes the seeded tenant admin harrisyn@gmail.com / 12345678 exists,
// belonging to an org with slug 'nyaho' (set one first if it isn't set —
// see the docker exec command in the plan's Task 3 verification step, or
// just PATCH /orgs/:id with {"slug":"nyaho"} while authenticated).
async function run() {
  // Correct slug should work
  const okRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harrisyn@gmail.com', password: '12345678', slug: 'nyaho' }),
  });
  if (okRes.status !== 200) {
    throw new Error(`Expected 200 for correct slug, got ${okRes.status}: ${JSON.stringify(await okRes.json())}`);
  }
  console.log('Correct-slug login succeeded');

  // Wrong slug should fail
  const wrongRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harrisyn@gmail.com', password: '12345678', slug: 'some-other-org' }),
  });
  if (wrongRes.status !== 401) {
    throw new Error(`Expected 401 for wrong slug, got ${wrongRes.status}`);
  }
  console.log('Wrong-slug login correctly rejected');

  // adminLogin should reject a non-SUPER_ADMIN user
  const adminRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'harrisyn@gmail.com', password: '12345678', adminLogin: true }),
  });
  if (adminRes.status !== 401) {
    throw new Error(`Expected 401 for non-superadmin adminLogin, got ${adminRes.status}`);
  }
  console.log('Non-superadmin correctly rejected on adminLogin');

  console.log('login-scoping smoke test passed');
  process.exit(0);
}

run().catch((err) => {
  console.error('login-scoping smoke test failed:', err);
  process.exit(2);
});
```

- [ ] **Step 2: Set the test org's slug so the script has something to check against**

```bash
docker compose exec -T backend npx ts-node -e "
import prisma from './src/lib/prisma';
(async () => {
  const org = await prisma.organization.findFirst({ where: { name: 'Nyaho Medical Center' } });
  await prisma.organization.update({ where: { id: org.id }, data: { slug: 'nyaho' } });
  console.log('Set slug to nyaho for org', org.id);
  process.exit(0);
})();
"
```

- [ ] **Step 3: Run the smoke script, confirm it fails**

Run: `node tests/login-scoping-smoke.js`
Expected: FAIL — the "Wrong-slug login correctly rejected" and "Non-superadmin correctly rejected on adminLogin" assertions both fail (both currently return 200, since `slug`/`adminLogin` are ignored).

- [ ] **Step 4: Implement scoping in `login`**

In `backend/src/controllers/auth.controller.ts`, modify the `login` function (currently lines 82-125):

```typescript
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, slug, adminLogin } = req.body;

    // Find user
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Check password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Subdomain-scoped login: verify the user is allowed in this context.
    if (adminLogin) {
      if (user.role !== 'SUPER_ADMIN') {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    } else if (slug) {
      const org = await prisma.organization.findUnique({ where: { slug } });
      if (!org || user.organizationId !== org.id) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
    }

    // Generate token
    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        organizationId: user.organizationId
      }
    });
  } catch (error) {
    next(error);
  }
};
```

- [ ] **Step 5: Run the smoke script again, confirm it passes**

Run: `node tests/login-scoping-smoke.js`
Expected: PASS — all three assertions succeed.

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/auth.controller.ts tests/login-scoping-smoke.js
git commit -m "feat(backend): scope login to tenant slug or superadmin context"
```

---

## Task 5: Fix the superadmin cross-tenant data leak

**Files:**
- Modify: `frontend/src/components/pages/DashboardPage.tsx` (the `useEffect`/data-loading logic, identified during planning around lines 35-55, which falls back to `api.getOrganizations()` + `orgs[0]` when `user.organizationId` is falsy)

**Interfaces:**
- Consumes: existing `user` object from `useAuthContext()` (has `organizationId?: string`).
- Produces: no new interface — this task only removes the unsafe fallback and replaces it with an explicit empty/no-org state.

This task is independent of the subdomain routing work but was found during the audit as a real authorization bug, and the design spec calls for it to be fixed as part of this effort (org context must never default to "first org"). Doing it now, before Tasks 6-9 build the subdomain-aware login on top, means there's no window where the bug could resurface.

- [ ] **Step 1: Read the current implementation to get exact line numbers**

Read `frontend/src/components/pages/DashboardPage.tsx` and locate the block that does:
```typescript
if (user?.organizationId) {
  const org = await api.getOrganization(user.organizationId);
  // ...
  const statsData = await api.getDashboardStats(user.organizationId);
  // ...
} else {
  const orgs = await api.getOrganizations();
  // ...
  setOrganization(orgs[0]);
  const statsData = await api.getDashboardStats(orgs[0].id);
  // ...
}
```

- [ ] **Step 2: Replace the `else` branch**

Replace the entire `else` branch (the `api.getOrganizations()` / `orgs[0]` fallback) with a no-op that leaves `organization` as `null` and does not call `getDashboardStats`:

```typescript
} else {
  // No organization on this account (e.g. a superadmin browsing the
  // regular tenant app shell by mistake). Never guess an org — render
  // the empty state instead of leaking another tenant's data.
  setOrganization(null);
}
```

Ensure whatever `loading`/`error` state the surrounding function sets is still set appropriately in this branch (match the existing function's structure — if it sets `setLoading(false)` in a `finally` block, no extra change needed there).

- [ ] **Step 3: Confirm the component already handles `organization === null` reasonably**

Read the JSX return of `DashboardPage.tsx` and confirm it doesn't crash on `organization` being `null` (e.g. `organization.name` accessed without an optional chain). If it does access properties unsafely, add a guard: render a simple "No organization" message instead of the dashboard cards when `organization` is `null`, e.g.:
```typescript
if (!loading && !organization) {
  return (
    <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
      No organization is associated with this account.
    </div>
  );
}
```
Place this check alongside the component's existing loading/error early-returns.

- [ ] **Step 4: Verify manually with the browse skill**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:8003/login
$B snapshot -i
# fill the superadmin test account and submit (created earlier: superadmin@qms.local / 12345678)
$B fill @e1 "superadmin@qms.local"
$B fill @e3 "12345678"
$B click @e5
$B wait --networkidle
$B text
```
Expected: the page text no longer contains `Managing Nyaho Medical Center` or any tenant-specific stats — it shows the "No organization is associated with this account" message (or equivalent empty state) instead.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/DashboardPage.tsx
git commit -m "fix(frontend): stop defaulting org-less users to another tenant's dashboard data"
```

---

## Task 6: Frontend subdomain utilities and mirrored reserved-slug list

**Files:**
- Create: `frontend/src/lib/reservedSlugs.ts`
- Create: `frontend/src/lib/subdomain.ts`

**Interfaces:**
- Produces: `RESERVED_SLUGS: string[]`, `isReservedSlug(slug: string): boolean` (from `reservedSlugs.ts`); `extractSubdomain(host: string): string | null`, `buildTenantUrl(slug: string, path?: string): string`, `buildAdminUrl(path?: string): string`, `buildRootUrl(path?: string): string` (from `subdomain.ts`). Consumed by Task 7 (middleware), Task 9 (login page), Task 11 (settings page), Task 12 (register page).

- [ ] **Step 1: Create the mirrored reserved-slug list**

`frontend/src/lib/reservedSlugs.ts`:
```typescript
// Mirrored from backend/src/constants/reservedSlugs.ts for instant
// client-side validation — keep both lists in sync when adding entries.
export const RESERVED_SLUGS = [
  'admin', 'www', 'api', 'app', 'mail', 'ftp', 'ns1', 'ns2',
  'status', 'docs', 'support', 'staging', 'dev', 'test', 'blog',
  'assets', 'static', 'cdn', 'help', 'login', 'register', 'auth',
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
```

- [ ] **Step 2: Create the subdomain utility**

`frontend/src/lib/subdomain.ts`:
```typescript
const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost:8003';

/**
 * Extracts the subdomain from a Host header value, relative to APP_DOMAIN.
 * Returns null for the bare root domain or `www`.
 * Returns null (treated as root) for any host that isn't a subdomain of
 * APP_DOMAIN at all (e.g. a raw IP during local debugging).
 */
export function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0];
  const domain = APP_DOMAIN.split(':')[0];

  if (hostname === domain || hostname === `www.${domain}`) {
    return null;
  }
  if (!hostname.endsWith(`.${domain}`)) {
    return null;
  }
  return hostname.slice(0, hostname.length - domain.length - 1);
}

function protocolFor(domain: string): string {
  return domain.startsWith('localhost') ? 'http' : 'https';
}

export function buildTenantUrl(slug: string, path: string = '/'): string {
  const protocol = protocolFor(APP_DOMAIN);
  return `${protocol}://${slug}.${APP_DOMAIN}${path}`;
}

export function buildAdminUrl(path: string = '/'): string {
  const protocol = protocolFor(APP_DOMAIN);
  return `${protocol}://admin.${APP_DOMAIN}${path}`;
}

export function buildRootUrl(path: string = '/'): string {
  const protocol = protocolFor(APP_DOMAIN);
  return `${protocol}://${APP_DOMAIN}${path}`;
}
```

- [ ] **Step 3: Verify with a quick Node check (no test framework, so run it directly with ts-node via the frontend container)**

```bash
docker compose exec -T frontend npx tsx -e "
import { extractSubdomain, buildTenantUrl, buildAdminUrl } from './src/lib/subdomain';
console.log(extractSubdomain('nyaho.localhost:8003'));   // expect: nyaho
console.log(extractSubdomain('admin.localhost:8003'));   // expect: admin
console.log(extractSubdomain('localhost:8003'));         // expect: null
console.log(extractSubdomain('www.localhost:8003'));     // expect: null
console.log(buildTenantUrl('nyaho', '/login'));           // expect: http://nyaho.localhost:8003/login
console.log(buildAdminUrl());                              // expect: http://admin.localhost:8003/
"
```
If `tsx` isn't available in the frontend image, install it as a dev dependency first: `docker compose exec -T frontend npm install -D tsx`. Expected output matches the comments above exactly.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/reservedSlugs.ts frontend/src/lib/subdomain.ts
git commit -m "feat(frontend): add subdomain extraction and URL-building utilities"
```

---

## Task 7: Next.js middleware for subdomain routing

**Files:**
- Create: `frontend/src/middleware.ts`
- Create: `frontend/src/app/workspace-not-found/page.tsx`
- Modify: `docker-compose.yml` (add `NEXT_PUBLIC_APP_DOMAIN` and `API_INTERNAL_URL` to the `frontend` service's `environment` block)

**Interfaces:**
- Consumes: `extractSubdomain` from Task 6 (`frontend/src/lib/subdomain.ts`); `GET /api/v1/public/orgs/by-slug/:slug` from Task 2.
- Produces: request-time routing behavior described in the spec's Architecture section. No exported functions consumed by later tasks.

- [ ] **Step 1: Add the env vars to docker-compose.yml**

In `docker-compose.yml`, inside the `frontend` service's `environment` block (currently `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SOCKET_URL`, `NODE_ENV`, `HOST`, polling flags), add:
```yaml
      NEXT_PUBLIC_APP_DOMAIN: ${NEXT_PUBLIC_APP_DOMAIN:-localhost:8003}
      API_INTERNAL_URL: ${API_INTERNAL_URL:-http://backend:9000/api/v1}
```

- [ ] **Step 2: Restart the frontend container to pick up the new env vars**

```bash
docker compose up -d frontend
```

- [ ] **Step 3: Create the "workspace not found" page**

`frontend/src/app/workspace-not-found/page.tsx`:
```typescript
'use client';

import { buildRootUrl } from '@/lib/subdomain';

export default function WorkspaceNotFoundPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        textAlign: 'center',
        maxWidth: '420px',
      }}>
        <h2 style={{ color: '#1e293b', marginTop: '1rem', fontSize: '1.5rem', fontWeight: 700 }}>
          Workspace not found
        </h2>
        <p style={{ color: '#64748b', marginTop: '0.5rem' }}>
          There&apos;s no organization at this address. Double-check the link,
          or head back to the main site.
        </p>
        <a
          href={buildRootUrl()}
          style={{
            display: 'inline-block',
            marginTop: '1.5rem',
            padding: '0.75rem 1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '8px',
            fontWeight: 500,
          }}
        >
          Go to enqueueq.com
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write the middleware**

`frontend/src/middleware.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain } from '@/lib/subdomain';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://backend:9000/api/v1';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const subdomain = extractSubdomain(host);
  const { pathname } = req.nextUrl;

  // Root domain / www: block direct /superadmin access from here.
  if (!subdomain) {
    if (pathname.startsWith('/superadmin')) {
      const url = req.nextUrl.clone();
      url.host = req.nextUrl.host.replace(req.nextUrl.hostname, `admin.${req.nextUrl.hostname}`);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // Admin subdomain: rewrite everything under /superadmin/*.
  if (subdomain === 'admin') {
    if (pathname.startsWith('/superadmin')) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = `/superadmin${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Any other subdomain: treat as a tenant slug and resolve it.
  try {
    const lookupRes = await fetch(`${API_INTERNAL_URL}/public/orgs/by-slug/${subdomain}`);
    if (!lookupRes.ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/workspace-not-found';
      return NextResponse.rewrite(url);
    }
  } catch {
    // Backend unreachable — fail open to the not-found page rather than
    // a hard error, so a transient backend hiccup doesn't 500 every tenant.
    const url = req.nextUrl.clone();
    url.pathname = '/workspace-not-found';
    return NextResponse.rewrite(url);
  }

  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 5: Verify with the browse skill**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"

# Root domain still shows marketing/dashboard as before
$B goto http://localhost:8003
$B wait --networkidle
$B text

# Unknown tenant subdomain shows the workspace-not-found page
$B goto http://ghost.localhost:8003
$B wait --networkidle
$B text
# Expected: contains "Workspace not found"

# Known tenant subdomain (slug set to 'nyaho' in Task 4, Step 2) passes through
$B goto http://nyaho.localhost:8003
$B wait --networkidle
$B text
# Expected: does NOT contain "Workspace not found" — shows the normal login/marketing content

# Admin subdomain rewrites to /superadmin
$B goto http://admin.localhost:8003
$B wait --networkidle
$B url
# Expected: browser URL bar still shows admin.localhost:8003/ (rewrite is invisible to the client)
$B text
# Expected: contains "SuperAdmin Dashboard" or the superadmin login, not the marketing page

# Direct /superadmin hit on the root domain redirects to admin subdomain
$B goto http://localhost:8003/superadmin
$B wait --networkidle
$B url
# Expected: http://admin.localhost:8003/superadmin
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/middleware.ts frontend/src/app/workspace-not-found/page.tsx docker-compose.yml
git commit -m "feat(frontend): add subdomain-based routing middleware"
```

---

## Task 8: Superadmin login page (admin subdomain)

**Files:**
- Modify: `frontend/src/components/pages/LoginPage.tsx`
- Modify: `frontend/src/hooks/useAuth.ts:38-53` (`login` function signature)
- Modify: `frontend/src/api/client.ts:44-47` (`login` method signature)
- Modify: `frontend/src/contexts/AuthContext.tsx:11` (type signature)

**Interfaces:**
- Consumes: `extractSubdomain` from Task 6.
- Produces: `api.login(email, password, options?: { slug?: string; adminLogin?: boolean })` — the new optional third parameter. `useAuth().login` and `AuthContext`'s `login` gain the same optional third parameter, defaulting to omitted (today's behavior) when not on a recognized subdomain.

- [ ] **Step 1: Update the API client's `login` method**

In `frontend/src/api/client.ts`, replace:
```typescript
  async login(email: string, password: string) {
    const { data } = await this.client.post('/auth/login', { email, password });
    return data;
  }
```
with:
```typescript
  async login(email: string, password: string, options?: { slug?: string; adminLogin?: boolean }) {
    const { data } = await this.client.post('/auth/login', { email, password, ...options });
    return data;
  }
```

- [ ] **Step 2: Update `useAuth`'s `login` callback**

In `frontend/src/hooks/useAuth.ts`, replace:
```typescript
  const login = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      const response: AuthResponse = await api.login(email, password);
```
with:
```typescript
  const login = useCallback(async (email: string, password: string, options?: { slug?: string; adminLogin?: boolean }) => {
    setError(null);
    try {
      const response: AuthResponse = await api.login(email, password, options);
```
(leave the rest of the function body unchanged).

- [ ] **Step 3: Update `AuthContext`'s type signature**

In `frontend/src/contexts/AuthContext.tsx`, change:
```typescript
  login: (email: string, password: string) => Promise<User>;
```
to:
```typescript
  login: (email: string, password: string, options?: { slug?: string; adminLogin?: boolean }) => Promise<User>;
```

- [ ] **Step 4: Update `LoginPage.tsx` to detect subdomain context and pass it through**

In `frontend/src/components/pages/LoginPage.tsx`, add near the top of the component (after existing `useState` calls):
```typescript
  const [subdomain, setSubdomain] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setSubdomain(extractSubdomain(window.location.host));
    }
  }, []);
```
Add the needed imports at the top of the file:
```typescript
import { useEffect } from 'react';
import { extractSubdomain } from '@/lib/subdomain';
```
(merge into the existing `import React, { useState } from 'react';` line so it becomes `import React, { useState, useEffect } from 'react';`).

Update `handleSubmit` to pass the context through:
```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const options = subdomain === 'admin'
        ? { adminLogin: true }
        : subdomain
          ? { slug: subdomain }
          : undefined;
      const success = await login(email, password, options);
      if (success) {
        router.push('/');
      } else {
        setError('Login failed. Please check your credentials.');
      }
    } catch (err: unknown) {
      const error = err as Error;
      setError(error.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };
```

Update the copy in the form header to reflect context — replace the static:
```typescript
              <h2 style={formTitle}>Operator sign in</h2>
                <p style={formSubtitle}>Sign in to your staff/admin account to manage queues and services.</p>
```
with:
```typescript
              <h2 style={formTitle}>{subdomain === 'admin' ? 'Superadmin sign in' : 'Operator sign in'}</h2>
              <p style={formSubtitle}>
                {subdomain === 'admin'
                  ? 'Sign in with your superadmin account to manage organizations and plans.'
                  : 'Sign in to your staff/admin account to manage queues and services.'}
              </p>
```

- [ ] **Step 5: Verify manually with the browse skill**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"

# Tenant subdomain: only the matching org's user can log in
$B goto http://nyaho.localhost:8003/login
$B wait --networkidle
$B snapshot -i
$B fill @e1 "harrisyn@gmail.com"
$B fill @e3 "12345678"
$B click @e5
$B wait --networkidle
$B url
# Expected: redirected to http://nyaho.localhost:8003/ (dashboard), not stuck on /login

# Admin subdomain: tenant creds should fail
$B goto http://admin.localhost:8003/login
$B wait --networkidle
$B text
# Expected: contains "Superadmin sign in"
$B snapshot -i
$B fill @e1 "harrisyn@gmail.com"
$B fill @e3 "12345678"
$B click @e5
$B wait --networkidle
$B text
# Expected: still on /login, shows an error message (invalid credentials)

# Admin subdomain: superadmin creds should succeed
$B fill @e1 "superadmin@qms.local"
$B fill @e3 "12345678"
$B click @e5
$B wait --networkidle
$B url
# Expected: redirected off /login
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/client.ts frontend/src/hooks/useAuth.ts frontend/src/contexts/AuthContext.tsx frontend/src/components/pages/LoginPage.tsx
git commit -m "feat(frontend): make login page subdomain-aware (tenant vs superadmin)"
```

---

## Task 9: Wire the tenant Settings slug field to subdomain copy and live validation

**Files:**
- Modify: `frontend/src/components/pages/AdminSettingsPage.tsx` (the slug section identified during planning around lines 210-363)

**Interfaces:**
- Consumes: `isReservedSlug` and `buildTenantUrl` from Task 6.
- Produces: no new interface — this is a UX-only change to an already-functional save path.

- [ ] **Step 1: Update the URL preview copy**

Find the line:
```typescript
                    {formData.slug ? (
                      <>Your public URL will be: <strong>yourdomain.com/{formData.slug}</strong></>
                    ) : (
```
Replace with (using the util from Task 6):
```typescript
                    {formData.slug ? (
                      <>Your workspace URL will be: <strong>{buildTenantUrl(formData.slug).replace(/^https?:\/\//, '')}</strong></>
                    ) : (
```
Add the import at the top of the file: `import { buildTenantUrl } from '@/lib/subdomain';`

- [ ] **Step 2: Add live reserved-word feedback**

Find the slug `<input>`'s `onChange` handler (identified during planning around line 350-354):
```typescript
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
```
Leave this unchanged (it already normalizes input), but add a validation message below the input. Find where the field's helper text renders (the `formData.slug ? ... : 'Create a memorable URL slug...'` block from Step 1) and wrap it with a reserved-word check, importing `isReservedSlug` from `@/lib/subdomain` mirror at `@/lib/reservedSlugs`:
```typescript
                    {formData.slug && isReservedSlug(formData.slug) ? (
                      <span style={{ color: '#dc2626' }}>This slug is reserved and can&apos;t be used.</span>
                    ) : formData.slug ? (
                      <>Your workspace URL will be: <strong>{buildTenantUrl(formData.slug).replace(/^https?:\/\//, '')}</strong></>
                    ) : (
                      'Create a memorable URL slug for your organization'
                    )}
```
Add the second import: `import { isReservedSlug } from '@/lib/reservedSlugs';`

- [ ] **Step 3: Disable the Save button when the slug is reserved**

Find the save button / form-level validation (the handler that calls the update API with `slug: formData.slug || undefined`, identified around line 166). Add a guard immediately before that call:
```typescript
    if (formData.slug && isReservedSlug(formData.slug)) {
      setError('This slug is reserved and cannot be used.');
      return;
    }
```
(Match the existing error-state variable name used elsewhere in this component — read the surrounding code to confirm whether it's `setError`, `setSaveError`, or similar, and use that name instead if different.)

- [ ] **Step 4: Verify manually with the browse skill**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"
$B goto http://nyaho.localhost:8003/admin/settings
$B wait --networkidle
$B snapshot -i
# find the slug input ref and type a reserved word
$B fill @eN "admin"
$B text
# Expected: contains "This slug is reserved and can't be used."
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/pages/AdminSettingsPage.tsx
git commit -m "feat(frontend): show subdomain URL preview and reserved-word validation in org settings"
```

---

## Task 10: Registration wizard — slug step and redirect to live subdomain

**Files:**
- Modify: `frontend/src/components/pages/RegisterPage.tsx` (step 1 fields around lines 359-404, and `completeRegistration` around lines 150-188)
- Modify: `frontend/src/api/client.ts:512` (`registerOrganization` payload type)
- Modify: `backend/src/routes/index.ts:54-57` and `backend/src/controllers/organization.controller.ts` (`registerOrganization` already accepts `slug` from Task 3 — just confirm the response includes it, which it already does since the whole `organization` object is returned)

**Interfaces:**
- Consumes: `isReservedSlug` (Task 6), `slugify`-equivalent behavior already enforced server-side (Task 3), `buildTenantUrl` (Task 6).
- Produces: no new interface — `api.registerOrganization` payload gains an optional `slug` field.

- [ ] **Step 1: Add a slug field to the API client's payload type**

In `frontend/src/api/client.ts`, find the `registerOrganization` method (around line 512) and its payload type. Add `slug?: string;` to the payload interface/inline type, and pass it through in the request body (it likely already spreads the whole payload object — if so, no further change needed beyond the type).

- [ ] **Step 2: Add a slug input to step 1 of the wizard**

In `frontend/src/components/pages/RegisterPage.tsx`, find the `step === 1` block (around line 359-404) which currently has the `organizationName` field. Add a slug field after it, auto-populated from the org name but editable:

```typescript
                  <div style={styles.fieldGroup}>
                    <label style={styles.label}>Workspace URL</label>
                    <div style={styles.slugInputRow}>
                      <input
                        name="slug"
                        value={formData.slug || ''}
                        onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                        placeholder="your-org"
                        style={styles.input}
                      />
                    </div>
                    <p style={styles.hint}>
                      {formData.slug && isReservedSlug(formData.slug)
                        ? <span style={{ color: '#dc2626' }}>This name is reserved — pick another.</span>
                        : <>Your workspace will be at <strong>{buildTenantUrl(formData.slug || 'your-org').replace(/^https?:\/\//, '')}</strong></>}
                    </p>
                  </div>
```
Match `styles.fieldGroup`, `styles.label`, `styles.input`, `styles.hint` to whatever style object names this file already uses for the `organizationName` field immediately above (read the surrounding JSX to copy the exact style keys rather than inventing new ones) — add a `slugInputRow` style only if needed for layout, otherwise reuse `styles.input` directly.

Add the type field: find the `formData` state's TypeScript interface near the top of the file (around line 13, where `organizationName: string;` is declared) and add `slug?: string;` alongside it.

Add the imports: `import { isReservedSlug } from '@/lib/reservedSlugs';` and `import { buildTenantUrl } from '@/lib/subdomain';`.

- [ ] **Step 3: Block advancing past step 1 with a reserved slug**

In the `nextStep` function (around line 190-215), inside the `if (step === 1) { ... }` block that already validates `organizationName` and first/last name, add:
```typescript
      if (formData.slug && isReservedSlug(formData.slug)) {
        setError('This workspace name is reserved. Please choose another.');
        return;
      }
```

- [ ] **Step 4: Pass the slug through on submission and redirect to the live subdomain**

In `completeRegistration` (around line 150-188), add `slug: formData.slug || undefined,` to the `api.registerOrganization` call's payload object.

Change the destructuring of the `api.registerOrganization` call from:
```typescript
      const { token } = await api.registerOrganization({
```
to:
```typescript
      const { token, organization } = await api.registerOrganization({
```
(the call's arguments stay the same as Step 4 above, just the destructured result changes).

Then replace the completion redirect:
```typescript
      setTimeout(() => {
        window.location.href = '/';
      }, 2000);
```
with (using the org slug returned by the backend, which Task 3 guarantees is always populated even if the user left the field blank — auto-generated in that case):
```typescript
      setTimeout(() => {
        window.location.href = buildTenantUrl(organization.slug);
      }, 2000);
```

Also update the `localStorage.setItem('token', token)` call — since it now needs to run on the *tenant subdomain*, not the current (root domain) origin, localStorage set here won't carry over after the redirect (different origin). Remove the `localStorage.setItem('token', token)` line entirely; the user will land on their new subdomain's `/login` page (via the redirect) already knowing their just-created credentials, which is an acceptable first pass — do not attempt to pass the token cross-origin (that would require URL-based token handoff, which is unnecessary complexity for this plan; flag it as a possible future polish item, not build it now).

- [ ] **Step 5: Verify manually with the browse skill**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"
$B goto http://localhost:8003/register
$B wait --networkidle
$B snapshot -i
# fill organization name, confirm slug auto-populates or fill it manually, complete the wizard through to step 4
# ... (steps depend on exact refs at runtime)
# After final submission:
$B wait --networkidle
$B url
# Expected, after the 2s redirect delay: http://<slug>.localhost:8003/ or /login
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/pages/RegisterPage.tsx frontend/src/api/client.ts
git commit -m "feat(frontend): add workspace slug to signup and redirect to live subdomain"
```

---

## Task 11: Full end-to-end verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run all backend smoke scripts in sequence**

```bash
node tests/slug-utils-smoke.js
node tests/org-by-slug-smoke.js
node tests/org-slug-registration-smoke.js
node tests/login-scoping-smoke.js
node tests/smoke-test.js
```
Expected: all five exit 0.

- [ ] **Step 2: Full browse-skill walkthrough matching the design spec's testing plan**

```bash
B="/c/Users/harri/.claude/skills/gstack/browse/dist/browse"

# Root domain shows marketing site
$B goto http://localhost:8003
$B wait --networkidle
$B text

# Tenant subdomain login works for the matching org's user only
$B goto http://nyaho.localhost:8003/login
$B wait --networkidle
$B snapshot -i
$B fill @e1 "harrisyn@gmail.com"; $B fill @e3 "12345678"; $B click @e5
$B wait --networkidle
$B url

# Admin subdomain login works for superadmin only
$B goto http://admin.localhost:8003/login
$B wait --networkidle
$B snapshot -i
$B fill @e1 "superadmin@qms.local"; $B fill @e3 "12345678"; $B click @e5
$B wait --networkidle
$B url
$B text
# Confirm no tenant data anywhere on this page

# Unknown tenant slug shows workspace-not-found
$B goto http://ghost-workspace.localhost:8003
$B wait --networkidle
$B text

# Regression: public join and display flows are untouched by this work
$B goto http://localhost:8003/join/AIRPORTMAIN
$B wait --networkidle
$B text
# Expected: still shows the "Select a Service" / "Airport Main" join page as before

$B goto http://localhost:8003/display/36c19e00-f9cd-4c3c-9c51-8745666b8105
$B wait --networkidle
$B text
# Expected: still shows the queue display board as before (use whatever real location ID exists in your dev DB)
```

- [ ] **Step 3: Update the audit findings doc to mark resolved items**

In `docs/superpowers/specs/audit-findings.md`, under the superadmin section, add a note that the cross-tenant data leak finding was fixed in this plan, and under "Open Questions / Decisions Needed", mark the temporary `superadmin@qms.local` account as still needing deletion before any non-dev use (unchanged — still an open item, just confirm it's still accurate).

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/audit-findings.md
git commit -m "docs: mark superadmin data-leak finding resolved by subdomain multi-tenancy work"
```

---

## Explicitly deferred (not built in this plan)

- **Production DNS/Vercel wildcard domain setup.** Adding `*.enqueueq.com` as a Vercel domain and pointing wildcard DNS at it is an infra/ops action taken outside this codebase — no task here performs it, since there's nothing to commit. Do this manually before relying on subdomains in production; local dev (`*.localhost:8003`) needs no such setup.
- **Old-subdomain redirect after a slug change.** The design spec's edge-case section proposed redirecting an old slug to a renamed org's new slug, but also correctly noted that doing so needs slug history (a previous-slugs table), which is real added scope. This plan does not build slug history — changing a slug in Settings (Task 9) simply changes the live slug; the old subdomain starts returning "Workspace not found" immediately. Flagging this as a known gap rather than silently dropping it: revisit if tenants actually rename after going live and this becomes a real support burden.
- **Token handoff across the signup→subdomain redirect.** Noted inline in Task 10 — the freshly-issued JWT from registration isn't carried across the origin change, so the new tenant lands on their subdomain's login page rather than being auto-logged-in. Acceptable for a first pass; revisit only if user feedback says the extra login step is annoying.
