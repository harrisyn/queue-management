import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { getStartOfDay, getEndOfDay } from '../utils/date';

// Queue metrics for a specific date
export const getQueueMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        entries: true,
        service: true,
      },
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const entries = queue.entries;
    const served = entries.filter(e => e.status === 'SERVED');
    const noShows = entries.filter(e => e.status === 'NO_SHOW');
    const cancelled = entries.filter(e => e.status === 'CANCELLED');

    // Calculate average wait time (from joined to called)
    let totalWaitTime = 0;
    let waitCount = 0;
    served.forEach(entry => {
      if (entry.calledAt && entry.joinedAt) {
        totalWaitTime += (entry.calledAt.getTime() - entry.joinedAt.getTime()) / 60000;
        waitCount++;
      }
    });

    // Calculate average service time (from called to completed)
    let totalServiceTime = 0;
    let serviceCount = 0;
    served.forEach(entry => {
      if (entry.completedAt && entry.calledAt) {
        totalServiceTime += (entry.completedAt.getTime() - entry.calledAt.getTime()) / 60000;
        serviceCount++;
      }
    });

    res.json({
      queueId: id,
      serviceName: queue.service.name,
      date: queue.date,
      totalEntries: entries.length,
      served: served.length,
      noShows: noShows.length,
      cancelled: cancelled.length,
      waiting: entries.filter(e => e.status === 'WAITING').length,
      serving: entries.filter(e => e.status === 'SERVING').length,
      averageWaitTime: waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0,
      averageServiceTime: serviceCount > 0 ? Math.round(totalServiceTime / serviceCount) : 0,
      noShowRate: entries.length > 0 ? ((noShows.length / entries.length) * 100).toFixed(1) : 0,
    });
  } catch (error) {
    next(error);
  }
};

// Service metrics over a date range
export const getServiceMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? getStartOfDay(new Date(startDate as string)) : getStartOfDay(new Date());
    const end = endDate ? getEndOfDay(new Date(endDate as string)) : getEndOfDay(new Date());

    const queues = await prisma.queue.findMany({
      where: {
        serviceId,
        date: { gte: start, lte: end },
      },
      include: {
        entries: true,
      },
    });

    let totalServed = 0;
    let totalNoShows = 0;
    let totalWaitTime = 0;
    let totalServiceTime = 0;
    let waitCount = 0;
    let serviceCount = 0;

    queues.forEach(queue => {
      queue.entries.forEach(entry => {
        if (entry.status === 'SERVED') {
          totalServed++;
          if (entry.calledAt && entry.joinedAt) {
            totalWaitTime += (entry.calledAt.getTime() - entry.joinedAt.getTime()) / 60000;
            waitCount++;
          }
          if (entry.completedAt && entry.calledAt) {
            totalServiceTime += (entry.completedAt.getTime() - entry.calledAt.getTime()) / 60000;
            serviceCount++;
          }
        } else if (entry.status === 'NO_SHOW') {
          totalNoShows++;
        }
      });
    });

    res.json({
      serviceId,
      period: { start, end },
      totalDays: queues.length,
      totalServed,
      totalNoShows,
      averagePerDay: queues.length > 0 ? Math.round(totalServed / queues.length) : 0,
      averageWaitTime: waitCount > 0 ? Math.round(totalWaitTime / waitCount) : 0,
      averageServiceTime: serviceCount > 0 ? Math.round(totalServiceTime / serviceCount) : 0,
      noShowRate: (totalServed + totalNoShows) > 0 
        ? ((totalNoShows / (totalServed + totalNoShows)) * 100).toFixed(1) 
        : 0,
    });
  } catch (error) {
    next(error);
  }
};

// Location daily throughput
export const getLocationMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;
    const { date } = req.query;

    const targetDate = date ? getStartOfDay(new Date(date as string)) : getStartOfDay(new Date());

    const services = await prisma.service.findMany({
      where: { locationId },
      include: {
        queues: {
          where: { date: targetDate },
          include: {
            entries: true,
          },
        },
      },
    });

    const serviceMetrics = services.map(service => {
      const queue = service.queues[0];
      if (!queue) {
        return {
          serviceId: service.id,
          serviceName: service.name,
          total: 0,
          served: 0,
          waiting: 0,
          noShows: 0,
        };
      }

      return {
        serviceId: service.id,
        serviceName: service.name,
        total: queue.entries.length,
        served: queue.entries.filter(e => e.status === 'SERVED').length,
        waiting: queue.entries.filter(e => e.status === 'WAITING').length,
        serving: queue.entries.filter(e => e.status === 'SERVING').length,
        noShows: queue.entries.filter(e => e.status === 'NO_SHOW').length,
      };
    });

    const totals = serviceMetrics.reduce(
      (acc, s) => ({
        total: acc.total + s.total,
        served: acc.served + s.served,
        waiting: acc.waiting + (s.waiting || 0),
      }),
      { total: 0, served: 0, waiting: 0 }
    );

    res.json({
      locationId,
      date: targetDate,
      services: serviceMetrics,
      totals,
    });
  } catch (error) {
    next(error);
  }
};

