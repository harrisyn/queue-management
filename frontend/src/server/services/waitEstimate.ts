import prisma from '../lib/prisma';

/**
 * How long people wait, from how this service actually runs: the median
 * time at the desk over the last 30 days, divided across the desks open now.
 * Falls back to the service's configured slot length until there's history.
 * Cached briefly; it's read on every ticket page refresh.
 */

const CACHE_MS = 2 * 60 * 1000;
const cache = new Map<string, { minutesPerPerson: number; at: number }>();

async function pace(serviceId: string, fallbackMinutes: number, fallbackDesks: number) {
  const hit = cache.get(serviceId);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.minutesPerPerson;

  const since = new Date(Date.now() - 30 * 86400000);
  const [recent, desks] = await Promise.all([
    prisma.queueEntry.findMany({
      where: { queue: { serviceId }, status: 'SERVED', serviceDuration: { gt: 0 }, completedAt: { gte: since } },
      select: { serviceDuration: true },
      orderBy: { completedAt: 'desc' },
      take: 300,
    }),
    prisma.servicePointInstance.findMany({
      where: { isActive: true, servicePointService: { serviceId, isActive: true } },
      select: { occupiedByUserId: true },
    }),
  ]);

  const durations = recent.map((r) => r.serviceDuration as number).sort((a, b) => a - b);
  // A handful of samples is noise; wait for a reasonable amount of history.
  const perPerson = durations.length >= 10 ? durations[Math.floor(durations.length / 2)] : fallbackMinutes;
  const open = desks.filter((d) => d.occupiedByUserId).length || desks.length || fallbackDesks;
  const minutesPerPerson = perPerson / Math.max(1, open);
  cache.set(serviceId, { minutesPerPerson, at: Date.now() });
  return minutesPerPerson;
}

/** Minutes until someone with `ahead` people in front of them is called. */
export async function estimateWaitMinutes(
  service: { id: string; slotDuration: number; concurrentLimit?: number | null },
  ahead: number
): Promise<number> {
  if (ahead <= 0) return 0;
  const minutes = await pace(service.id, service.slotDuration, service.concurrentLimit || 1);
  return Math.max(1, Math.round(ahead * minutes));
}
