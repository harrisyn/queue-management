import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    user: { findUnique: vi.fn() },
    organization: { findUnique: vi.fn() },
    addOnPricing: { findUnique: vi.fn() },
    planAddOnPricingOverride: { findUnique: vi.fn() },
    organizationAddOn: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../services/payments', () => ({
  getProvider: vi.fn(),
  ProviderNotActiveError: class ProviderNotActiveError extends Error {},
}));

import prisma from '../../lib/prisma';
import { getProvider } from '../../services/payments';
import { createAddOnCheckout, listMyAddOns, cancelAddOn, resolveAddOnUnitPrice } from '../addOnCheckout.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('createAddOnCheckout', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an invalid resourceType', async () => {
    const req: any = { user: { userId: 'u1' }, body: { resourceType: 'SERVICES', quantity: 1, billingMode: 'one_off', provider: 'stripe' } };
    const res = makeRes();
    await createAddOnCheckout(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects a non-positive quantity', async () => {
    const req: any = { user: { userId: 'u1' }, body: { resourceType: 'LOCATIONS', quantity: 0, billingMode: 'one_off', provider: 'stripe' } };
    const res = makeRes();
    await createAddOnCheckout(req, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('resolves the recurring unit price and calls createAddOnCheckoutSession', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organization.findUnique as any).mockResolvedValue({ subscription: { planId: 'plan1' } });
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue(null);
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({
      resourceType: 'LOCATIONS', pricePerUnitMonthly: '15', pricePerUnitOneOff: '50', currency: 'USD',
    });
    const createAddOnCheckoutSession = vi.fn().mockResolvedValue({ redirectUrl: 'https://pay.example/session' });
    (getProvider as any).mockResolvedValue({ createAddOnCheckoutSession });

    const req: any = { user: { userId: 'u1' }, body: { resourceType: 'LOCATIONS', quantity: 2, billingMode: 'recurring', provider: 'stripe' } };
    const res = makeRes();
    await createAddOnCheckout(req, res, vi.fn());

    expect(createAddOnCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org1',
      resourceType: 'LOCATIONS',
      quantity: 2,
      billingMode: 'recurring',
      unitPrice: 15,
      currency: 'USD',
    }));
    expect(res.json).toHaveBeenCalledWith({ redirectUrl: 'https://pay.example/session' });
  });

  it('resolves the one_off unit price', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organization.findUnique as any).mockResolvedValue({ subscription: { planId: 'plan1' } });
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue(null);
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({
      resourceType: 'USERS', pricePerUnitMonthly: '5', pricePerUnitOneOff: '20', currency: 'USD',
    });
    const createAddOnCheckoutSession = vi.fn().mockResolvedValue({ redirectUrl: 'https://pay.example/session' });
    (getProvider as any).mockResolvedValue({ createAddOnCheckoutSession });

    const req: any = { user: { userId: 'u1' }, body: { resourceType: 'USERS', quantity: 3, billingMode: 'one_off', provider: 'stripe' } };
    const res = makeRes();
    await createAddOnCheckout(req, res, vi.fn());

    expect(createAddOnCheckoutSession).toHaveBeenCalledWith(expect.objectContaining({ unitPrice: 20 }));
  });

  it('returns a 502 without leaking the raw provider error when checkout session creation fails', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organization.findUnique as any).mockResolvedValue({ subscription: { planId: 'plan1' } });
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue(null);
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({
      resourceType: 'LOCATIONS', pricePerUnitMonthly: '15', pricePerUnitOneOff: '50', currency: 'USD',
    });
    const createAddOnCheckoutSession = vi.fn().mockRejectedValue(new Error('Invalid API Key'));
    (getProvider as any).mockResolvedValue({ createAddOnCheckoutSession });

    const req: any = { user: { userId: 'u1' }, body: { resourceType: 'LOCATIONS', quantity: 1, billingMode: 'recurring', provider: 'stripe' } };
    const res = makeRes();
    await createAddOnCheckout(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(502);
    expect(res.json).toHaveBeenCalledWith({ error: 'Payment provider temporarily unavailable. Please try again shortly.' });
  });
});

