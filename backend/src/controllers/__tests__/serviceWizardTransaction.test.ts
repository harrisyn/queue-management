import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma the same way idempotency.test.ts does, so createService's real
// transactional logic runs against mocked Prisma calls instead of a fake
// stand-in helper.
vi.mock('../../lib/prisma', () => ({
  default: {
    location: { findMany: vi.fn() },
    user: { findUnique: vi.fn() },
    servicePoint: { findMany: vi.fn() },
    servicePointService: { findMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock('../../middleware/subscription.middleware', () => ({
  checkLimit: vi.fn(),
}));

import prisma from '../../lib/prisma';
import { checkLimit } from '../../middleware/subscription.middleware';
import { createService } from '../service.controller';

function makeRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe('createService transactional behavior (real controller, mocked Prisma)', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    (prisma.location.findMany as any).mockImplementation(async ({ where }: any) => {
      const ids: string[] = where.id.in;
      return ids.map(id => ({ id, organizationId: where.organizationId }));
    });
    (prisma.user.findUnique as any).mockResolvedValue({ organizationId: 'org1' });
    (checkLimit as any).mockResolvedValue({ current: 0, limit: 10, allowed: true });

    // Real Prisma's $transaction invokes the callback with a tx client and
    // propagates a callback rejection (rolling back), which is exactly the
    // contract this mock reproduces.
    (prisma.$transaction as any).mockImplementation(async (callback: any) => {
      return await callback(mockTx);
    });
  });

  let mockTx: any;

  beforeEach(() => {
    mockTx = {
      service: {
        create: vi.fn(async ({ data }: any) => ({ id: `service-${data.locationId}`, ...data })),
      },
      servicePointService: {
        create: vi.fn(async ({ data }: any) => ({ id: `link-${data.servicePointId}-${data.serviceId}`, ...data })),
      },
    };
  });

  it('creates one service per location and returns them all when every location succeeds', async () => {
    const req: any = {
      body: {
        name: 'General Consultation',
        locationIds: ['loc1', 'loc2', 'loc3'],
      },
      user: { userId: 'user1' },
    };
    const res = makeRes();
    const next = vi.fn();

    await createService(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockTx.service.create).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(201);
    const payload = res.json.mock.calls[0][0];
    expect(payload.services).toHaveLength(3);
    expect(payload.services.map((s: any) => s.locationId)).toEqual(['loc1', 'loc2', 'loc3']);
  });

  it('rolls back and reports an error if any location fails mid-transaction', async () => {
    mockTx.service.create = vi.fn(async ({ data }: any) => {
      if (data.locationId === 'loc2') {
        throw new Error('simulated failure on loc2');
      }
      return { id: `service-${data.locationId}`, ...data };
    });

    const req: any = {
      body: {
        name: 'General Consultation',
        locationIds: ['loc1', 'loc2', 'loc3'],
      },
      user: { userId: 'user1' },
    };
    const res = makeRes();
    const next = vi.fn();

    await createService(req, res, next);

    // service.controller.ts's createService funnels errors to next(error)
    // rather than responding with 201 - confirm the failure surfaces there.
    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(next.mock.calls[0][0].message).toBe('simulated failure on loc2');
    expect(res.status).not.toHaveBeenCalledWith(201);
    expect(mockTx.service.create).toHaveBeenCalledTimes(2);
  });
});
