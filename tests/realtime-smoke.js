// Real-time smoke test: subscribes to a queue channel on Soketi, has staff
// call the next patient, and checks the event arrives with no patient data.
// Runs INSIDE the app container:
//   docker cp tests/realtime-smoke.js qms-app:/app/ && docker exec qms-app node /app/realtime-smoke.js
const Pusher = require('pusher-js/node');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

const prisma = new PrismaClient();
const BASE = 'http://localhost:3000/api/v1';

(async () => {
  const service = await prisma.service.findFirst({ where: { isActive: true, location: { organization: { slug: 'nyaho' } } } });
  const admin = await prisma.user.findFirst({ where: { role: 'ORG_ADMIN', organization: { slug: 'nyaho' } } });
  const token = jwt.sign({ userId: admin.id, role: admin.role }, process.env.JWT_SECRET || 'dev-only-jwt-secret', { expiresIn: '5m' });
  const post = (path, body, auth = true) => fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(auth ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body || {}),
  }).then((r) => r.json());

  const joined = await post('/public/join', { serviceId: service.id, name: 'Realtime Check' }, false);
  const client = new Pusher(process.env.NEXT_PUBLIC_REALTIME_KEY, {
    cluster: 'mt1', wsHost: process.env.REALTIME_HOST, wsPort: Number(process.env.REALTIME_PORT), forceTLS: false, enabledTransports: ['ws'],
  });
  const channel = client.subscribe(`queue-${joined.queueId}`);
  const received = [];
  channel.bind_global((event, data) => { if (!event.startsWith('pusher:')) received.push({ event, data }); });
  await new Promise((r) => channel.bind('pusher:subscription_succeeded', r));

  await prisma.queueEntry.update({ where: { id: joined.entryId }, data: { priority: 99 } });
  await post(`/queues/${joined.queueId}/call-next`);
  await new Promise((r) => setTimeout(r, 1500));

  const statusEvent = received.find((r) => r.event === 'entry.status_changed' && r.data.entryId === joined.entryId);
  const leaked = received.some((r) => JSON.stringify(r.data).includes('Realtime Check'));
  console.log(statusEvent ? 'PASS  entry.status_changed received' : 'FAIL  no status event', JSON.stringify(received.map((r) => r.event)));
  console.log(leaked ? 'FAIL  patient name leaked into a public event' : 'PASS  events carry no patient names');
  await fetch(`${BASE}/queues/${joined.queueId}/entry/${joined.entryId}/complete`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
  client.disconnect();
  await prisma.$disconnect();
  process.exit(statusEvent && !leaked ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });
