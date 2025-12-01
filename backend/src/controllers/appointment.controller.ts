import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { emitToQueue, emitToUser, SOCKET_EVENTS } from '../lib/socket';
import { getStartOfDay } from '../utils/date';

export const createAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, serviceId, slotId, notes } = req.body;
    const createdBy = req.user?.userId || userId;

    // Verify slot exists and has capacity
    const slot = await prisma.slot.findUnique({
      where: { id: slotId },
      include: { queue: true },
    });

    if (!slot) {
      return res.status(404).json({ error: 'Slot not found' });
    }

    if (slot.bookedCount >= slot.capacity) {
      return res.status(400).json({ error: 'Slot is fully booked' });
    }

    // Check for existing appointment
    const existing = await prisma.appointment.findFirst({
      where: {
        userId,
        slotId,
        status: { not: 'CANCELLED' },
      },
    });

    if (existing) {
      return res.status(400).json({ error: 'User already has appointment for this slot' });
    }

    // Create appointment and update slot count
    const [appointment] = await prisma.$transaction([
      prisma.appointment.create({
        data: {
          userId,
          serviceId,
          slotId,
          createdBy,
          notes,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          service: true,
          slot: true,
        },
      }),
      prisma.slot.update({
        where: { id: slotId },
        data: { bookedCount: { increment: 1 } },
      }),
    ]);

    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
};

export const getAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, serviceId, date, status } = req.query;
    
    const whereClause: any = {};
    
    if (userId) whereClause.userId = userId as string;
    if (serviceId) whereClause.serviceId = serviceId as string;
    if (status) whereClause.status = status as string;
    if (date) {
      const start = getStartOfDay(new Date(date as string));
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      whereClause.slot = {
        startTime: { gte: start, lt: end },
      };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        service: { include: { location: true } },
        slot: true,
      },
      orderBy: { slot: { startTime: 'asc' } },
    });

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const getAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        service: { include: { location: true } },
        slot: { include: { queue: true } },
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    res.json(appointment);
  } catch (error) {
    next(error);
  }
};

export const getUserAppointments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { upcoming } = req.query;

    const whereClause: any = { userId };

    if (upcoming === 'true') {
      whereClause.slot = {
        startTime: { gte: new Date() },
      };
      whereClause.status = { not: 'CANCELLED' };
    }

    const appointments = await prisma.appointment.findMany({
      where: whereClause,
      include: {
        service: { include: { location: true } },
        slot: true,
      },
      orderBy: { slot: { startTime: 'asc' } },
    });

    res.json(appointments);
  } catch (error) {
    next(error);
  }
};

export const rescheduleAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { newSlotId } = req.body;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify new slot
    const newSlot = await prisma.slot.findUnique({
      where: { id: newSlotId },
    });

    if (!newSlot) {
      return res.status(404).json({ error: 'New slot not found' });
    }

    if (newSlot.bookedCount >= newSlot.capacity) {
      return res.status(400).json({ error: 'New slot is fully booked' });
    }

    // Update appointment and slots
    const [updated] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: {
          slotId: newSlotId,
          rescheduledAt: new Date(),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
          service: true,
          slot: true,
        },
      }),
      // Decrement old slot
      prisma.slot.update({
        where: { id: appointment.slotId },
        data: { bookedCount: { decrement: 1 } },
      }),
      // Increment new slot
      prisma.slot.update({
        where: { id: newSlotId },
        data: { bookedCount: { increment: 1 } },
      }),
    ]);

    // Release old slot event
    emitToQueue(appointment.slot.queueId, SOCKET_EVENTS.SLOT_RELEASED, {
      slotId: appointment.slotId,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

export const cancelAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: { slot: true },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Update appointment and decrement slot
    const [updated] = await prisma.$transaction([
      prisma.appointment.update({
        where: { id },
        data: { status: 'CANCELLED' },
      }),
      prisma.slot.update({
        where: { id: appointment.slotId },
        data: { bookedCount: { decrement: 1 } },
      }),
    ]);

    // Emit slot released
    emitToQueue(appointment.slot.queueId, SOCKET_EVENTS.SLOT_RELEASED, {
      slotId: appointment.slotId,
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
};

// Check-in: Convert appointment to queue entry
export const checkInAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const appointment = await prisma.appointment.findUnique({
      where: { id },
      include: {
        slot: { include: { queue: { include: { service: true } } } },
        user: true,
      },
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.status !== 'SCHEDULED' && appointment.status !== 'CONFIRMED') {
      return res.status(400).json({ error: 'Cannot check in this appointment' });
    }

    const queue = appointment.slot.queue;
    const service = queue.service;

    // Generate ticket
    const lastEntry = await prisma.queueEntry.findFirst({
      where: { queueId: queue.id },
      orderBy: { createdAt: 'desc' },
    });

    let sequence = 1;
    if (lastEntry) {
      const match = lastEntry.ticketNumber.match(/\d+$/);
      sequence = match ? parseInt(match[0], 10) + 1 : 1;
    }

    const ticketNumber = `${service.name.charAt(0).toUpperCase()}${sequence.toString().padStart(3, '0')}`;

    // Create queue entry and update appointment
    const [entry] = await prisma.$transaction([
      prisma.queueEntry.create({
        data: {
          queueId: queue.id,
          userId: appointment.userId,
          ticketNumber,
          priority: 1, // Appointments get priority
          notes: `Appointment check-in`,
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.appointment.update({
        where: { id },
        data: { status: 'COMPLETED' },
      }),
    ]);

    // Emit queue update
    emitToQueue(queue.id, SOCKET_EVENTS.QUEUE_UPDATED, {
      queueId: queue.id,
      action: 'appointment_checkin',
      entry,
    });

    res.json({
      entry,
      ticketNumber,
      serviceName: service.name,
    });
  } catch (error) {
    next(error);
  }
};

// Get available slots for a service on a date
export const getAvailableSlots = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { serviceId } = req.params;
    const { date } = req.query;

    const targetDate = date ? new Date(date as string) : new Date();
    const startOfDay = getStartOfDay(targetDate);

    // Find queue for this service and date
    const queue = await prisma.queue.findFirst({
      where: {
        serviceId,
        date: startOfDay,
      },
      include: {
        slots: {
          where: {
            startTime: { gte: new Date() }, // Only future slots
          },
          orderBy: { startTime: 'asc' },
        },
      },
    });

    if (!queue) {
      return res.json({ slots: [], message: 'No queue available for this date' });
    }

    // Filter to available slots
    const availableSlots = queue.slots.filter(slot => slot.bookedCount < slot.capacity);

    res.json({
      queueId: queue.id,
      date: startOfDay,
      slots: availableSlots.map(slot => ({
        id: slot.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        available: slot.capacity - slot.bookedCount,
        capacity: slot.capacity,
      })),
    });
  } catch (error) {
    next(error);
  }
};
