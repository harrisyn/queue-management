import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { isValidDomain, generateVerificationToken, verifyCnameMatches } from '../services/customDomain.service';

// The hostname a custom domain's CNAME record must point at. Derived from
// FRONTEND_URL so it tracks whatever domain this deployment is actually
// served from - no separate env var to keep in sync.
export function getCnameTarget(): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:8003';
  try {
    return new URL(frontendUrl).hostname;
  } catch {
    return 'localhost';
  }
}

function serializeCustomDomain(customDomain: {
  domain: string;
  status: string;
  verifiedAt: Date | null;
  createdAt: Date;
} | null) {
  if (!customDomain) return null;
  return {
    domain: customDomain.domain,
    status: customDomain.status,
    verifiedAt: customDomain.verifiedAt,
    createdAt: customDomain.createdAt,
    cnameTarget: getCnameTarget(),
  };
}

export const getCustomDomain = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customDomain = await prisma.customDomain.findUnique({ where: { organizationId: id } });
    res.json(serializeCustomDomain(customDomain));
  } catch (error) {
    next(error);
  }
};

export const setCustomDomain = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { domain } = req.body;

    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ error: 'domain is required' });
    }
    const normalizedDomain = domain.trim().toLowerCase();
    if (!isValidDomain(normalizedDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' });
    }

    const existingOwner = await prisma.customDomain.findUnique({ where: { domain: normalizedDomain } });
    if (existingOwner && existingOwner.organizationId !== id) {
      return res.status(409).json({ error: 'This domain is already in use by another organization' });
    }

    const customDomain = await prisma.customDomain.upsert({
      where: { organizationId: id },
      create: {
        organizationId: id,
        domain: normalizedDomain,
        verificationToken: generateVerificationToken(),
        status: 'PENDING',
      },
      update: {
        domain: normalizedDomain,
        verificationToken: generateVerificationToken(),
        status: 'PENDING',
        verifiedAt: null,
      },
    });

    res.json(serializeCustomDomain(customDomain));
  } catch (error) {
    next(error);
  }
};

export const verifyCustomDomain = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const customDomain = await prisma.customDomain.findUnique({ where: { organizationId: id } });
    if (!customDomain) {
      return res.status(404).json({ error: 'No custom domain configured' });
    }

    const matches = await verifyCnameMatches(customDomain.domain, getCnameTarget());
    if (!matches) {
      return res.status(400).json({
        error: 'Verification failed',
        message: `We couldn't find a CNAME record pointing ${customDomain.domain} to ${getCnameTarget()}. DNS changes can take time to propagate - try again shortly.`,
        ...serializeCustomDomain(customDomain),
      });
    }

    const updated = await prisma.customDomain.update({
      where: { organizationId: id },
      data: { status: 'VERIFIED', verifiedAt: new Date() },
    });

    res.json(serializeCustomDomain(updated));
  } catch (error) {
    next(error);
  }
};

export const deleteCustomDomain = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.customDomain.deleteMany({ where: { organizationId: id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// Public: resolve a verified custom domain to the org's branding, for the
// frontend middleware and login page to treat it exactly like a tenant
// subdomain.
export const getOrganizationByDomain = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domain } = req.params;
    const normalizedDomain = domain.trim().toLowerCase();

    const customDomain = await prisma.customDomain.findUnique({
      where: { domain: normalizedDomain },
      select: {
        status: true,
        organization: {
          select: { id: true, name: true, slug: true, logoUrl: true, primaryColor: true, hidePoweredBy: true },
        },
      },
    });

    if (!customDomain || customDomain.status !== 'VERIFIED' || !customDomain.organization.slug) {
      return res.status(404).json({ error: 'No organization found for this domain' });
    }

    res.json(customDomain.organization);
  } catch (error) {
    next(error);
  }
};
