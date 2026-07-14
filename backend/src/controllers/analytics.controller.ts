import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { getStartOfDay, getEndOfDay } from '../utils/date';

// Dashboard summary — aggregated stats for the authenticated user's scope
export const getDashboardSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    const role = req.user?.role;

    const user = userId
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { organizationId: true },
        })
      : null;

    const organizationId = user?.organizationId;

    const todayStart = getStartOfDay();
    const todayEnd = getEndOfDay();

    // Build location filter based on role/org scope
    const locationWhere = organizationId ? { organizationId } : {};
    const serviceWhere = organizationId
      ? { location: { organizationId } }
      : {};

    const [totalServices, totalQueues, activeQueues, todayTickets, recentEntries] =
      await Promise.all([
        prisma.service.count({ where: { ...serviceWhere, isActive: true } }),
        prisma.queue.count({
          where: {
            date: { gte: todayStart, lte: todayEnd },
            ...(organizationId ? { service: { location: { organizationId } } } : {}),
          },
        }),
        prisma.queue.count({
          where: {
            status: 'ACTIVE',
            date: { gte: todayStart, lte: todayEnd },
            ...(organizationId ? { service: { location: { organizationId } } } : {}),
          },
        }),
        prisma.queueEntry.count({
          where: {
            joinedAt: { gte: todayStart, lte: todayEnd },
            ...(organizationId ? { queue: { service: { location: { organizationId } } } } : {}),
          },
        }),
        // Recent activity: last 10 queue entries with user & service info
        prisma.queueEntry.findMany({
          where: {
            ...(organizationId ? { queue: { service: { location: { organizationId } } } } : {}),
          },
          orderBy: { joinedAt: 'desc' },
          take: 10,
          select: {
            id: true,
            ticketNumber: true,
            status: true,
            joinedAt: true,
            user: { select: { firstName: true, lastName: true } },
            queue: { select: { service: { select: { name: true } } } },
          },
        }),
      ]);

    const recentActivity = recentEntries.map((entry) => ({
      id: entry.id,
      ticketNumber: entry.ticketNumber,
      status: entry.status,
      joinedAt: entry.joinedAt,
      userName: entry.user
        ? `${entry.user.firstName} ${entry.user.lastName}`
        : 'Anonymous',
      serviceName: entry.queue.service.name,
    }));

    res.json({
      totalServices,
      totalQueues,
      activeQueues,
      todayTickets,
      recentActivity,
    });
  } catch (error) {
    next(error);
  }
};

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
