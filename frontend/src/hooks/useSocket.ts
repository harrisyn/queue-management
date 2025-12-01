'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8004';

export const useSocket = () => {
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket'],
      autoConnect: true,
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const joinQueue = useCallback((queueId: string) => {
    socketRef.current?.emit('join:queue', queueId);
  }, []);

  const leaveQueue = useCallback((queueId: string) => {
    socketRef.current?.emit('leave:queue', queueId);
  }, []);

  const joinUser = useCallback((userId: string) => {
    socketRef.current?.emit('join:user', userId);
  }, []);

  const joinService = useCallback((serviceId: string) => {
    socketRef.current?.emit('join:service', serviceId);
  }, []);

  const joinLocation = useCallback((locationId: string) => {
    socketRef.current?.emit('join:location', locationId);
  }, []);

  const onQueueUpdated = useCallback((callback: (data: { queueId: string; action: string }) => void) => {
    socketRef.current?.on('queue.updated', callback);
    return () => { socketRef.current?.off('queue.updated', callback); };
  }, []);

  const onEntryStatusChanged = useCallback((callback: (data: { queueId: string; entryId: string; status: string }) => void) => {
    socketRef.current?.on('entry.status_changed', callback);
    return () => { socketRef.current?.off('entry.status_changed', callback); };
  }, []);

  const onNotification = useCallback((callback: (data: { message: string }) => void) => {
    socketRef.current?.on('notification.sent', callback);
    return () => { socketRef.current?.off('notification.sent', callback); };
  }, []);

  const onServiceFlowTransition = useCallback((callback: (data: unknown) => void) => {
    socketRef.current?.on('serviceflow.transition', callback);
    return () => { socketRef.current?.off('serviceflow.transition', callback); };
  }, []);

  return {
    socket: socketRef.current,
    joinQueue,
    leaveQueue,
    joinUser,
    joinService,
    joinLocation,
    onQueueUpdated,
    onEntryStatusChanged,
    onNotification,
    onServiceFlowTransition,
  };
};

export default useSocket;
