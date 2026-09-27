import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    location: { findUnique: vi.fn() },
  },
}));

import prisma from '../lib/prisma';
import { scope, location, org, canAssignRole } from './tenantScope.middleware';

const run = async (mw: any, req: any) => {
  const res: any = { statusCode: 200 };
  res.status = vi.fn((c: number) => { res.statusCode = c; return res; });
  res.json = vi.fn(() => res);
  const next = vi.fn();
  await mw(req, res, next);
  return { res, next };
};

describe('scope()', () => {
  beforeEach(() => vi.clearAllMocks());

  it('404s when the resource belongs to another org', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', role: 'ORG_ADMIN', organizationId: 'orgA', isActive: true });
    (prisma.location.findUnique as any).mockResolvedValue({ organizationId: 'orgB' });
    const { res, next } = await run(scope(location('params.id')), { user: { userId: 'u1' }, params: { id: 'loc1' } });
    expect(res.statusCode).toBe(404);
    expect(next).not.toHaveBeenCalled();
  });

  it('passes when the resource belongs to the caller org', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', role: 'ORG_ADMIN', organizationId: 'orgA', isActive: true });
    (prisma.location.findUnique as any).mockResolvedValue({ organizationId: 'orgA' });
    const { next } = await run(scope(location('params.id')), { user: { userId: 'u1' }, params: { id: 'loc1' } });
    expect(next).toHaveBeenCalledWith();
  });

  it('404s when the referenced resource does not exist', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', role: 'ORG_ADMIN', organizationId: 'orgA', isActive: true });
    (prisma.location.findUnique as any).mockResolvedValue(null);
    const { res } = await run(scope(location('params.id')), { user: { userId: 'u1' }, params: { id: 'nope' } });
    expect(res.statusCode).toBe(404);
  });

  it('skips optional references that are absent', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', role: 'ORG_ADMIN', organizationId: 'orgA', isActive: true });
    const { next } = await run(scope(location('body.locationId')), { user: { userId: 'u1' }, body: {} });
    expect(next).toHaveBeenCalledWith();
  });

  it('lets SUPER_ADMIN through', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 's1', role: 'SUPER_ADMIN', organizationId: null, isActive: true });
    const { next } = await run(scope(org('params.organizationId')), { user: { userId: 's1' }, params: { organizationId: 'orgZ' } });
    expect(next).toHaveBeenCalledWith();
  });

  it('401s a deactivated caller', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ id: 'u1', role: 'ORG_ADMIN', organizationId: 'orgA', isActive: false });
    const { res } = await run(scope(org('params.organizationId')), { user: { userId: 'u1' }, params: { organizationId: 'orgA' } });
    expect(res.statusCode).toBe(401);
  });
});

describe('canAssignRole', () => {
  it('only SUPER_ADMIN can mint SUPER_ADMIN', () => {
    expect(canAssignRole('ORG_ADMIN', 'SUPER_ADMIN')).toBe(false);
    expect(canAssignRole('LOCATION_ADMIN', 'SUPER_ADMIN')).toBe(false);
    expect(canAssignRole('SUPER_ADMIN', 'SUPER_ADMIN')).toBe(true);
  });

  it('LOCATION_ADMIN cannot grant admin roles', () => {
    expect(canAssignRole('LOCATION_ADMIN', 'ORG_ADMIN')).toBe(false);
    expect(canAssignRole('LOCATION_ADMIN', 'LOCATION_ADMIN')).toBe(false);
    expect(canAssignRole('LOCATION_ADMIN', 'SERVICE_STAFF')).toBe(true);
  });

  it('staff roles cannot assign anything', () => {
    expect(canAssignRole('SERVICE_STAFF', 'PATIENT')).toBe(false);
  });
});
