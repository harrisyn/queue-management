import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export interface AuditContext {
  action: string;
  resource: string;
  resourceId?: string;
  details?: Record<string, unknown>;
}

/**
 * Factory that returns an Express middleware which records an audit log entry
 * after the response has been sent (non-blocking).
 */
export const auditLog = (context: AuditContext) => {
  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      // Only log successful mutations (2xx responses)
      if (res.statusCode < 200 || res.statusCode >= 300) return;

      const userId = req.user?.userId;
      const resourceId =
        context.resourceId ||
        (req.params as Record<string, string>).id ||
        (req.params as Record<string, string>).entryId ||
        (req.params as Record<string, string>).queueId ||
        undefined;

      const ipAddress =
        (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
        req.socket.remoteAddress ||
        undefined;

      prisma.auditLog
        .create({
          data: {
            userId,
            action: context.action,
            resource: context.resource,
            resourceId,
            details: context.details ? JSON.stringify(context.details) : undefined,
            ipAddress,
          },
        })
        .catch((err: Error) => {
          // Audit failures must never affect the response
          console.error('Audit log write failed:', err.message);
        });
    });

    next();
  };
};