describe('resolveAddOnUnitPrice', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uses the plan-specific override when one exists', async () => {
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue({
      pricePerUnitMonthly: '12', pricePerUnitOneOff: '40',
    });
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({ currency: 'GHS' });

    const result = await resolveAddOnUnitPrice('plan1', 'LOCATIONS', 'recurring');

    expect(result).toEqual({ unitPrice: 12, currency: 'GHS' });
    expect(prisma.planAddOnPricingOverride.findUnique).toHaveBeenCalledWith({
      where: { planId_resourceType: { planId: 'plan1', resourceType: 'LOCATIONS' } },
    });
  });

  it('falls back to the global default when no override exists', async () => {
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue(null);
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({
      pricePerUnitMonthly: '15', pricePerUnitOneOff: '50', currency: 'USD',
    });

    const result = await resolveAddOnUnitPrice('plan1', 'LOCATIONS', 'recurring');

    expect(result).toEqual({ unitPrice: 15, currency: 'USD' });
  });

  it('falls back to the global default when planId is null', async () => {
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({
      pricePerUnitMonthly: '15', pricePerUnitOneOff: '50', currency: 'USD',
    });

    const result = await resolveAddOnUnitPrice(null, 'LOCATIONS', 'recurring');

    expect(result).toEqual({ unitPrice: 15, currency: 'USD' });
    expect(prisma.planAddOnPricingOverride.findUnique).not.toHaveBeenCalled();
  });

  it('returns null when neither an override nor a global default is configured', async () => {
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue(null);
    (prisma.addOnPricing.findUnique as any).mockResolvedValue(null);

    const result = await resolveAddOnUnitPrice('plan1', 'LOCATIONS', 'recurring');

    expect(result).toBeNull();
  });

  it('resolves the one_off override price separately from the recurring one', async () => {
    (prisma.planAddOnPricingOverride.findUnique as any).mockResolvedValue({
      pricePerUnitMonthly: '12', pricePerUnitOneOff: '40',
    });
    (prisma.addOnPricing.findUnique as any).mockResolvedValue({ currency: 'USD' });

    const result = await resolveAddOnUnitPrice('plan1', 'LOCATIONS', 'one_off');

    expect(result).toEqual({ unitPrice: 40, currency: 'USD' });
  });
});

describe('listMyAddOns', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns only the caller organization active add-ons', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organizationAddOn.findMany as any).mockResolvedValue([{ id: 'a1' }]);

    const req: any = { user: { userId: 'u1' } };
    const res = makeRes();
    await listMyAddOns(req, res, vi.fn());

    expect(prisma.organizationAddOn.findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org1', status: 'ACTIVE' },
      orderBy: { purchasedAt: 'desc' },
    });
    expect(res.json).toHaveBeenCalledWith([{ id: 'a1' }]);
  });
});

describe('cancelAddOn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects cancelling a one-off add-on', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organizationAddOn.findUnique as any).mockResolvedValue({
      id: 'a1', organizationId: 'org1', billingMode: 'ONE_OFF', status: 'ACTIVE',
    });

    const req: any = { user: { userId: 'u1' }, params: { id: 'a1' } };
    const res = makeRes();
    await cancelAddOn(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.organizationAddOn.update).not.toHaveBeenCalled();
  });

  it('rejects cancelling an add-on belonging to a different organization', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organizationAddOn.findUnique as any).mockResolvedValue({
      id: 'a1', organizationId: 'org2', billingMode: 'RECURRING', status: 'ACTIVE',
    });

    const req: any = { user: { userId: 'u1' }, params: { id: 'a1' } };
    const res = makeRes();
    await cancelAddOn(req, res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('cancels a recurring add-on via the provider and updates status', async () => {
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (prisma.organizationAddOn.findUnique as any).mockResolvedValue({
      id: 'a1', organizationId: 'org1', billingMode: 'RECURRING', status: 'ACTIVE', provider: 'stripe', externalSubscriptionId: 'sub_1',
    });
    const cancelSubscription = vi.fn().mockResolvedValue(undefined);
    (getProvider as any).mockResolvedValue({ cancelSubscription });
    (prisma.organizationAddOn.update as any).mockResolvedValue({ id: 'a1', status: 'CANCELLED' });

    const req: any = { user: { userId: 'u1' }, params: { id: 'a1' } };
    const res = makeRes();
    await cancelAddOn(req, res, vi.fn());

    expect(cancelSubscription).toHaveBeenCalledWith('sub_1');
    expect(prisma.organizationAddOn.update).toHaveBeenCalledWith({
      where: { id: 'a1' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
  });
});
