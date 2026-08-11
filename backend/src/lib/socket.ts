import { Server } from 'socket.io';

let io: Server;

export const setSocketIO = (socketIO: Server) => {
  io = socketIO;
};

export const getSocketIO = (): Server => {
  if (!io) {
    throw new Error('Socket.io not initialized');
  }
  return io;
};

export const SOCKET_EVENTS = {
  QUEUE_UPDATED: 'queue.updated',
  ENTRY_STATUS_CHANGED: 'entry.status_changed',
  SLOT_RELEASED: 'slot.released',
  SERVICEFLOW_TRANSITION: 'serviceflow.transition',
  NOTIFICATION_SENT: 'notification.sent',
  LOCATION_UPDATED: 'location.updated',
} as const;

export const emitToQueue = (queueId: string, event: string, data: any) => {
  io?.to(`queue:${queueId}`).emit(event, data);
};

export const emitToUser = (userId: string, event: string, data: any) => {
  io?.to(`user:${userId}`).emit(event, data);
};

export const emitToService = (serviceId: string, event: string, data: any) => {
  io?.to(`service:${serviceId}`).emit(event, data);
};

export const emitToLocation = (locationId: string, event: string, data: any) => {
  io?.to(`location:${locationId}`).emit(event, data);
};

// Emit to both queue and location rooms for broader real-time updates
export const emitToQueueAndLocation = (queueId: string, locationId: string | null, event: string, data: any) => {
  io?.to(`queue:${queueId}`).emit(event, data);
  if (locationId) {
    io?.to(`location:${locationId}`).emit(event, { ...data, locationId });
  }
};
