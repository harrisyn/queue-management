import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';

export const createInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role, organizationId, expiresAt } = req.body;

    const code = crypto.randomBytes(6).toString('hex');
    const createdBy = (req as any).user?.userId || null;

    const invite = await prisma.invite.create({
      data: {
        code,
        role: role || 'SERVICE_STAFF',
        organizationId: organizationId || null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        createdBy,
      },
    });

    res.status(201).json({ invite });
  } catch (error) {
    next(error);
  }
};

export const getInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const invite = await prisma.invite.findUnique({ where: { code } });
    if (!invite) return res.status(404).json({ error: 'Invite not found' });
    res.json({ invite });
  } catch (error) {
    next(error);
  }
};

export const listInvites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invites = await prisma.invite.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(invites);
  } catch (error) { next(error); }
};
