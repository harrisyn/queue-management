import prisma from '../../lib/prisma';
import { getStartOfDay } from '../../utils/date';
import { liveStatus } from './metrics';

/**
 * Statistical (non-LLM) wait-time forecasting and wait-spike detection.
 * Deterministic, cheap and explainable: an LLM adds nothing to arithmetic
 * over history, so it is only used to explain these numbers, never to
 * produce them.
 */

const HISTORY_WEEKS = 8;

function quantile(values: number[], q: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))];
}

const median = (values: number[]) => quantile(values, 0.5);

async function history(serviceId: string, weekday: number) {
  const since = getStartOfDay(new Date(Date.now() - HISTORY_WEEKS * 7 * 86400000));
  const entries = await prisma.queueEntry.findMany({
    where: { queue: { serviceId }, joinedAt: { gte: since, lt: getStartOfDay() } },
    select: { joinedAt: true, calledAt: true, completedAt: true, status: true, waitDuration: true, serviceDuration: true },
    take: 20_000,
  });
  const sameWeekday = entries.filter((e) => e.joinedAt.getDay() === weekday);
  const weekdaysSeen = new Set(sameWeekday.map((e) => e.joinedAt.toISOString().slice(0, 10))).size;
  return { entries, sameWeekday, weekdaysSeen };
}

const waitOf = (e: { waitDuration: number | null; joinedAt: Date; calledAt: Date | null }) =>
  e.waitDuration ?? (e.calledAt ? (e.calledAt.getTime() - e.joinedAt.getTime()) / 60000 : null);

/** How many people this service can serve at once right now. */
async function activeServers(serviceId: string): Promise<number> {
  const instances = await prisma.servicePointInstance.findMany({
    where: { isActive: true, servicePointService: { serviceId, isActive: true } },
    select: { occupiedByUserId: true },
  });
  const occupied = instances.filter((i) => i.occupiedByUserId).length;
  return Math.max(1, occupied || instances.length);
}

export async function forecastService(organizationId: string, serviceId: string) {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, location: { organizationId } },
    select: { id: true, name: true, slotDuration: true, concurrentLimit: true },
  });
  if (!service) return null;

  const now = new Date();
  const { entries, sameWeekday, weekdaysSeen } = await history(serviceId, now.getDay());

  const serviceTimes = entries
    .map((e) => e.serviceDuration ?? (e.status === 'SERVED' && e.calledAt && e.completedAt ? (e.completedAt.getTime() - e.calledAt.getTime()) / 60000 : null))
    .filter((v): v is number => v !== null && v > 0);
  const typicalServiceMinutes = median(serviceTimes) ?? service.slotDuration;

  const arrivalsByHour = new Map<number, number>();
  for (const e of sameWeekday) arrivalsByHour.set(e.joinedAt.getHours(), (arrivalsByHour.get(e.joinedAt.getHours()) || 0) + 1);
  const expectedArrivals = [...arrivalsByHour.entries()]
    .filter(([hour]) => hour >= now.getHours())
    .sort((a, b) => a[0] - b[0])
    .map(([hour, count]) => ({ hour, expectedArrivals: Math.round((count / Math.max(1, weekdaysSeen)) * 10) / 10 }));

  const waitsThisHour = sameWeekday
    .filter((e) => e.joinedAt.getHours() === now.getHours())
    .map(waitOf)
    .filter((v): v is number => v !== null);

  const waiting = await prisma.queueEntry.count({
    where: { status: 'WAITING', queue: { serviceId, date: getStartOfDay() } },
  });
  const servers = await activeServers(serviceId);

  return {
    serviceId: service.id,
    service: service.name,
    asOf: now.toISOString(),
    waitingNow: waiting,
    servingCapacity: servers,
    typicalServiceMinutes: Math.round(typicalServiceMinutes * 10) / 10,
    predictedWaitForNewArrivalMinutes: Math.round((waiting * typicalServiceMinutes) / servers),
    typicalWaitThisHourMinutes: quantile(waitsThisHour, 0.5),
    busyWaitThisHourMinutes: quantile(waitsThisHour, 0.75),
    expectedArrivalsRestOfDay: expectedArrivals,
    basis: {
      historyWeeks: HISTORY_WEEKS,
      sameWeekdaysSeen: weekdaysSeen,
      servedSamples: serviceTimes.length,
      method: 'median service time x people waiting / active desks; arrivals averaged over the same weekday',
    },
  };
}

export interface WaitAlert {
  serviceId: string;
  service: string;
  severity: 'warning' | 'critical' | 'info';
  message: string;
}

/** Live alerts for a location: waits far above normal for this hour, or
 * people waiting with nobody being served. */
export async function locationAlerts(organizationId: string, locationId: string): Promise<WaitAlert[]> {
  const live = await liveStatus({ organizationId, locationId });
  const now = new Date();
  const alerts: WaitAlert[] = [];

  for (const s of live.services) {
    if (s.waiting === 0) continue;
    if (s.queueStatus !== 'ACTIVE') {
      alerts.push({ serviceId: s.serviceId, service: s.service, severity: 'info', message: `${s.waiting} waiting while the queue is ${s.queueStatus.toLowerCase()}.` });
      continue;
    }
    if (s.beingServed === 0 && s.longestCurrentWaitMinutes >= 5) {
      alerts.push({
        serviceId: s.serviceId,
        service: s.service,
        severity: 'critical',
        message: `${s.waiting} waiting and nobody is being served (longest wait ${s.longestCurrentWaitMinutes} min).`,
      });
      continue;
    }
    const { sameWeekday } = await history(s.serviceId, now.getDay());
    const busy = quantile(
      sameWeekday.filter((e) => e.joinedAt.getHours() === now.getHours()).map(waitOf).filter((v): v is number => v !== null),
      0.75
    );
    const threshold = Math.max(15, (busy ?? 10) * 1.5);
    if (s.longestCurrentWaitMinutes > threshold) {
      alerts.push({
        serviceId: s.serviceId,
        service: s.service,
        severity: 'warning',
        message:
          `Longest wait is ${s.longestCurrentWaitMinutes} min with ${s.waiting} waiting` +
          (busy !== null ? `; a busy ${now.toLocaleDateString('en', { weekday: 'long' })} at this hour is about ${Math.round(busy)} min.` : '.'),
      });
    }
  }
  return alerts;
}
