import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { emitToQueue, emitToService, SOCKET_EVENTS } from '../lib/socket';
import { generateTicketNumber, getNextSequence, generateQRData } from '../utils/ticket';
import { getStartOfDay, generateTimeSlots } from '../utils/date';

// Create or get queue for a service on a specific date
export const createQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId, date } = req.body;
    const queueDate = date ? new Date(date) : getStartOfDay();

    // Check if queue already exists for this service and date
    let queue = await prisma.queue.findFirst({
      where: {
        serviceId,
        date: queueDate,
      },
    });

    if (queue) {
      return res.json(queue);
    }

    // Get service to generate slots
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }

    // Create queue with slots
    const slots = generateTimeSlots(
      service.startTime,
      service.endTime,
      service.slotDuration,
      queueDate
    );

    queue = await prisma.queue.create({
      data: {
        serviceId,
        date: queueDate,
        slots: {
          create: slots.map(slot => ({
            startTime: slot.startTime,
            endTime: slot.endTime,
            capacity: service.concurrentLimit,
          })),
        },
      },
      include: { slots: true },
    });

    res.status(201).json(queue);
  } catch (error) {
    next(error);
  }
};

// Get queue status with entries
export const getQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        service: {
          include: { location: true },
        },
        slots: {
          orderBy: { startTime: 'asc' },
        },
        entries: {
          where: { status: { not: 'CANCELLED' } },
          orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }],
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, phone: true },
            },
          },
        },
      },
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    // Calculate queue stats
    const waiting = queue.entries.filter(e => e.status === 'WAITING').length;
    const serving = queue.entries.filter(e => e.status === 'SERVING').length;
    const served = queue.entries.filter(e => e.status === 'SERVED').length;

    res.json({
      ...queue,
      stats: { waiting, serving, served, total: queue.entries.length },
    });
  } catch (error) {
    next(error);
  }
};

// Get queues for a service
export const getServiceQueues = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const { date } = req.query;

    const whereClause: any = { serviceId };
    if (date) {
      whereClause.date = new Date(date as string);
    }

    const queues = await prisma.queue.findMany({
      where: whereClause,
      include: {
        _count: { select: { entries: true, slots: true } },
      },
      orderBy: { date: 'desc' },
    });

    res.json(queues);
  } catch (error) {
    next(error);
  }
};

// Join queue - add user to queue
export const joinQueue = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { userId, priority, notes } = req.body;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: { service: true },
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    if (queue.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Queue is not active' });
    }

    // Check if user is already in this queue
    const existingEntry = await prisma.queueEntry.findFirst({
      where: {
        queueId: id,
        userId,
        status: { in: ['WAITING', 'SERVING'] },
      },
    });

    if (existingEntry) {
      return res.status(400).json({ error: 'User already in queue', entry: existingEntry });
    }

    // Generate ticket number
    const sequence = await getNextSequence(prisma, id);
    const servicePrefix = queue.service.name.charAt(0).toUpperCase();
    const ticketNumber = generateTicketNumber(servicePrefix, sequence);

    // Create queue entry
    const entry = await prisma.queueEntry.create({
      data: {
        queueId: id,
        userId,
        ticketNumber,
        priority: priority || 0,
        notes,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        queue: {
          include: { service: true },
        },
      },
    });

    // Calculate position
    const position = await prisma.queueEntry.count({
      where: {
        queueId: id,
        status: 'WAITING',
        OR: [
          { priority: { gt: entry.priority } },
          { priority: entry.priority, joinedAt: { lt: entry.joinedAt } },
        ],
      },
    });

    // Emit real-time update
    emitToQueue(id, SOCKET_EVENTS.QUEUE_UPDATED, {
      queueId: id,
      action: 'joined',
      entry: { ...entry, position: position + 1 },
    });

    res.status(201).json({
      ...entry,
      position: position + 1,
      qrData: generateQRData(entry),
    });
  } catch (error) {
    next(error);
  }
};

