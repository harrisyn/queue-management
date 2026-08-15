import { describe, it, expect } from 'vitest';
import { resolveStripeInterval } from './stripe.provider';

describe('resolveStripeInterval', () => {
  it('maps monthly to a 1-month interval', () => {
    expect(resolveStripeInterval('monthly')).toEqual({ interval: 'month', interval_count: 1 });
  });

  it('maps quarterly to a 3-month interval', () => {
    expect(resolveStripeInterval('quarterly')).toEqual({ interval: 'month', interval_count: 3 });
  });

  it('maps yearly to a 1-year interval', () => {
    expect(resolveStripeInterval('yearly')).toEqual({ interval: 'year', interval_count: 1 });
  });
});
