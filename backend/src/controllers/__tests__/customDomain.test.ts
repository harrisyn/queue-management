import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    customDomain: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock('../../services/customDomain.service', () => ({
  isValidDomain: vi.fn(),
  generateVerificationToken: vi.fn(() => 'token-123'),
  verifyCnameMatches: vi.fn(),
}));

import prisma from '../../lib/prisma';
import { isValidDomain, verifyCnameMatches } from '../../services/customDomain.service';
import {
  setCustomDomain,
  verifyCustomDomain,
  deleteCustomDomain,
  getOrganizationByDomain,
} from '../customDomain.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.send = vi.fn().mockReturnValue(res);
  return res;
}

describe('setCustomDomain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects a missing domain', async () => {
    const req: any = { params: { id: 'org1' }, body: {} };
    const res = makeRes();
    await setCustomDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an invalid domain format', async () => {
    (isValidDomain as any).mockReturnValue(false);
    const req: any = { params: { id: 'org1' }, body: { domain: 'not a domain' } };
    const res = makeRes();
    await setCustomDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.customDomain.upsert).not.toHaveBeenCalled();
  });

  it('rejects a domain already claimed by another organization', async () => {
    (isValidDomain as any).mockReturnValue(true);
    (prisma.customDomain.findUnique as any).mockResolvedValue({ organizationId: 'org2' });
    const req: any = { params: { id: 'org1' }, body: { domain: 'queue.acmehealth.com' } };
    const res = makeRes();
    await setCustomDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(409);
    expect(prisma.customDomain.upsert).not.toHaveBeenCalled();
  });

  it('upserts a fresh PENDING domain, resetting verification state on replace', async () => {
    (isValidDomain as any).mockReturnValue(true);
    (prisma.customDomain.findUnique as any).mockResolvedValue(null);
    (prisma.customDomain.upsert as any).mockResolvedValue({
      domain: 'queue.acmehealth.com',
      status: 'PENDING',
      verifiedAt: null,
      createdAt: new Date('2026-01-01'),
    });

    const req: any = { params: { id: 'org1' }, body: { domain: 'Queue.AcmeHealth.com ' } };
    const res = makeRes();
    await setCustomDomain(req, res, vi.fn());

    expect(prisma.customDomain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org1' },
        create: expect.objectContaining({ domain: 'queue.acmehealth.com', status: 'PENDING' }),
        update: expect.objectContaining({ domain: 'queue.acmehealth.com', status: 'PENDING', verifiedAt: null }),
      })
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ domain: 'queue.acmehealth.com', status: 'PENDING' }));
  });
});

describe('verifyCustomDomain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when no domain is configured', async () => {
    (prisma.customDomain.findUnique as any).mockResolvedValue(null);
    const req: any = { params: { id: 'org1' } };
    const res = makeRes();
    await verifyCustomDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('leaves the domain PENDING when the CNAME does not match', async () => {
    (prisma.customDomain.findUnique as any).mockResolvedValue({ domain: 'queue.acmehealth.com', status: 'PENDING' });
    (verifyCnameMatches as any).mockResolvedValue(false);
    const req: any = { params: { id: 'org1' } };
    const res = makeRes();
    await verifyCustomDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.customDomain.update).not.toHaveBeenCalled();
  });

  it('marks the domain VERIFIED when the CNAME matches', async () => {
    (prisma.customDomain.findUnique as any).mockResolvedValue({ domain: 'queue.acmehealth.com', status: 'PENDING' });
    (verifyCnameMatches as any).mockResolvedValue(true);
    (prisma.customDomain.update as any).mockResolvedValue({
      domain: 'queue.acmehealth.com',
      status: 'VERIFIED',
      verifiedAt: new Date('2026-01-01'),
      createdAt: new Date('2026-01-01'),
    });
    const req: any = { params: { id: 'org1' } };
    const res = makeRes();
    await verifyCustomDomain(req, res, vi.fn());
    expect(prisma.customDomain.update).toHaveBeenCalledWith({
      where: { organizationId: 'org1' },
      data: { status: 'VERIFIED', verifiedAt: expect.any(Date) },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'VERIFIED' }));
  });
});

describe('deleteCustomDomain', () => {
  it('deletes the org custom domain row and returns 204', async () => {
    const req: any = { params: { id: 'org1' } };
    const res = makeRes();
    await deleteCustomDomain(req, res, vi.fn());
    expect(prisma.customDomain.deleteMany).toHaveBeenCalledWith({ where: { organizationId: 'org1' } });
    expect(res.status).toHaveBeenCalledWith(204);
  });
});

describe('getOrganizationByDomain', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the domain has no mapping', async () => {
    (prisma.customDomain.findUnique as any).mockResolvedValue(null);
    const req: any = { params: { domain: 'queue.acmehealth.com' } };
    const res = makeRes();
    await getOrganizationByDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('404s when the domain is mapped but not yet VERIFIED', async () => {
    (prisma.customDomain.findUnique as any).mockResolvedValue({
      status: 'PENDING',
      organization: { id: 'org1', slug: 'acme' },
    });
    const req: any = { params: { domain: 'queue.acmehealth.com' } };
    const res = makeRes();
    await getOrganizationByDomain(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns the org branding when VERIFIED', async () => {
    const org = { id: 'org1', name: 'Acme', slug: 'acme', logoUrl: null, primaryColor: null, hidePoweredBy: false };
    (prisma.customDomain.findUnique as any).mockResolvedValue({ status: 'VERIFIED', organization: org });
    const req: any = { params: { domain: 'queue.acmehealth.com' } };
    const res = makeRes();
    await getOrganizationByDomain(req, res, vi.fn());
    expect(res.json).toHaveBeenCalledWith(org);
  });
});
