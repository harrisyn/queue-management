export interface ExpiryInput {
  status: string; // SubscriptionStatus, kept as string here to avoid a Prisma import in a pure lib file
  trialEndsAt: Date | null;
  planId: string;
  expiredFallbackPlanId: string | null;
}

export type ExpiryResolution =
  | { action: 'none' }
  | { action: 'fallback'; newPlanId: string }
  | { action: 'expire' };

// Decides what should happen to a subscription's status/plan on read, given
// the current time. Pure and side-effect free - the caller performs the
// actual DB write based on the returned action.
export function resolveExpiry(subscription: ExpiryInput, now: Date): ExpiryResolution {
  if (subscription.status !== 'TRIAL') {
    return { action: 'none' };
  }
  if (!subscription.trialEndsAt || subscription.trialEndsAt >= now) {
    return { action: 'none' };
  }
  if (subscription.expiredFallbackPlanId) {
    return { action: 'fallback', newPlanId: subscription.expiredFallbackPlanId };
  }
  return { action: 'expire' };
}
