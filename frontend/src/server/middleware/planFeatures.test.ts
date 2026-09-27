import { describe, it, expect, vi } from 'vitest';

vi.mock('../lib/prisma', () => ({ default: {} }));
import { normalizePlanFeatures } from './subscription.middleware';

describe('normalizePlanFeatures', () => {
  it('reads keys saved by the old plan editor as the enforced ones', () => {
    expect(normalizePlanFeatures({ multipleLocations: true, whiteLabel: true })).toEqual({ multiLocation: true, customBranding: true });
  });
  it('never lets a legacy false switch off an enforced key', () => {
    expect(normalizePlanFeatures({ multiLocation: true, multipleLocations: false })).toEqual({ multiLocation: true });
  });
  it('passes current keys through and tolerates junk', () => {
    expect(normalizePlanFeatures({ ai: true, analytics: false })).toEqual({ ai: true, analytics: false });
    expect(normalizePlanFeatures(null)).toEqual({});
  });
});
