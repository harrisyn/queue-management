import { describe, it, expect, vi, beforeEach } from 'vitest';
import { wasAlreadyProcessed, markProcessed } from './idempotency';
import prisma from '../../lib/prisma';

vi.mock('../../lib/prisma', () => ({
  default: {
    processedWebhookEvent: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}));

describe('idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when no matching event has been processed', async () => {
    (prisma.processedWebhookEvent.findUnique as any).mockResolvedValue(null);
    const result = await wasAlreadyProcessed('stripe', 'evt_1');
    expect(result).toBe(false);
  });

  it('returns true when a matching event was already processed', async () => {
    (prisma.processedWebhookEvent.findUnique as any).mockResolvedValue({ id: 'x', provider: 'stripe', eventId: 'evt_1' });
    const result = await wasAlreadyProcessed('stripe', 'evt_1');
    expect(result).toBe(true);
  });

  it('markProcessed creates a record with the provider and eventId', async () => {
    await markProcessed('stripe', 'evt_1');
    expect(prisma.processedWebhookEvent.create).toHaveBeenCalledWith({
      data: { provider: 'stripe', eventId: 'evt_1' },
    });
  });
});
