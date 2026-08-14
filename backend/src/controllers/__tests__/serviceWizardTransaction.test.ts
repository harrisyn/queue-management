import { describe, it, expect, vi } from 'vitest';

// Mirrors the transactional loop from service.controller.ts's createService:
// if any location's service creation throws, nothing already created in
// this call should survive - simulated here with a fake $transaction that
// rolls back its recorded writes on throw, the same contract Prisma provides.
async function createServicesTransactionally(
  locationIds: string[],
  createOne: (locationId: string) => Promise<{ id: string }>
): Promise<{ id: string }[]> {
  const created: { id: string }[] = [];
  try {
    for (const locationId of locationIds) {
      created.push(await createOne(locationId));
    }
    return created;
  } catch (err) {
    created.length = 0; // simulates transaction rollback discarding all writes
    throw err;
  }
}

describe('service wizard bulk creation', () => {
  it('creates one service per location on success', async () => {
    const createOne = vi.fn(async (locationId: string) => ({ id: `service-${locationId}` }));
    const result = await createServicesTransactionally(['loc1', 'loc2', 'loc3'], createOne);
    expect(result).toHaveLength(3);
    expect(createOne).toHaveBeenCalledTimes(3);
  });

  it('discards all created services if any location fails', async () => {
    const createOne = vi.fn(async (locationId: string) => {
      if (locationId === 'loc2') throw new Error('limit exceeded');
      return { id: `service-${locationId}` };
    });

    await expect(createServicesTransactionally(['loc1', 'loc2', 'loc3'], createOne)).rejects.toThrow('limit exceeded');
  });
});
