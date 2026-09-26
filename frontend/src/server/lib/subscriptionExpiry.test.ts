import { describe, it, expect } from 'vitest';
import { resolveExpiry } from './subscriptionExpiry';

const NOW = new Date('2026-06-15T00:00:00Z');

describe('resolveExpiry', () => {
  it('does nothing for a non-TRIAL subscription', () => {
    const result = resolveExpiry(
      { status: 'ACTIVE', trialEndsAt: new Date('2026-01-01'), planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'none' });
  });

  it('does nothing for a TRIAL with no trialEndsAt', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: null, planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'none' });
  });

  it('does nothing for a TRIAL that has not expired yet', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: new Date('2026-07-01'), planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'none' });
  });

  it('falls back to the configured plan when a TRIAL has expired and a fallback is set', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: new Date('2026-01-01'), planId: 'p1', expiredFallbackPlanId: 'p0' },
      NOW
    );
    expect(result).toEqual({ action: 'fallback', newPlanId: 'p0' });
  });

  it('expires with no plan change when a TRIAL has expired and there is no fallback', () => {
    const result = resolveExpiry(
      { status: 'TRIAL', trialEndsAt: new Date('2026-01-01'), planId: 'p1', expiredFallbackPlanId: null },
      NOW
    );
    expect(result).toEqual({ action: 'expire' });
  });
});