// Flow analytics - time between services
export const getFlowAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? getStartOfDay(new Date(startDate as string)) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate ? getEndOfDay(new Date(endDate as string)) : new Date();

    // Get service flows for this location
    const services = await prisma.service.findMany({
      where: { locationId },
      include: {
        flowsFrom: {
          include: { toService: true },
        },
      },
    });

    const flows = services.flatMap(s => s.flowsFrom);

    // For each flow, calculate average transition time
    // This would require tracking user journey across queues
    // Simplified: return flow configuration
    res.json({
      locationId,
      period: { start, end },
      flows: flows.map(flow => ({
        fromService: flow.fromServiceId,
        toService: flow.toServiceId,
        toServiceName: flow.toService.name,
        autoTransfer: flow.autoTransfer,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// Peak hours analysis
export const getPeakHoursAnalysis = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const { days } = req.query;

    const daysBack = parseInt(days as string) || 30;
    const startDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

    const entries = await prisma.queueEntry.findMany({
      where: {
        queue: { serviceId },
        joinedAt: { gte: startDate },
        status: { in: ['SERVED', 'NO_SHOW'] },
      },
      select: { joinedAt: true },
    });

    // Group by hour
    const hourCounts: { [key: number]: number } = {};
    for (let i = 0; i < 24; i++) hourCounts[i] = 0;

    entries.forEach(entry => {
      const hour = entry.joinedAt.getHours();
      hourCounts[hour]++;
    });

    // Find peak hours
    const hourlyData = Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count);

    res.json({
      serviceId,
      period: { startDate, endDate: new Date() },
      totalEntries: entries.length,
      hourlyDistribution: hourlyData.sort((a, b) => a.hour - b.hour),
      peakHours: hourlyData.slice(0, 3).map(h => h.hour),
    });
  } catch (error) {
    next(error);
  }
};

// Detailed location analytics with turnaround time and journey metrics
export const getDetailedLocationMetrics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? getStartOfDay(new Date(startDate as string)) : getStartOfDay(new Date());
    const end = endDate ? getEndOfDay(new Date(endDate as string)) : getEndOfDay(new Date());

    // Get all services at this location
    const services = await prisma.service.findMany({
      where: { locationId },
      include: {
        queues: {
          where: { date: { gte: start, lte: end } },
          include: {
            entries: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
    });

    // Calculate detailed metrics per service
    const serviceMetrics = services.map(service => {
      const allEntries = service.queues.flatMap(q => q.entries);
      const served = allEntries.filter(e => e.status === 'SERVED');
      const waiting = allEntries.filter(e => e.status === 'WAITING');
      const serving = allEntries.filter(e => e.status === 'SERVING');
      const noShows = allEntries.filter(e => e.status === 'NO_SHOW');
      const cancelled = allEntries.filter(e => e.status === 'CANCELLED');

      // Calculate wait times
      const waitTimes = served.map(entry => {
        if (entry.calledAt && entry.joinedAt) {
          return (entry.calledAt.getTime() - entry.joinedAt.getTime()) / 60000;
        }
        return null;
      }).filter((t): t is number => t !== null);

      // Calculate service/turnaround times
      const serviceTimes = served.map(entry => {
        if (entry.completedAt && entry.calledAt) {
          return (entry.completedAt.getTime() - entry.calledAt.getTime()) / 60000;
        }
        return null;
      }).filter((t): t is number => t !== null);

      // Total turnaround (join to complete)
      const turnaroundTimes = served.map(entry => {
        if (entry.completedAt && entry.joinedAt) {
          return (entry.completedAt.getTime() - entry.joinedAt.getTime()) / 60000;
        }
        return null;
      }).filter((t): t is number => t !== null);

      const avgWait = waitTimes.length > 0 ? Math.round(waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length) : 0;
      const maxWait = waitTimes.length > 0 ? Math.round(Math.max(...waitTimes)) : 0;
      const minWait = waitTimes.length > 0 ? Math.round(Math.min(...waitTimes)) : 0;
      
      const avgService = serviceTimes.length > 0 ? Math.round(serviceTimes.reduce((a, b) => a + b, 0) / serviceTimes.length) : 0;
      const avgTurnaround = turnaroundTimes.length > 0 ? Math.round(turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length) : 0;

      return {
        serviceId: service.id,
        serviceName: service.name,
        counts: {
          total: allEntries.length,
          served: served.length,
          waiting: waiting.length,
          serving: serving.length,
          noShows: noShows.length,
          cancelled: cancelled.length,
        },
        waitTime: {
          average: avgWait,
          longest: maxWait,
          shortest: minWait,
        },
        serviceTime: {
          average: avgService,
        },
        turnaroundTime: {
          average: avgTurnaround,
        },
        completionRate: allEntries.length > 0 ? Math.round((served.length / allEntries.length) * 100) : 0,
        noShowRate: allEntries.length > 0 ? Math.round((noShows.length / allEntries.length) * 100) : 0,
      };
    });

    // Calculate location-wide totals
    const totals = serviceMetrics.reduce((acc, s) => ({
      total: acc.total + s.counts.total,
      served: acc.served + s.counts.served,
      waiting: acc.waiting + s.counts.waiting,
      serving: acc.serving + s.counts.serving,
      noShows: acc.noShows + s.counts.noShows,
    }), { total: 0, served: 0, waiting: 0, serving: 0, noShows: 0 });

    // Get longest wait currently
    const allCurrentWaiting = services.flatMap(s => 
      s.queues.flatMap(q => 
        q.entries.filter(e => e.status === 'WAITING')
      )
    );
    const longestCurrentWait = allCurrentWaiting.length > 0 
      ? Math.round(Math.max(...allCurrentWaiting.map(e => (Date.now() - e.joinedAt.getTime()) / 60000)))
      : 0;

    res.json({
      locationId,
      period: { start, end },
      services: serviceMetrics,
      totals,
      longestCurrentWait,
    });
  } catch (error) {
    next(error);
  }
};

// Journey analytics - track patient movement across services
export const getJourneyAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { locationId } = req.params;
    const { startDate, endDate } = req.query;

    const start = startDate ? getStartOfDay(new Date(startDate as string)) : getStartOfDay(new Date());
    const end = endDate ? getEndOfDay(new Date(endDate as string)) : getEndOfDay(new Date());

    // Get customer journeys for this location
    const journeys = await prisma.customerJourney.findMany({
      where: {
        startedAt: { gte: start, lte: end },
        user: {
          queueEntries: {
            some: {
              queue: {
                service: { locationId },
              },
            },
          },
        },
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Get entries that have previousEntryId (transfers between services)
    const transferredEntries = await prisma.queueEntry.findMany({
      where: {
        previousEntryId: { not: null },
        queue: {
          service: { locationId },
          date: { gte: start, lte: end },
        },
      },
      include: {
        queue: {
          include: { service: { select: { id: true, name: true } } },
        },
        user: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Calculate journey statistics
    const completedJourneys = journeys.filter(j => j.completedAt);
    const journeyDurations = completedJourneys
      .map(j => j.totalDuration)
      .filter((d): d is number => d !== null);

    const avgJourneyDuration = journeyDurations.length > 0 
      ? Math.round(journeyDurations.reduce((a, b) => a + b, 0) / journeyDurations.length)
      : 0;
    const maxJourneyDuration = journeyDurations.length > 0 
      ? Math.round(Math.max(...journeyDurations))
      : 0;

    // Count multi-service visits
    const multiServiceJourneys = journeys.filter(j => (j.queueEntryIds?.length || 0) > 1);

    // Get individual journey details (limited to recent 50)
    const journeyDetails = journeys.slice(0, 50).map(j => ({
      id: j.id,
      userId: j.userId,
      userName: `${j.user.firstName} ${j.user.lastName}`,
      startedAt: j.startedAt,
      completedAt: j.completedAt,
      totalDuration: j.totalDuration,
      serviceCount: j.queueEntryIds?.length || 0,
      status: j.completedAt ? 'completed' : 'in-progress',
    }));

    res.json({
      locationId,
      period: { start, end },
      summary: {
        totalJourneys: journeys.length,
        completedJourneys: completedJourneys.length,
        inProgressJourneys: journeys.length - completedJourneys.length,
        multiServiceJourneys: multiServiceJourneys.length,
        avgJourneyDuration,
        maxJourneyDuration,
        totalTransfers: transferredEntries.length,
      },
      journeys: journeyDetails,
    });
  } catch (error) {
    next(error);
  }
};
