import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    organization: { update: vi.fn(), findUnique: vi.fn() },
    user: { findFirst: vi.fn() },
    impersonationLog: { create: vi.fn() },
  },
}));

vi.mock('jsonwebtoken', () => ({
  default: { sign: vi.fn(() => 'signed-token') },
}));

import prisma from '../../lib/prisma';
import jwt from 'jsonwebtoken';
import { setOrganizationStatus, impersonateOrganization } from '../superadmin.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('setOrganizationStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an invalid status value', async () => {
    const req: any = { params: { id: 'org1' }, body: { status: 'DELETED' } };
    const res = makeRes();
    await setOrganizationStatus(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('pauses an organization', async () => {
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', status: 'PAUSED' });
    const req: any = { params: { id: 'org1' }, body: { status: 'PAUSED' } };
    const res = makeRes();
    await setOrganizationStatus(req, res, vi.fn());
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: 'org1' }, data: { status: 'PAUSED' } });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'PAUSED' }));
  });

  it('reactivates an organization', async () => {
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', status: 'ACTIVE' });
    const req: any = { params: { id: 'org1' }, body: { status: 'ACTIVE' } };
    const res = makeRes();
    await setOrganizationStatus(req, res, vi.fn());
    expect(prisma.organization.update).toHaveBeenCalledWith({ where: { id: 'org1' }, data: { status: 'ACTIVE' } });
  });
});

describe('impersonateOrganization', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the organization does not exist', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    const req: any = { params: { id: 'org1' }, user: { userId: 'super1' } };
    const res = makeRes();
    await impersonateOrganization(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('400s when the organization has no slug', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1', name: 'Acme', slug: null });
    const req: any = { params: { id: 'org1' }, user: { userId: 'super1' } };
    const res = makeRes();
    await impersonateOrganization(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404s when the organization has no users', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1', name: 'Acme', slug: 'acme' });
    (prisma.user.findFirst as any).mockResolvedValue(null);
    const req: any = { params: { id: 'org1' }, user: { userId: 'super1' } };
    const res = makeRes();
    await impersonateOrganization(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('prefers an ORG_ADMIN user, signs a token, and logs the event', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1', name: 'Acme', slug: 'acme' });
    const admin = { id: 'user1', role: 'ORG_ADMIN', email: 'admin@acme.com', firstName: 'A', lastName: 'B' };
    (prisma.user.findFirst as any).mockResolvedValueOnce(admin);

    const req: any = { params: { id: 'org1' }, user: { userId: 'super1' } };
    const res = makeRes();
    await impersonateOrganization(req, res, vi.fn());

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(1);
    expect(prisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { organizationId: 'org1', role: 'ORG_ADMIN' } })
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      { userId: 'user1', role: 'ORG_ADMIN' },
      expect.any(String),
      expect.objectContaining({ expiresIn: expect.any(String) })
    );
    expect(prisma.impersonationLog.create).toHaveBeenCalledWith({
      data: { organizationId: 'org1', superAdminId: 'super1', impersonatedUserId: 'user1' },
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      token: 'signed-token',
      tenantSlug: 'acme',
    }));
  });

  it('falls back to any user when there is no ORG_ADMIN', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1', name: 'Acme', slug: 'acme' });
    const staff = { id: 'user2', role: 'SERVICE_STAFF', email: 'staff@acme.com', firstName: 'S', lastName: 'T' };
    (prisma.user.findFirst as any)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(staff);

    const req: any = { params: { id: 'org1' }, user: { userId: 'super1' } };
    const res = makeRes();
    await impersonateOrganization(req, res, vi.fn());

    expect(prisma.user.findFirst).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ token: 'signed-token' }));
  });
});
