import { describe, it, expect, vi, beforeEach } from 'vitest';

const state = {
  features: {} as Record<string, unknown>,
  packs: 0,
  trialStartedAt: null as Date | null,
  items: 0,
  updated: null as unknown,
};

vi.mock('../lib/prisma', () => ({
  default: {
    organization: {
      findUnique: vi.fn(async () => ({ displayMediaTrialStartedAt: state.trialStartedAt })),
      update: vi.fn(async (args: unknown) => { state.updated = args; return {}; }),
    },
    displayMedia: { count: vi.fn(async () => state.items), findFirst: vi.fn(async () => ({ createdAt: new Date() })) },
  },
}));
vi.mock('../middleware/subscription.middleware', () => ({
  getOrganizationFeatures: vi.fn(async () => state.features),
  addOnBoost: vi.fn(async () => state.packs),
}));

import { getDisplayEntitlement, assertCanAddMedia, DisplayMediaLimitError } from './displayEntitlement';

beforeEach(() => {
  Object.assign(state, { features: {}, packs: 0, trialStartedAt: null, items: 0, updated: null });
});

describe('lobby adverts entitlement', () => {
  it('offers free plans a trial that starts on first use', async () => {
    expect((await getDisplayEntitlement('o')).status).toBe('trial_available');
    await assertCanAddMedia('o', { kind: 'IMAGE' });
    expect(state.updated).toBeTruthy();
  });

  it('starts the trial from existing media added before trials existed', async () => {
    state.items = 2;
    expect((await getDisplayEntitlement('o')).status).toBe('trial');
  });

  it('stops playing when the trial ends', async () => {
    state.trialStartedAt = new Date(Date.now() - 15 * 86400000);
    const e = await getDisplayEntitlement('o');
    expect(e.status).toBe('trial_ended');
    expect(e.allowed).toBe(false);
    await expect(assertCanAddMedia('o', { kind: 'IMAGE' })).rejects.toBeInstanceOf(DisplayMediaLimitError);
  });

  it('gives paid plans a capped playlist without streams or big files', async () => {
    state.features = { displayMedia: true, displayMediaItems: 5 };
    state.items = 5;
    await expect(assertCanAddMedia('o', { kind: 'IMAGE' })).rejects.toThrow(/5 playlist items/);
    state.items = 1;
    await expect(assertCanAddMedia('o', { kind: 'STREAM' })).rejects.toThrow(/media pack/);
    await expect(assertCanAddMedia('o', { kind: 'VIDEO', bytes: 10 * 1024 * 1024 })).rejects.toThrow(/over 4MB/);
  });

  it('unlocks streams, big files and more items with a media pack', async () => {
    state.features = { displayMedia: true };
    state.packs = 1;
    const e = await getDisplayEntitlement('o');
    expect(e).toMatchObject({ status: 'pack', streaming: true, maxItems: 30 });
    await expect(assertCanAddMedia('o', { kind: 'STREAM', bytes: 100 * 1024 * 1024 })).resolves.toBeTruthy();
  });
});
