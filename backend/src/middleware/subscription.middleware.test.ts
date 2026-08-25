import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    organization: { findUnique: vi.fn() },
    queueEntry: { count: vi.fn() },
    location: { count: vi.fn() },
    user: { count: vi.fn() },
    organizationAddOn: { aggregate: vi.fn() },
  },
}));

import prisma from '../lib/prisma';
import { checkLimit } from './subscription.middleware';

function mockActiveOrg(planOverrides: Record<string, any>, periodStart = new Date('2026-08-01T00:00:00Z')) {
  (prisma.organization.findUnique as any).mockResolvedValue({
    subscription: {
      id: 'sub1',
      status: 'ACTIVE',
      trialEndsAt: null,
      planId: 'plan1',
      currentPeriodStart: periodStart,
      plan: {
        id: 'plan1',
        expiredFallbackPlanId: null,
        maxQueueEntriesPerDay: null,
        maxQueueEntriesPerPeriod: null,
        ...planOverrides,
      },
    },
  });
}

describe('checkLimit - queueEntriesDaily', () => {
  beforeEach(() => vi.clearAllMocks());

  it('is unlimited (allowed=true, limit=null) when maxQueueEntriesPerDay is null', async () => {
    mockActiveOrg({});
    (prisma.queueEntry.count as any).mockResolvedValue(500);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 500, limit: null, allowed: true });
  });

  it('blocks once the daily count reaches the plan limit', async () => {
    mockActiveOrg({ maxQueueEntriesPerDay: 10 });
    (prisma.queueEntry.count as any).mockResolvedValue(10);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 10, limit: 10, allowed: false });
  });

  it('allows joins below the daily limit', async () => {
    mockActiveOrg({ maxQueueEntriesPerDay: 10 });
    (prisma.queueEntry.count as any).mockResolvedValue(9);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 9, limit: 10, allowed: true });
  });

  it('hard-blocks (limit=0) when the subscription is not usable', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({
      subscription: {
        id: 'sub1',
        status: 'PAST_DUE',
        trialEndsAt: null,
        planId: 'plan1',
        currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
        plan: { id: 'plan1', expiredFallbackPlanId: null, maxQueueEntriesPerDay: 100, maxQueueEntriesPerPeriod: 1000 },
      },
    });
    (prisma.queueEntry.count as any).mockResolvedValue(0);

    const result = await checkLimit('org1', 'queueEntriesDaily');

    expect(result).toEqual({ current: 0, limit: 0, allowed: false });
  });
});

describe('checkLimit - queueEntriesPeriod', () => {
  beforeEach(() => vi.clearAllMocks());

  it('counts from the subscription currentPeriodStart, not a calendar month', async () => {
    const periodStart = new Date('2026-08-10T00:00:00Z');
    mockActiveOrg({ maxQueueEntriesPerPeriod: 50 }, periodStart);
    (prisma.queueEntry.count as any).mockResolvedValue(20);

    const result = await checkLimit('org1', 'queueEntriesPeriod');

    expect(result).toEqual({ current: 20, limit: 50, allowed: true });
    expect(prisma.queueEntry.count).toHaveBeenCalledWith({
      where: {
        queue: { service: { location: { organizationId: 'org1' } } },
        joinedAt: { gte: periodStart },
      },
    });
  });

  it('blocks once the period count reaches the plan limit', async () => {
    mockActiveOrg({ maxQueueEntriesPerPeriod: 50 });
    (prisma.queueEntry.count as any).mockResolvedValue(50);

    const result = await checkLimit('org1', 'queueEntriesPeriod');

    expect(result).toEqual({ current: 50, limit: 50, allowed: false });
  });
});

describe('checkLimit - add-on boosted limits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('adds active LOCATIONS add-on quantity on top of the plan limit', async () => {
    mockActiveOrg({ maxLocations: 3 });
    (prisma.location.count as any).mockResolvedValue(4);
    (prisma.organizationAddOn.aggregate as any).mockResolvedValue({ _sum: { quantity: 2 } });

    const result = await checkLimit('org1', 'locations');

    expect(result).toEqual({ current: 4, limit: 5, allowed: true });
    expect(prisma.organizationAddOn.aggregate).toHaveBeenCalledWith({
      where: { organizationId: 'org1', resourceType: 'LOCATIONS', status: 'ACTIVE' },
      _sum: { quantity: true },
    });
  });

  it('adds active USERS add-on quantity on top of the plan limit', async () => {
    mockActiveOrg({ maxUsersPerOrg: 5 });
    (prisma.user.count as any).mockResolvedValue(6);
    (prisma.organizationAddOn.aggregate as any).mockResolvedValue({ _sum: { quantity: 3 } });

    const result = await checkLimit('org1', 'users');

    expect(result).toEqual({ current: 6, limit: 8, allowed: true });
  });

  it('treats no active add-ons (null sum) as a zero boost', async () => {
    mockActiveOrg({ maxLocations: 3 });
    (prisma.location.count as any).mockResolvedValue(1);
    (prisma.organizationAddOn.aggregate as any).mockResolvedValue({ _sum: { quantity: null } });

    const result = await checkLimit('org1', 'locations');

    expect(result).toEqual({ current: 1, limit: 3, allowed: true });
  });

  it('does not apply an add-on boost when the subscription is not usable', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({
      subscription: {
        id: 'sub1',
        status: 'PAST_DUE',
        trialEndsAt: null,
        planId: 'plan1',
        currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
        plan: { id: 'plan1', expiredFallbackPlanId: null, maxLocations: 3 },
      },
    });
    (prisma.location.count as any).mockResolvedValue(0);

    const result = await checkLimit('org1', 'locations');

    expect(result).toEqual({ current: 0, limit: 0, allowed: false });
    expect(prisma.organizationAddOn.aggregate).not.toHaveBeenCalled();
  });
});
