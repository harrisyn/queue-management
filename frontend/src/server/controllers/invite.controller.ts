import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import crypto from 'crypto';
import { loadCaller, listScopeOrgId, canAssignRole } from '../middleware/tenantScope.middleware';

const DEFAULT_INVITE_TTL_DAYS = 7;

export const createInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role = 'SERVICE_STAFF', organizationId, expiresAt } = req.body;

    const caller = await loadCaller(req);
    if (!caller) return res.status(401).json({ error: 'Authentication required' });
    if (role === 'PATIENT' || !canAssignRole(caller.role, role)) {
      return res.status(403).json({ error: 'You cannot invite users with this role' });
    }
    // Tenant admins can only invite into their own org.
    const targetOrgId = caller.role === 'SUPER_ADMIN' ? organizationId : caller.organizationId;
    if (!targetOrgId) {
      return res.status(400).json({ error: 'organizationId is required' });
    }

    const code = crypto.randomBytes(16).toString('hex');
    const expiry = expiresAt
      ? new Date(expiresAt)
      : new Date(Date.now() + DEFAULT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

    const invite = await prisma.invite.create({
      data: {
        code,
        role,
        organizationId: targetOrgId,
        expiresAt: expiry,
        createdBy: caller.id,
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
    const scopedOrgId = await listScopeOrgId(req);
    if (!invite || (scopedOrgId && invite.organizationId !== scopedOrgId)) {
      return res.status(404).json({ error: 'Invite not found' });
    }
    res.json({ invite });
  } catch (error) {
    next(error);
  }
};

export const listInvites = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scopedOrgId = await listScopeOrgId(req, req.query.organizationId as string | undefined);
    const invites = await prisma.invite.findMany({
      where: scopedOrgId ? { organizationId: scopedOrgId } : {},
      orderBy: { createdAt: 'desc' },
    });
    res.json(invites);
  } catch (error) { next(error); }
};

/** Public: what the accept-invite page needs to render, nothing more. */
export const previewInvite = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const invite = await prisma.invite.findUnique({ where: { code } });
    if (!invite || !invite.organizationId) return res.status(404).json({ error: 'Invite not found' });

    const organization = await prisma.organization.findUnique({
      where: { id: invite.organizationId },
      select: { name: true, slug: true, logoUrl: true },
    });
    if (!organization) return res.status(404).json({ error: 'Invite not found' });

    const expired = !!invite.expiresAt && invite.expiresAt.getTime() < Date.now();
    res.json({
      role: invite.role,
      organization,
      status: invite.used ? 'used' : expired ? 'expired' : 'valid',
    });
  } catch (error) {
    next(error);
  }
};
