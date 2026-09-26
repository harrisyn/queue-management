// Tenant isolation smoke test. Runs INSIDE the backend container (needs its
// JWT_SECRET and DB):  docker exec qms-backend node /app/tests/tenant-isolation-smoke.js
// Read-only except for two rejected write attempts (which must not succeed).
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const BASE = process.env.SMOKE_BASE_URL || 'http://localhost:3000/api/v1';
const secret = process.env.JWT_SECRET || 'dev-only-jwt-secret';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};

async function call(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

(async () => {
  const admin = await prisma.user.findFirst({ where: { role: 'ORG_ADMIN', isActive: true, organizationId: { not: null } } });
  const locAdmin = await prisma.user.findFirst({ where: { role: 'LOCATION_ADMIN', isActive: true } });
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '5m' });
  const ownOrg = admin.organizationId;

  const users = await call(token, 'GET', '/users');
  const foreign = (users.json || []).filter((u) => u.organizationId !== ownOrg);
  check('GET /users returns only own-org users', users.status === 200 && foreign.length === 0, `${foreign.length} foreign`);

  const foreignUsers = await call(token, 'GET', `/users?organizationId=__other__`);
  check('GET /users ignores a foreign organizationId filter', (foreignUsers.json || []).every((u) => u.organizationId === ownOrg));

  const escalate = await call(token, 'POST', '/users', {
    email: `escalate-${Date.now()}@example.com`, password: 'password123', firstName: 'X', lastName: 'Y', role: 'SUPER_ADMIN',
  });
  check('ORG_ADMIN cannot create a SUPER_ADMIN', escalate.status === 403, `status ${escalate.status}`);

  const selfPromote = await call(token, 'PUT', `/users/${admin.id}`, { role: 'SUPER_ADMIN' });
  check('ORG_ADMIN cannot change own role', selfPromote.status === 403, `status ${selfPromote.status}`);

  if (locAdmin) {
    const laToken = jwt.sign({ userId: locAdmin.id, role: locAdmin.role }, secret, { expiresIn: '5m' });
    const r = await call(laToken, 'PUT', `/users/${admin.id}`, { isActive: false });
    check('LOCATION_ADMIN cannot deactivate an ORG_ADMIN', r.status === 403 || r.status === 404, `status ${r.status}`);
  }

  const ownLocation = await prisma.location.findFirst({ where: { organizationId: ownOrg } });
  const foreignLocation = await prisma.location.findFirst({ where: { organizationId: { not: ownOrg } } });
  if (ownLocation) {
    const r = await call(token, 'GET', `/locations/${ownLocation.id}`);
    check('own location readable', r.status === 200, `status ${r.status}`);
  }
  if (foreignLocation) {
    const r = await call(token, 'GET', `/locations/${foreignLocation.id}`);
    check('foreign location hidden', r.status === 404, `status ${r.status}`);
    const a = await call(token, 'GET', `/analytics/location/${foreignLocation.id}`);
    check('foreign location analytics hidden', a.status === 404, `status ${a.status}`);
    const orgLocs = await call(token, 'GET', `/locations/orgs/${foreignLocation.organizationId}/locations`);
    check('foreign org location list hidden', orgLocs.status === 404, `status ${orgLocs.status}`);
  } else {
    console.log('SKIP  no foreign location in DB');
  }

  const foreignQueue = await prisma.queue.findFirst({ where: { service: { location: { organizationId: { not: ownOrg } } } } });
  if (foreignQueue) {
    const r = await call(token, 'POST', `/queues/${foreignQueue.id}/call-next`);
    check('cannot call-next on a foreign queue', r.status === 404, `status ${r.status}`);
  } else {
    console.log('SKIP  no foreign queue in DB');
  }

  const invites = await call(token, 'GET', '/invites');
  check('GET /invites returns only own-org invites', (invites.json || []).every((i) => i.organizationId === ownOrg));

  const noInvite = await fetch(`${BASE}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'x@example.com', password: 'password123', firstName: 'a', lastName: 'b', role: 'SUPER_ADMIN' }),
  });
  check('register without invite is rejected', noInvite.status === 403, `status ${noInvite.status}`);

  const unverified = await fetch(`${BASE}/public/register-org`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ organizationName: 'Bypass Co', adminEmail: `bypass-${Date.now()}@example.com`, adminPassword: 'password123', adminFirstName: 'a', adminLastName: 'b', emailVerified: true }),
  });
  check('org signup with client-side emailVerified flag is rejected', unverified.status === 400, `status ${unverified.status}`);

  await prisma.$disconnect();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
