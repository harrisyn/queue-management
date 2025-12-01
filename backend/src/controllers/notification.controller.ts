import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { emitToUser, SOCKET_EVENTS } from '../lib/socket';

export const sendNotification = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId, type, channel, message } = req.body;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        channel,
        message,
      },
    });

    // Emit real-time notification
    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_SENT, notification);

    // TODO: Integrate with actual notification services (email, SMS, push)
    // For now, just store and emit

    res.status(201).json(notification);
  } catch (error) {
    next(error);
  }
};

export const getUserNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;
    const { unreadOnly } = req.query;

    const whereClause: any = { userId };
    if (unreadOnly === 'true') {
      whereClause.readAt = null;
    }

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { sentAt: 'desc' },
      take: 50,
    });

    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

export const markNotificationRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });

    res.json(notification);
  } catch (error) {
    next(error);
  }
};

export const markAllRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    await prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    next(error);
  }
};

// Queue position notification helper
export const notifyQueuePosition = async (userId: string, queueId: string, position: number) => {
  if (position <= 3) {
    const message = position === 1 
      ? 'You are next! Please be ready.'
      : `Your turn is approaching. You are #${position} in queue.`;

    const notification = await prisma.notification.create({
      data: {
        userId,
        type: 'TURN_APPROACHING',
        channel: 'IN_APP',
        message,
      },
    });

    emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_SENT, notification);
  }
};

// Now serving notification
export const notifyNowServing = async (userId: string, serviceName: string, ticketNumber: string) => {
  const message = `Now serving ${ticketNumber} at ${serviceName}. Please proceed.`;

  const notification = await prisma.notification.create({
    data: {
      userId,
      type: 'NOW_SERVING',
      channel: 'IN_APP',
      message,
    },
  });

  emitToUser(userId, SOCKET_EVENTS.NOTIFICATION_SENT, notification);
};
