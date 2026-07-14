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
 * Logs all responses for auth-sensitive operations (including failures),
 * and only successful (2xx) responses for general resource mutations.
 *
 * Note: the `details` column in AuditLog is stored as a JSON-encoded string.
 * Consumers querying this column must parse it with JSON.parse().
 */
export const auditLog = (context: AuditContext, options: { logFailures?: boolean } = {}) => {
  const logFailures = options.logFailures ?? false;

  return (req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      const isSuccess = res.statusCode >= 200 && res.statusCode < 300;
      // Skip non-2xx unless this middleware is configured to log failures
      if (!isSuccess && !logFailures) return;

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

      const details = {
        ...context.details,
        ...(isSuccess ? {} : { failed: true, statusCode: res.statusCode }),
      };

      prisma.auditLog
        .create({
          data: {
            userId,
            action: context.action,
            resource: context.resource,
            resourceId,
            details: Object.keys(details).length > 0 ? JSON.stringify(details) : undefined,
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
