import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/prisma', () => ({
  default: {
    organization: { findUnique: vi.fn() },
    queueEntry: { count: vi.fn() },
    location: { count: vi.fn() },
    user: { count: vi.fn() },
    organizationAddOn: { aggregate: vi.fn() },
    creditLedgerEntry: { aggregate: vi.fn(), create: vi.fn() },
  },
}));

import prisma from '../lib/prisma';
import { checkLimit, consumeCredits } from './subscription.middleware';

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

function mockOrgWithCreditAllowance(allowance: number | null, periodStart = new Date('2026-08-01T00:00:00Z')) {
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
        creditAllowances: [{ creditType: 'AI', monthlyAllowance: allowance }],
      },
    },
  });
}

describe('consumeCredits', () => {
  beforeEach(() => vi.clearAllMocks());

  it('always allows and writes no ledger entry when the allowance is unlimited (null)', async () => {
    mockOrgWithCreditAllowance(null);

    const result = await consumeCredits('org1', 'AI', 10, 'test');

    expect(result).toEqual({ allowed: true, remaining: null });
    expect(prisma.creditLedgerEntry.aggregate).not.toHaveBeenCalled();
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('always allows and writes no ledger entry when no allowance row exists for the type', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({
      subscription: {
        id: 'sub1', status: 'ACTIVE', trialEndsAt: null, planId: 'plan1',
        currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
        plan: { id: 'plan1', expiredFallbackPlanId: null, creditAllowances: [] },
      },
    });

    const result = await consumeCredits('org1', 'AI', 10, 'test');

    expect(result).toEqual({ allowed: true, remaining: null });
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });

  function mockLedgerSums(grants: number | null, consumption: number | null) {
    (prisma.creditLedgerEntry.aggregate as any).mockImplementation(async (args: any) => {
      if (args.where.amount?.gt !== undefined) return { _sum: { amount: grants } };
      if (args.where.amount?.lt !== undefined) return { _sum: { amount: consumption } };
      throw new Error('unexpected aggregate call shape');
    });
  }

  it('consumes credits and returns the correct remaining balance', async () => {
    mockOrgWithCreditAllowance(100);
    mockLedgerSums(null, -20); // 80 used so far, no extra grants

    const result = await consumeCredits('org1', 'AI', 10, 'test consumption');

    expect(result).toEqual({ allowed: true, remaining: 70 });
    expect(prisma.creditLedgerEntry.create).toHaveBeenCalledWith({
      data: { organizationId: 'org1', creditType: 'AI', amount: -10, reason: 'test consumption' },
    });
  });

  it('adds extra grants on top of the plan allowance', async () => {
    mockOrgWithCreditAllowance(100);
    mockLedgerSums(30, -20); // 100 plan + 30 granted = 130 allowance; 20 already used -> 110 balance before this request

    const result = await consumeCredits('org1', 'AI', 10, 'test consumption');

    expect(result).toEqual({ allowed: true, remaining: 100 });
  });

  it('regression: a grant with zero consumption never produces a negative balance', async () => {
    mockOrgWithCreditAllowance(50);
    mockLedgerSums(20, null); // granted 20 extra, nothing consumed -> balance 70, not -20

    // A no-op probe: request 0 credits just to read the resolved balance via `remaining`.
    const result = await consumeCredits('org1', 'AI', 0, 'probe');

    expect(result.remaining).toBe(70);
  });

  it('rejects consumption and writes nothing when the balance is insufficient', async () => {
    mockOrgWithCreditAllowance(100);
    mockLedgerSums(null, -95); // 5 remaining

    const result = await consumeCredits('org1', 'AI', 10, 'test consumption');

    expect(result).toEqual({ allowed: false, remaining: 5 });
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });

  it('only counts ledger entries from the current billing period', async () => {
    const periodStart = new Date('2026-08-10T00:00:00Z');
    mockOrgWithCreditAllowance(100, periodStart);
    mockLedgerSums(null, null);

    const result = await consumeCredits('org1', 'AI', 10, 'test');

    expect(result).toEqual({ allowed: true, remaining: 90 });
    expect(prisma.creditLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { organizationId: 'org1', creditType: 'AI', createdAt: { gte: periodStart }, amount: { gt: 0 } },
      _sum: { amount: true },
    });
    expect(prisma.creditLedgerEntry.aggregate).toHaveBeenCalledWith({
      where: { organizationId: 'org1', creditType: 'AI', createdAt: { gte: periodStart }, amount: { lt: 0 } },
      _sum: { amount: true },
    });
  });

  it('hard-blocks when the subscription is not usable', async () => {
    (prisma.organization.findUnique as any).mockResolvedValue({
      subscription: {
        id: 'sub1', status: 'PAST_DUE', trialEndsAt: null, planId: 'plan1',
        currentPeriodStart: new Date('2026-08-01T00:00:00Z'),
        plan: { id: 'plan1', expiredFallbackPlanId: null, creditAllowances: [{ creditType: 'AI', monthlyAllowance: 100 }] },
      },
    });

    const result = await consumeCredits('org1', 'AI', 10, 'test');

    expect(result).toEqual({ allowed: false, remaining: 0 });
    expect(prisma.creditLedgerEntry.create).not.toHaveBeenCalled();
  });
});
