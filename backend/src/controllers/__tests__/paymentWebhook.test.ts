import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/prisma', () => ({
  default: {
    organizationAddOn: { create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
    organizationSubscription: { findFirst: vi.fn() },
    organization: { findUnique: vi.fn() },
  },
}));

vi.mock('../../services/payments', () => ({
  getProvider: vi.fn(),
}));

vi.mock('../../services/payments/idempotency', () => ({
  wasAlreadyProcessed: vi.fn(async () => false),
  markProcessed: vi.fn(async () => {}),
}));

import prisma from '../../lib/prisma';
import { getProvider } from '../../services/payments';
import { handleStripeWebhook } from '../paymentWebhook.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

function makeReq(): any {
  return { headers: { 'stripe-signature': 'sig' }, body: Buffer.from('{}') };
}

describe('paymentWebhook - add-on dispatch', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates a new OrganizationAddOn on a one-off addon checkout_completed event', async () => {
    (getProvider as any).mockResolvedValue({
      verifyWebhookSignature: () => ({
        eventId: 'evt_1',
        type: 'checkout_completed',
        organizationId: 'org1',
        externalSubscriptionId: null,
        currentPeriodEnd: null,
        planId: null,
        billingCycle: null,
        kind: 'addon',
        addOn: { resourceType: 'LOCATIONS', quantity: 2, billingMode: 'one_off' },
      }),
    });

    await handleStripeWebhook(makeReq(), makeRes());

    expect(prisma.organizationAddOn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        resourceType: 'LOCATIONS',
        quantity: 2,
        billingMode: 'ONE_OFF',
        status: 'ACTIVE',
        externalSubscriptionId: null,
        currentPeriodEnd: null,
      }),
    });
  });

  it('creates a new OrganizationAddOn on a recurring addon checkout_completed event', async () => {
    (getProvider as any).mockResolvedValue({
      verifyWebhookSignature: () => ({
        eventId: 'evt_2',
        type: 'checkout_completed',
        organizationId: 'org1',
        externalSubscriptionId: 'sub_addon_1',
        currentPeriodEnd: null,
        planId: null,
        billingCycle: null,
        kind: 'addon',
        addOn: { resourceType: 'USERS', quantity: 3, billingMode: 'recurring' },
      }),
    });
    (prisma.organizationAddOn.findFirst as any).mockResolvedValue(null);

    await handleStripeWebhook(makeReq(), makeRes());

    expect(prisma.organizationAddOn.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org1',
        resourceType: 'USERS',
        quantity: 3,
        billingMode: 'RECURRING',
        status: 'ACTIVE',
        externalSubscriptionId: 'sub_addon_1',
      }),
    });
  });

  it('treats a repeat charge.success on the same recurring subscription as a renewal, not a new purchase', async () => {
    (getProvider as any).mockResolvedValue({
      verifyWebhookSignature: () => ({
        eventId: 'evt_3',
        type: 'checkout_completed',
        organizationId: 'org1',
        externalSubscriptionId: 'sub_addon_1',
        currentPeriodEnd: null,
        planId: null,
        billingCycle: null,
        kind: 'addon',
        addOn: { resourceType: 'USERS', quantity: 3, billingMode: 'recurring' },
      }),
    });
    (prisma.organizationAddOn.findFirst as any).mockResolvedValue({ id: 'addon1', status: 'ACTIVE' });

    await handleStripeWebhook(makeReq(), makeRes());

    expect(prisma.organizationAddOn.update).toHaveBeenCalledWith({
      where: { id: 'addon1' },
      data: expect.objectContaining({ currentPeriodEnd: expect.any(Date) }),
    });
    expect(prisma.organizationAddOn.create).not.toHaveBeenCalled();
  });

  it('cancels the matching OrganizationAddOn on a subscription_cancelled event', async () => {
    (getProvider as any).mockResolvedValue({
      verifyWebhookSignature: () => ({
        eventId: 'evt_4',
        type: 'subscription_cancelled',
        organizationId: null,
        externalSubscriptionId: 'sub_addon_1',
        currentPeriodEnd: null,
        planId: null,
        billingCycle: null,
        kind: 'plan', // provider can't reliably know kind for this event type - dispatch is lookup-based
      }),
    });
    (prisma.organizationAddOn.findFirst as any).mockResolvedValue({ id: 'addon1', status: 'ACTIVE' });

    await handleStripeWebhook(makeReq(), makeRes());

    expect(prisma.organizationAddOn.update).toHaveBeenCalledWith({
      where: { id: 'addon1' },
      data: { status: 'CANCELLED', cancelledAt: expect.any(Date) },
    });
    expect(prisma.organizationSubscription.findFirst).not.toHaveBeenCalled();
  });

  it('falls back to plan-subscription handling when no add-on matches externalSubscriptionId', async () => {
    (getProvider as any).mockResolvedValue({
      verifyWebhookSignature: () => ({
        eventId: 'evt_5',
        type: 'subscription_cancelled',
        organizationId: null,
        externalSubscriptionId: 'sub_plan_1',
        currentPeriodEnd: null,
        planId: null,
        billingCycle: null,
        kind: 'plan',
      }),
    });
    (prisma.organizationAddOn.findFirst as any).mockResolvedValue(null);
    (prisma.organizationSubscription.findFirst as any).mockResolvedValue(null);

    await handleStripeWebhook(makeReq(), makeRes());

    expect(prisma.organizationAddOn.update).not.toHaveBeenCalled();
    expect(prisma.organizationSubscription.findFirst).toHaveBeenCalledWith({
      where: { externalProviderSubscriptionId: 'sub_plan_1' },
      include: { organizations: true },
    });
  });
});
