import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    organization: { findUnique: vi.fn() },
    creditLedgerEntry: { create: vi.fn() },
    subscriptionPlan: { findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    planCreditAllowance: { upsert: vi.fn() },
    planAddOnPricingOverride: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

import prisma from '../../lib/prisma';
import { grantCredits, updatePlan } from '../superadmin.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('grantCredits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an invalid creditType', async () => {
    const req: any = { params: { id: 'org1' }, body: { creditType: 'MINUTES', amount: 10, reason: 'test' } };
    const res = makeRes();
    await grantCredits(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a zero amount', async () => {
    const req: any = { params: { id: 'org1' }, body: { creditType: 'AI', amount: 0, reason: 'test' } };
    const res = makeRes();
    await grantCredits(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a missing reason', async () => {
    const req: any = { params: { id: 'org1' }, body: { creditType: 'AI', amount: 10 } };
    const res = makeRes();
    await grantCredits(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('404s when the organization does not exist', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue(null);
    const req: any = { params: { id: 'org1' }, body: { creditType: 'AI', amount: 10, reason: 'test' } };
    const res = makeRes();
    await grantCredits(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('records a positive ledger entry for a grant', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1' });
    (prisma.creditLedgerEntry.create as any).mockResolvedValue({ id: 'entry1', organizationId: 'org1', creditType: 'AI', amount: 50, reason: 'goodwill top-up' });

    const req: any = { params: { id: 'org1' }, body: { creditType: 'AI', amount: 50, reason: 'goodwill top-up' } };
    const res = makeRes();
    await grantCredits(req, res, vi.fn());

    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: { organizationId: 'org1', creditType: 'AI', amount: 50, reason: 'goodwill top-up' },
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('allows a negative amount to debit credits', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({ id: 'org1' });
    (prisma.creditLedgerEntry.create as any).mockResolvedValue({ id: 'entry1' });

    const req: any = { params: { id: 'org1' }, body: { creditType: 'SMS', amount: -20, reason: 'correction' } };
    const res = makeRes();
    await grantCredits(req, res, vi.fn());

    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: { organizationId: 'org1', creditType: 'SMS', amount: -20, reason: 'correction' },
    });
  });
});

describe('updatePlan - credit allowance upsert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts only the credit types present in the request body', async () => {
    (prisma.subscriptionPlan.findUnique as any).mockResolvedValue({ id: 'plan1', isDefault: false, isRecommended: false });
    (prisma.subscriptionPlan.update as any).mockResolvedValue({ id: 'plan1' });

    const req: any = {
      params: { id: 'plan1' },
      body: { creditAllowances: { AI: 100, EMAIL: null } },
    };
    const res = makeRes();
    await updatePlan(req, res, vi.fn());

    expect(prisma.planCreditAllowance.upsert).toHaveBeenCalledWith({
      where: { planId_creditType: { planId: 'plan1', creditType: 'AI' } },
      create: { planId: 'plan1', creditType: 'AI', monthlyAllowance: 100 },
      update: { monthlyAllowance: 100 },
    });
    expect(prisma.planCreditAllowance.upsert).toHaveBeenCalledWith({
      where: { planId_creditType: { planId: 'plan1', creditType: 'EMAIL' } },
      create: { planId: 'plan1', creditType: 'EMAIL', monthlyAllowance: null },
      update: { monthlyAllowance: null },
    });
    expect(prisma.planCreditAllowance.upsert).not.toHaveBeenCalledWith(expect.objectContaining({
      where: { planId_creditType: { planId: 'plan1', creditType: 'SMS' } },
    }));
  });

  it('does not touch credit allowances when none are provided', async () => {
    (prisma.subscriptionPlan.findUnique as any).mockResolvedValue({ id: 'plan1', isDefault: false, isRecommended: false });
    (prisma.subscriptionPlan.update as any).mockResolvedValue({ id: 'plan1' });

    const req: any = { params: { id: 'plan1' }, body: { name: 'Renamed' } };
    const res = makeRes();
    await updatePlan(req, res, vi.fn());

    expect(prisma.planCreditAllowance.upsert).not.toHaveBeenCalled();
  });
});

describe('updatePlan - add-on price override upsert', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts an override when a value is provided', async () => {
    (prisma.subscriptionPlan.findUnique as any).mockResolvedValue({ id: 'plan1', isDefault: false, isRecommended: false });
    (prisma.subscriptionPlan.update as any).mockResolvedValue({ id: 'plan1' });

    const req: any = {
      params: { id: 'plan1' },
      body: { addOnPricingOverrides: { LOCATIONS: { pricePerUnitMonthly: 10, pricePerUnitOneOff: 40 } } },
    };
    const res = makeRes();
    await updatePlan(req, res, vi.fn());

    expect(prisma.planAddOnPricingOverride.upsert).toHaveBeenCalledWith({
      where: { planId_resourceType: { planId: 'plan1', resourceType: 'LOCATIONS' } },
      create: { planId: 'plan1', resourceType: 'LOCATIONS', pricePerUnitMonthly: 10, pricePerUnitOneOff: 40 },
      update: { pricePerUnitMonthly: 10, pricePerUnitOneOff: 40 },
    });
  });

  it('clears an override when its value is null', async () => {
    (prisma.subscriptionPlan.findUnique as any).mockResolvedValue({ id: 'plan1', isDefault: false, isRecommended: false });
    (prisma.subscriptionPlan.update as any).mockResolvedValue({ id: 'plan1' });

    const req: any = {
      params: { id: 'plan1' },
      body: { addOnPricingOverrides: { USERS: null } },
    };
    const res = makeRes();
    await updatePlan(req, res, vi.fn());

    expect(prisma.planAddOnPricingOverride.deleteMany).toHaveBeenCalledWith({
      where: { planId: 'plan1', resourceType: 'USERS' },
    });
    expect(prisma.planAddOnPricingOverride.upsert).not.toHaveBeenCalled();
  });

  it('does not touch overrides when none are provided', async () => {
    (prisma.subscriptionPlan.findUnique as any).mockResolvedValue({ id: 'plan1', isDefault: false, isRecommended: false });
    (prisma.subscriptionPlan.update as any).mockResolvedValue({ id: 'plan1' });

    const req: any = { params: { id: 'plan1' }, body: { name: 'Renamed' } };
    const res = makeRes();
    await updatePlan(req, res, vi.fn());

    expect(prisma.planAddOnPricingOverride.upsert).not.toHaveBeenCalled();
    expect(prisma.planAddOnPricingOverride.deleteMany).not.toHaveBeenCalled();
  });
});
