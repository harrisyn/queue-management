import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../lib/jwt';
import prisma from '../lib/prisma';

interface JwtPayload {
  userId: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = verifyToken(token);

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }

    next();
  };
};

/**
 * Requires the authenticated caller to actually own the org identified by
 * the `:id` route param. SUPER_ADMIN always passes (superadmins manage all
 * orgs via /superadmin/*, but existing /orgs/:id callers rely on this too).
 * Any other role must have a `User.organizationId` matching the route
 * param, loaded fresh from the DB (the JWT never carries organizationId).
 *
 * Returns 404 rather than 403 on mismatch so a caller probing org IDs they
 * don't own can't distinguish "exists but not yours" from "doesn't exist" —
 * consistent with this codebase's existing philosophy of never confirming
 * resource existence via a distinguishable error response (see login).
 */
export const requireOwnOrganization = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });

    if (!user || !user.organizationId || user.organizationId !== id) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    next();
  } catch (error) {
    next(error);
  }
};
