import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    organization: { findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../middleware/subscription.middleware', () => ({
  getOrganizationFeatures: vi.fn(),
}));

import prisma from '../../lib/prisma';
import { getOrganizationFeatures } from '../../middleware/subscription.middleware';
import { updateOrganization } from '../organization.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('updateOrganization - branding feature gate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects setting primaryColor when the plan lacks customBranding', async () => {
    (getOrganizationFeatures as any).mockResolvedValue({ customBranding: false });

    const req: any = { params: { id: 'org1' }, body: { primaryColor: '#ff0000' } };
    const res = makeRes();
    await updateOrganization(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('rejects setting hidePoweredBy when the plan lacks customBranding', async () => {
    (getOrganizationFeatures as any).mockResolvedValue({ customBranding: false });

    const req: any = { params: { id: 'org1' }, body: { hidePoweredBy: true } };
    const res = makeRes();
    await updateOrganization(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(prisma.organization.update).not.toHaveBeenCalled();
  });

  it('allows setting branding fields when the plan has customBranding', async () => {
    (getOrganizationFeatures as any).mockResolvedValue({ customBranding: true });
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', primaryColor: '#ff0000' });

    const req: any = { params: { id: 'org1' }, body: { primaryColor: '#ff0000' } };
    const res = makeRes();
    await updateOrganization(req, res, vi.fn());

    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { primaryColor: '#ff0000' },
    });
  });

  it('does not check the feature at all when no branding fields are being updated', async () => {
    (prisma.organization.update as any).mockResolvedValue({ id: 'org1', name: 'New Name' });

    const req: any = { params: { id: 'org1' }, body: { name: 'New Name' } };
    const res = makeRes();
    await updateOrganization(req, res, vi.fn());

    expect(getOrganizationFeatures).not.toHaveBeenCalled();
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: 'org1' },
      data: { name: 'New Name' },
    });
  });
});
