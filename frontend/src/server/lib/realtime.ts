import { AsyncLocalStorage } from 'async_hooks';
import type { Request, Response, NextFunction } from 'express';
import Pusher from 'pusher';

/**
 * Real-time fan-out over the Pusher Channels protocol: Pusher or Ably in
 * production, Soketi (open source, docker-compose) locally. Replaces
 * Socket.IO, which needs a long-lived server process and so can't run on
 * serverless platforms.
 *
 * Channels are public and keyed by resource UUID (queue-<id>,
 * location-<id>, user-<id>, service-<id>). Payloads are reduced to IDs,
 * statuses and short notification text - never names, phone numbers or
 * identifiers - because every subscriber simply refetches through the
 * authorized (or public, already-redacted) API when something changes.
 *
 * With no REALTIME_* configuration this is a no-op and clients fall back to
 * polling (see hooks/useSocket.ts).
 */

export const SOCKET_EVENTS = {
  QUEUE_UPDATED: 'queue.updated',
  ENTRY_STATUS_CHANGED: 'entry.status_changed',
  SLOT_RELEASED: 'slot.released',
  SERVICEFLOW_TRANSITION: 'serviceflow.transition',
  NOTIFICATION_SENT: 'notification.sent',
  LOCATION_UPDATED: 'location.updated',
} as const;

// The only payload fields that ever leave the server.
const SIGNAL_FIELDS = [
  'queueId', 'entryId', 'status', 'action', 'locationId', 'fromQueueId', 'toQueueId', 'slotId', 'type', 'message',
] as const;

function toSignal(data: unknown): Record<string, unknown> {
  const source = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const signal: Record<string, unknown> = {};
  for (const key of SIGNAL_FIELDS) {
    const value = source[key];
    if (value !== undefined && (typeof value === 'string' || typeof value === 'number' || value === null)) {
      signal[key] = value;
    }
  }
  // Transfers carry the new entry object - keep only its id/queue.
  const entry = source.entry as Record<string, unknown> | undefined;
  if (entry && typeof entry === 'object') {
    if (!signal.entryId && typeof entry.id === 'string') signal.entryId = entry.id;
    if (!signal.status && typeof entry.status === 'string') signal.status = entry.status;
  }
  return signal;
}

let client: Pusher | null | undefined;

function getClient(): Pusher | null {
  if (client !== undefined) return client;
  const { REALTIME_APP_ID, REALTIME_KEY, REALTIME_SECRET } = process.env;
  if (!REALTIME_APP_ID || !REALTIME_KEY || !REALTIME_SECRET) {
    client = null;
    return client;
  }
  client = new Pusher({
    appId: REALTIME_APP_ID,
    key: REALTIME_KEY,
    secret: REALTIME_SECRET,
    ...(process.env.REALTIME_HOST
      ? {
          host: process.env.REALTIME_HOST,
          port: process.env.REALTIME_PORT,
          useTLS: process.env.REALTIME_TLS === 'true',
        }
      : { cluster: process.env.REALTIME_CLUSTER || 'mt1', useTLS: true }),
  });
  return client;
}

export const isRealtimeConfigured = () => getClient() !== null;

interface PendingEvent {
  channel: string;
  name: string;
  data: Record<string, unknown>;
}

const requestEvents = new AsyncLocalStorage<PendingEvent[]>();

async function send(events: PendingEvent[]) {
  const pusher = getClient();
  if (!pusher || events.length === 0) return;
  // triggerBatch accepts at most 10 events per call.
  for (let i = 0; i < events.length; i += 10) {
    try {
      await pusher.triggerBatch(events.slice(i, i + 10));
    } catch (error) {
      console.error('Realtime publish failed:', error);
    }
  }
}

function publish(channel: string, name: string, data: unknown) {
  if (!getClient()) return;
  const event = { channel, name, data: toSignal(data) };
  const pending = requestEvents.getStore();
  if (pending) pending.push(event);
  else void send([event]);
}

/** Express middleware: collects events raised while handling the request and
 * publishes them before the response is finished. */
export function realtimeRequestScope(req: Request, res: Response, next: NextFunction) {
  if (!getClient()) return next();
  const pending: PendingEvent[] = [];
  const originalEnd = res.end.bind(res) as (...args: unknown[]) => Response;
  let flushed = false;
  (res as any).end = (...args: unknown[]) => {
    if (flushed || pending.length === 0) return originalEnd(...args);
    flushed = true;
    const events = pending.splice(0);
    send(events).finally(() => originalEnd(...args));
    return res;
  };
  requestEvents.run(pending, () => next());
}

export const emitToQueue = (queueId: string, event: string, data: unknown) =>
  publish(`queue-${queueId}`, event, { queueId, ...(data as object) });

export const emitToUser = (userId: string, event: string, data: unknown) => publish(`user-${userId}`, event, data);

export const emitToService = (serviceId: string, event: string, data: unknown) =>
  publish(`service-${serviceId}`, event, data);

export const emitToLocation = (locationId: string, event: string, data: unknown) =>
  publish(`location-${locationId}`, event, { locationId, ...(data as object) });

// Emit to both queue and location channels for broader real-time updates
export const emitToQueueAndLocation = (queueId: string, locationId: string | null, event: string, data: unknown) => {
  emitToQueue(queueId, event, data);
  if (locationId) emitToLocation(locationId, event, data);
};