// Call next in queue (mark as serving)
export const callNext = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // Find next waiting entry
    const nextEntry = await prisma.queueEntry.findFirst({
      where: {
        queueId: id,
        status: 'WAITING',
      },
      orderBy: [{ priority: 'desc' }, { joinedAt: 'asc' }],
    });

    if (!nextEntry) {
      return res.status(404).json({ error: 'No waiting entries in queue' });
    }

    // Update status to serving
    const entry = await prisma.queueEntry.update({
      where: { id: nextEntry.id },
      data: {
        status: 'SERVING',
        calledAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
      },
    });

    // Emit real-time update
    emitToQueue(id, SOCKET_EVENTS.ENTRY_STATUS_CHANGED, {
      queueId: id,
      entryId: entry.id,
      status: 'SERVING',
      entry,
    });

    res.json(entry);
  } catch (error) {
    next(error);
  }
};

// Mark entry as served
export const markServed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, entryId } = req.params;

    const entry = await prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'SERVED',
        servedAt: new Date(),
        completedAt: new Date(),
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
        queue: {
          include: { service: true },
        },
      },
    });

    // Emit real-time update
    emitToQueue(id, SOCKET_EVENTS.ENTRY_STATUS_CHANGED, {
      queueId: id,
      entryId: entry.id,
      status: 'SERVED',
      entry,
    });

    // Check for auto-transfer to next service
    const serviceFlow = await prisma.serviceFlow.findFirst({
      where: {
        fromServiceId: entry.queue.serviceId,
        autoTransfer: true,
      },
      include: { toService: true },
    });

    if (serviceFlow) {
      // Get or create queue for next service
      const today = getStartOfDay();
      let nextQueue = await prisma.queue.findFirst({
        where: {
          serviceId: serviceFlow.toServiceId,
          date: today,
        },
      });

      if (nextQueue && nextQueue.status === 'ACTIVE') {
        // Auto-add to next queue
        const sequence = await getNextSequence(prisma, nextQueue.id);
        const servicePrefix = serviceFlow.toService.name.charAt(0).toUpperCase();
        const ticketNumber = generateTicketNumber(servicePrefix, sequence);

        const newEntry = await prisma.queueEntry.create({
          data: {
            queueId: nextQueue.id,
            userId: entry.userId,
            ticketNumber,
            notes: `Transferred from ${entry.queue.service.name}`,
          },
        });

        emitToQueue(nextQueue.id, SOCKET_EVENTS.SERVICEFLOW_TRANSITION, {
          fromQueueId: id,
          toQueueId: nextQueue.id,
          entry: newEntry,
        });
      }
    }

    res.json(entry);
  } catch (error) {
    next(error);
  }
};

// Cancel queue entry
export const cancelEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, entryId } = req.params;

    const entry = await prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'CANCELLED',
        completedAt: new Date(),
      },
    });

    emitToQueue(id, SOCKET_EVENTS.ENTRY_STATUS_CHANGED, {
      queueId: id,
      entryId: entry.id,
      status: 'CANCELLED',
    });

    res.json(entry);
  } catch (error) {
    next(error);
  }
};

// Mark as no-show
export const markNoShow = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, entryId } = req.params;

    const entry = await prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'NO_SHOW',
        completedAt: new Date(),
      },
    });

    emitToQueue(id, SOCKET_EVENTS.ENTRY_STATUS_CHANGED, {
      queueId: id,
      entryId: entry.id,
      status: 'NO_SHOW',
    });

    res.json(entry);
  } catch (error) {
    next(error);
  }
};

