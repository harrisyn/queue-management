// End-to-end smoke test of the queue event pipeline. Runs INSIDE the backend
// container:  docker cp tests/queue-flow-smoke.js qms-app:/app/ && docker exec qms-app node /app/queue-flow-smoke.js
// Creates real rows (a guest patient, queue entries, a webhook endpoint that
// it deletes again) in the first org that has two active services.
const http = require('http');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000/api/v1';
const secret = process.env.JWT_SECRET || 'dev-only-jwt-secret';

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!ok) failures++;
};
const call = async (token, method, path, body) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

(async () => {
  // Local webhook receiver
  const received = [];
  let hookSecret = '';
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const ts = req.headers['x-webhook-timestamp'];
      const expected = 'sha256=' + crypto.createHmac('sha256', hookSecret).update(`${ts}.${body}`).digest('hex');
      received.push({ event: req.headers['x-webhook-event'], valid: req.headers['x-webhook-signature'] === expected, body: JSON.parse(body) });
      res.writeHead(200).end('ok');
    });
  }).listen(9999);

  const services = await prisma.service.findMany({
    where: { isActive: true, location: { organization: { slug: 'nyaho' } } },
    include: { location: true },
    take: 2,
  });
  if (services.length < 2) throw new Error('need two active services in the nyaho org');
  const [from, to] = services;
  const orgId = from.location.organizationId;
  const admin = await prisma.user.findFirst({ where: { organizationId: orgId, role: 'ORG_ADMIN', isActive: true } });
  const token = jwt.sign({ userId: admin.id, role: admin.role }, secret, { expiresIn: '10m' });

  const hook = await call(token, 'POST', `/orgs/${orgId}/webhooks`, { url: 'http://localhost:9999/hook', description: 'smoke test' });
  check('create webhook returns a one-time secret', hook.status === 201 && /^whsec_/.test(hook.json?.secret || ''), `status ${hook.status}`);
  hookSecret = hook.json?.secret || '';

  // Make sure today's queues are open
  for (const s of [from, to]) {
    const q = await call(token, 'POST', '/queues', { serviceId: s.id });
    if (q.json?.id && q.json.status !== 'ACTIVE') await call(token, 'PATCH', `/queues/${q.json.id}/status`, { status: 'ACTIVE' });
  }

  const join = await call(null, 'POST', '/public/join', { serviceId: from.id, name: 'Smoke Patient', phone: '+233200000000' });
  check('public join', join.status === 201, `status ${join.status} ${JSON.stringify(join.json).slice(0, 120)}`);
  const { queueId, entryId } = join.json;

  const joinedEntry = await prisma.queueEntry.findUnique({ where: { id: entryId } });
  check('join starts a journey', !!joinedEntry.journeyId);

  // Move our patient to the front so call-next picks them
  await prisma.queueEntry.update({ where: { id: entryId }, data: { priority: 99 } });
  const called = await call(token, 'POST', `/queues/${queueId}/call-next`);
  check('call-next picks the patient', called.json?.id === entryId, `got ${called.json?.id}`);
  const calledEntry = await prisma.queueEntry.findUnique({ where: { id: entryId } });
  check('waitDuration recorded on call', calledEntry.waitDuration !== null);

  const nowServing = await prisma.notification.findFirst({ where: { queueEntryId: entryId, type: 'NOW_SERVING' } });
  check('NOW_SERVING notification created', !!nowServing);

  const complete = await call(token, 'PATCH', `/queues/${queueId}/entry/${entryId}/complete`);
  check('complete', complete.status === 200, `status ${complete.status}`);

  const transfer = await call(token, 'POST', `/queues/${queueId}/entry/${entryId}/transfer`, { serviceId: to.id });
  check('transfer to next service', transfer.status === 201, `status ${transfer.status} ${JSON.stringify(transfer.json).slice(0, 120)}`);
  const newEntry = transfer.json?.entry;
  if (newEntry) {
    const e = await prisma.queueEntry.findUnique({ where: { id: newEntry.id } });
    check('transferred entry links back to source', e.previousEntryId === entryId);
    check('transferred entry keeps session + journey', e.sessionId === joinedEntry.sessionId && e.journeyId === joinedEntry.journeyId);
    const journey = await prisma.customerJourney.findUnique({ where: { id: e.journeyId } });
    check('journey has both entries and is open', journey.queueEntryIds.length === 2 && !journey.completedAt);

    await call(token, 'PATCH', `/queues/${e.queueId}/entry/${e.id}/cancel`);
    const closed = await prisma.customerJourney.findUnique({ where: { id: e.journeyId } });
    check('journey closes when nothing is left open', !!closed.completedAt && closed.totalDuration !== null);
  }

  const audit = await call(token, 'GET', `/orgs/${orgId}/audit-logs?limit=20`);
  const actions = (audit.json?.logs || []).filter((l) => [entryId, newEntry?.id].includes(l.entryId)).map((l) => l.action);
  for (const a of ['entry.joined', 'entry.called', 'entry.served', 'entry.transferred', 'entry.cancelled']) {
    check(`audit log has ${a}`, actions.includes(a));
  }

  await new Promise((r) => setTimeout(r, 500));
  const events = received.map((r) => r.event);
  check('webhooks delivered for queue events', ['entry.joined', 'entry.called', 'entry.transferred'].every((e) => events.includes(e)), events.join(','));
  check('webhook signatures verify', received.length > 0 && received.every((r) => r.valid));

  const foreign = await prisma.organization.findFirst({ where: { id: { not: orgId } } });
  if (foreign) {
    const r = await call(token, 'GET', `/orgs/${foreign.id}/audit-logs`);
    check('cannot read another org audit log', r.status === 404, `status ${r.status}`);
  }

  if (hook.json?.id) await call(token, 'DELETE', `/webhooks/${hook.json.id}`);
  server.close();
  await prisma.$disconnect();
  console.log(failures ? `\n${failures} FAILED` : '\nall passed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
