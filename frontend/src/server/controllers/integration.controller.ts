import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { encrypt } from '../lib/encryption';
import { assertPublicUrl } from '../lib/urlSafety';
import { WEBHOOK_EVENTS, attemptDelivery } from '../services/webhooks.service';

// Outbound webhooks (EMR integration) and the org audit log.

const newSecret = () => `whsec_${crypto.randomBytes(24).toString('hex')}`;

const publicEndpoint = (e: {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  id: e.id,
  url: e.url,
  description: e.description,
  events: e.events,
  isActive: e.isActive,
  createdAt: e.createdAt,
  updatedAt: e.updatedAt,
});

function validateEvents(events: unknown): string[] {
  if (events === undefined) return [];
  if (!Array.isArray(events) || events.some((e) => !(WEBHOOK_EVENTS as readonly string[]).includes(e))) {
    throw Object.assign(new Error(`events must be a subset of: ${WEBHOOK_EVENTS.join(', ')}`), { status: 400 });
  }
  return events;
}

export const listWebhookEvents = (_req: Request, res: Response) => {
  res.json(WEBHOOK_EVENTS);
};

export const listWebhooks = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { organizationId: req.params.organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        deliveries: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { status: true, responseCode: true, createdAt: true },
        },
      },
    });
    res.json(endpoints.map((e) => ({ ...publicEndpoint(e), lastDelivery: e.deliveries[0] ?? null })));
  } catch (error) {
    next(error);
  }
};

export const createWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, description, events } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    await assertPublicUrl(url);
    const secret = newSecret();
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        organizationId: req.params.organizationId,
        url,
        description: description || null,
        events: validateEvents(events),
        encryptedSecret: encrypt(secret),
      },
    });
    // The signing secret is only ever shown once, here.
    res.status(201).json({ ...publicEndpoint(endpoint), secret });
  } catch (error) {
    next(error);
  }
};

export const updateWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { url, description, events, isActive } = req.body;
    const data: Record<string, unknown> = {};
    if (url !== undefined) {
      await assertPublicUrl(url);
      data.url = url;
    }
    if (description !== undefined) data.description = description || null;
    if (events !== undefined) data.events = validateEvents(events);
    if (isActive !== undefined) data.isActive = Boolean(isActive);
    const endpoint = await prisma.webhookEndpoint.update({ where: { id: req.params.id }, data });
    res.json(publicEndpoint(endpoint));
  } catch (error) {
    next(error);
  }
};

export const rotateWebhookSecret = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const secret = newSecret();
    const endpoint = await prisma.webhookEndpoint.update({
      where: { id: req.params.id },
      data: { encryptedSecret: encrypt(secret) },
    });
    res.json({ ...publicEndpoint(endpoint), secret });
  } catch (error) {
    next(error);
  }
};

export const deleteWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await prisma.webhookEndpoint.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const testWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const delivery = await prisma.webhookDelivery.create({
      data: {
        endpointId: req.params.id,
        event: 'ping',
        payload: { event: 'ping', createdAt: new Date().toISOString(), data: { message: 'Test delivery' } },
      },
    });
    const status = await attemptDelivery(delivery.id);
    const result = await prisma.webhookDelivery.findUnique({ where: { id: delivery.id } });
    res.json({ status, responseCode: result?.responseCode ?? null, error: result?.lastError ?? null });
  } catch (error) {
    next(error);
  }
};

export const listWebhookDeliveries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const deliveries = await prisma.webhookDelivery.findMany({
      where: { endpointId: req.params.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        event: true,
        status: true,
        attempts: true,
        responseCode: true,
        lastError: true,
        createdAt: true,
        nextAttemptAt: true,
      },
    });
    res.json(deliveries);
  } catch (error) {
    next(error);
  }
};

export const listAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { organizationId } = req.params;
    const { action, entryId, before, limit } = req.query;
    const take = Math.min(Number(limit) || 50, 200);

    const logs = await prisma.auditLog.findMany({
      where: {
        organizationId,
        ...(action ? { action: { startsWith: String(action) } } : {}),
        ...(entryId ? { entryId: String(entryId) } : {}),
        ...(before ? { createdAt: { lt: new Date(String(before)) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    const actorIds = [...new Set(logs.map((l) => l.actorUserId).filter(Boolean))] as string[];
    const entryIds = [...new Set(logs.map((l) => l.entryId).filter(Boolean))] as string[];
    const [actors, entries] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, firstName: true, lastName: true, role: true },
      }),
      prisma.queueEntry.findMany({
        where: { id: { in: entryIds } },
        select: { id: true, ticketNumber: true, queue: { select: { service: { select: { name: true } } } } },
      }),
    ]);
    const actorById = new Map(actors.map((a) => [a.id, a]));
    const entryById = new Map(entries.map((e) => [e.id, e]));

    res.json({
      logs: logs.map((l) => {
        const entry = l.entryId ? entryById.get(l.entryId) : undefined;
        return {
          ...l,
          actor: l.actorUserId ? actorById.get(l.actorUserId) ?? null : null,
          entry: entry ? { ticketNumber: entry.ticketNumber, serviceName: entry.queue.service.name } : null,
        };
      }),
      nextCursor: logs.length === take ? logs[logs.length - 1].createdAt.toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
};