// Move entry to different queue (manual transfer)
export const moveEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { entryId, targetQueueId, priority } = req.body;

    // Get original entry
    const originalEntry = await prisma.queueEntry.findUnique({
      where: { id: entryId },
      include: { queue: { include: { service: true } } },
    });

    if (!originalEntry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Get target queue
    const targetQueue = await prisma.queue.findUnique({
      where: { id: targetQueueId },
      include: { service: true },
    });

    if (!targetQueue) {
      return res.status(404).json({ error: 'Target queue not found' });
    }

    // Mark original as served with transfer note
    await prisma.queueEntry.update({
      where: { id: entryId },
      data: {
        status: 'SERVED',
        completedAt: new Date(),
        notes: `Transferred to ${targetQueue.service.name}`,
      },
    });

    // Create new entry in target queue
    const sequence = await getNextSequence(prisma, targetQueueId);
    const servicePrefix = targetQueue.service.name.charAt(0).toUpperCase();
    const ticketNumber = generateTicketNumber(servicePrefix, sequence);

    const newEntry = await prisma.queueEntry.create({
      data: {
        queueId: targetQueueId,
        userId: originalEntry.userId,
        ticketNumber,
        priority: priority || originalEntry.priority,
        notes: `Transferred from ${originalEntry.queue.service.name}`,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    // Emit events
    emitToQueue(id, SOCKET_EVENTS.ENTRY_STATUS_CHANGED, {
      queueId: id,
      entryId,
      status: 'SERVED',
      action: 'transferred',
    });

    emitToQueue(targetQueueId, SOCKET_EVENTS.SERVICEFLOW_TRANSITION, {
      fromQueueId: id,
      toQueueId: targetQueueId,
      entry: newEntry,
    });

    res.json(newEntry);
  } catch (error) {
    next(error);
  }
};

// Get wait time estimate
export const getWaitTime = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const queue = await prisma.queue.findUnique({
      where: { id },
      include: {
        service: true,
        entries: {
          where: { status: { in: ['WAITING', 'SERVING'] } },
        },
      },
    });

    if (!queue) {
      return res.status(404).json({ error: 'Queue not found' });
    }

    const waiting = queue.entries.filter(e => e.status === 'WAITING').length;
    const slotDuration = queue.service.slotDuration;
    const concurrentLimit = queue.service.concurrentLimit;

    // Estimate wait time based on queue length and service capacity
    const estimatedMinutes = Math.ceil((waiting * slotDuration) / concurrentLimit);

    res.json({
      queueId: id,
      waitingCount: waiting,
      estimatedWaitMinutes: estimatedMinutes,
      slotDuration,
      concurrentLimit,
    });
  } catch (error) {
    next(error);
  }
};

// Update queue status (pause, resume, close)
export const updateQueueStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const queue = await prisma.queue.update({
      where: { id },
      data: { status },
    });

    emitToQueue(id, SOCKET_EVENTS.QUEUE_UPDATED, {
      queueId: id,
      action: 'status_changed',
      status,
    });

    res.json(queue);
  } catch (error) {
    next(error);
  }
};

// Generate ticket with QR code
export const generateTicket = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, entryId } = req.params;

    const entry = await prisma.queueEntry.findUnique({
      where: { id: entryId },
      include: {
        queue: {
          include: {
            service: {
              include: { location: true },
            },
          },
        },
        user: {
          select: { firstName: true, lastName: true },
        },
      },
    });

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    // Calculate position
    const position = await prisma.queueEntry.count({
      where: {
        queueId: id,
        status: 'WAITING',
        OR: [
          { priority: { gt: entry.priority } },
          { priority: entry.priority, joinedAt: { lt: entry.joinedAt } },
        ],
      },
    });

    res.json({
      ticketNumber: entry.ticketNumber,
      position: entry.status === 'WAITING' ? position + 1 : null,
      status: entry.status,
      serviceName: entry.queue.service.name,
      locationName: entry.queue.service.location.name,
      queueDate: entry.queue.date,
      joinedAt: entry.joinedAt,
      qrData: generateQRData(entry),
      userName: `${entry.user.firstName} ${entry.user.lastName}`,
    });
  } catch (error) {
    next(error);
  }
};
