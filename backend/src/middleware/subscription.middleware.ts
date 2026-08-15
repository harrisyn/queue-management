import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { resolveExpiry } from '../lib/subscriptionExpiry';

// Feature keys that can be checked
export type FeatureKey = 
  | 'multiLocation'
  | 'maxLocations'
  | 'maxServices'
  | 'maxUsers'
  | 'smsNotifications'
  | 'analytics'
  | 'apiAccess'
  | 'customBranding'
  | 'serviceFlows'
  | 'servicePoints';

interface SubscriptionFeatures {
  multiLocation?: boolean;
  maxLocations?: number;
  maxServices?: number;
  maxUsers?: number;
  smsNotifications?: boolean;
  analytics?: boolean;
  apiAccess?: boolean;
  customBranding?: boolean;
  serviceFlows?: boolean;
  servicePoints?: boolean;
}

// Default features for organizations without a subscription (free tier)
const DEFAULT_FEATURES: SubscriptionFeatures = {
  multiLocation: false,
  maxLocations: 1,
  maxServices: 3,
  maxUsers: 5,
  smsNotifications: false,
  analytics: false,
  apiAccess: false,
  customBranding: false,
  serviceFlows: false,
  servicePoints: true,
};

// Applies resolveExpiry's decision to a subscription row, writing the
// resulting state to the DB if anything changed. Returns the up-to-date
// subscription (with `plan` freshly re-fetched if the plan changed).
async function applyExpiryIfNeeded<T extends {
  id: string;
  status: string;
  trialEndsAt: Date | null;
  planId: string;
  plan: { id: string; expiredFallbackPlanId: string | null };
}>(subscription: T): Promise<T> {
  const resolution = resolveExpiry(
    { status: subscription.status, trialEndsAt: subscription.trialEndsAt, planId: subscription.planId, expiredFallbackPlanId: subscription.plan.expiredFallbackPlanId },
    new Date()
  );

  if (resolution.action === 'none') {
    return subscription;
  }

  if (resolution.action === 'expire') {
    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    return { ...subscription, status: 'EXPIRED' };
  }

  // action === 'fallback'
  const fallbackPlan = await prisma.subscriptionPlan.findUnique({ where: { id: resolution.newPlanId } });
  if (!fallbackPlan) {
    // Misconfigured fallback (plan was deleted) - fall through to expire rather than crash.
    await prisma.organizationSubscription.update({
      where: { id: subscription.id },
      data: { status: 'EXPIRED' },
    });
    return { ...subscription, status: 'EXPIRED' };
  }

  const now = new Date();
  const newStatus = fallbackPlan.trialDurationDays ? 'TRIAL' : 'ACTIVE';
  const newTrialEndsAt = fallbackPlan.trialDurationDays
    ? new Date(now.getTime() + fallbackPlan.trialDurationDays * 24 * 60 * 60 * 1000)
    : null;

  const updated = await prisma.organizationSubscription.update({
    where: { id: subscription.id },
    data: {
      planId: fallbackPlan.id,
      status: newStatus,
      trialEndsAt: newTrialEndsAt,
      currentPeriodStart: now,
      currentPeriodEnd: newTrialEndsAt || new Date(now.getFullYear() + 1, now.getMonth(), now.getDate()),
    },
    include: { plan: true },
  });

  return updated as unknown as T;
}

// Extend Request to include subscription info
declare global {
  namespace Express {
    interface Request {
      subscription?: {
        planId: string | null;
        planName: string | null;
        status: string | null;
        features: SubscriptionFeatures;
      };
    }
  }
}

/**
 * Middleware to load subscription features for the current user's organization
 */
export const loadSubscription = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      req.subscription = {
        planId: null,
        planName: null,
        status: null,
        features: DEFAULT_FEATURES,
      };
      return next();
    }

    // Get user's organization
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      req.subscription = {
        planId: null,
        planName: null,
        status: null,
        features: DEFAULT_FEATURES,
      };
      return next();
    }

    // Get organization's subscription (subscription lives on Organization.subscriptionId,
    // not the other way around — OrganizationSubscription has no organizationId field)
    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscription: { include: { plan: true } } },
    });
    let subscription = org?.subscription ?? null;

    if (subscription) {
      subscription = await applyExpiryIfNeeded(subscription);
    }

    if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL')) {
      // EXPIRED (with no fallback plan) is a deliberate lockdown state — the
      // org should see no features, not the wide-open DEFAULT_FEATURES set
      // that unauthenticated/no-org requests get. Matches getOrganizationFeatures.
      req.subscription = {
        planId: null,
        planName: null,
        status: subscription?.status || null,
        features: subscription?.status === 'EXPIRED' ? {} : DEFAULT_FEATURES,
      };
      return next();
    }

    req.subscription = {
      planId: subscription.planId,
      planName: subscription.plan.name,
      status: subscription.status,
      features: {
        ...DEFAULT_FEATURES,
        ...(subscription.plan.features as SubscriptionFeatures),
      },
    };

    next();
  } catch (error) {
    console.error('Error loading subscription:', error);
    // Don't block request on subscription errors, use defaults
    req.subscription = {
      planId: null,
      planName: null,
      status: null,
      features: DEFAULT_FEATURES,
    };
    next();
  }
};

/**
 * Middleware factory to require a specific boolean feature
 */
export const requireFeature = (feature: FeatureKey) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const features = req.subscription?.features || DEFAULT_FEATURES;
    const hasFeature = features[feature];

    if (!hasFeature) {
      return res.status(403).json({
        error: 'Feature not available',
        message: `Your subscription plan does not include the "${feature}" feature. Please upgrade your plan.`,
        feature,
        upgradeRequired: true,
      });
    }

    next();
  };
};

/**
 * Check if organization has reached a limit
 * Returns the current count and limit
 */
export const checkLimit = async (
  organizationId: string,
  limitType: 'locations' | 'services' | 'users'
): Promise<{ current: number; limit: number; allowed: boolean }> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  let subscription = org?.subscription ?? null;
  if (subscription) {
    subscription = await applyExpiryIfNeeded(subscription);
  }

  const isUsable = subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL');
  // Limit numbers live on the plan's dedicated columns (maxLocations /
  // maxServicesPerLoc / maxUsersPerOrg), not in the features JSON blob —
  // nothing populates those keys in `features`. An unusable subscription
  // (e.g. EXPIRED with no fallback) still resolves to a hard 0, matching
  // the previous features-based fallback behavior for that case.
  const planLimits = isUsable
    ? {
        maxLocations: subscription!.plan.maxLocations,
        maxServicesPerLoc: subscription!.plan.maxServicesPerLoc,
        maxUsersPerOrg: subscription!.plan.maxUsersPerOrg,
      }
    : { maxLocations: 0, maxServicesPerLoc: 0, maxUsersPerOrg: 0 };

  let current = 0;
  let limit = 0;

  switch (limitType) {
    case 'locations':
      current = await prisma.location.count({ where: { organizationId } });
      limit = planLimits.maxLocations ?? DEFAULT_FEATURES.maxLocations ?? 1;
      break;
    case 'services':
      current = await prisma.service.count({
        where: { location: { organizationId } },
      });
      limit = planLimits.maxServicesPerLoc ?? DEFAULT_FEATURES.maxServices ?? 3;
      break;
    case 'users':
      current = await prisma.user.count({ where: { organizationId } });
      limit = planLimits.maxUsersPerOrg ?? DEFAULT_FEATURES.maxUsers ?? 5;
      break;
  }

  return {
    current,
    limit,
    allowed: current < limit,
  };
};

/**
 * Middleware factory to enforce count limits before creating resources
 */
export const enforceLimit = (limitType: 'locations' | 'services' | 'users') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const user = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        return res.status(400).json({ error: 'User has no organization' });
      }

      const { current, limit, allowed } = await checkLimit(user.organizationId, limitType);

      if (!allowed) {
        const resourceName = limitType.slice(0, -1); // Remove 's' to get singular
        return res.status(403).json({
          error: 'Limit reached',
          message: `You have reached the maximum number of ${limitType} (${limit}) for your subscription plan. Please upgrade to add more.`,
          limitType,
          current,
          limit,
          upgradeRequired: true,
        });
      }

      next();
    } catch (error) {
      console.error(`Error checking ${limitType} limit:`, error);
      return res.status(500).json({ error: 'Failed to check subscription limits' });
    }
  };
};

/**
 * Get subscription info for a specific organization
 */
export const getOrganizationFeatures = async (organizationId: string): Promise<SubscriptionFeatures> => {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { subscription: { include: { plan: true } } },
  });
  let subscription = org?.subscription ?? null;
  if (subscription) {
    subscription = await applyExpiryIfNeeded(subscription);
  }

  if (!subscription || (subscription.status !== 'ACTIVE' && subscription.status !== 'TRIAL')) {
    return subscription?.status === 'EXPIRED' ? {} : DEFAULT_FEATURES;
  }

  return {
    ...DEFAULT_FEATURES,
    ...(subscription.plan.features as SubscriptionFeatures),
  };
};

/**
 * Endpoint to get current user's subscription info
 */
export const getMySubscription = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { organizationId: true },
    });

    const activeProviderRows = await prisma.paymentProviderConfig.findMany({
      where: { isActive: true },
      select: { provider: true },
    });
    const activeProviders = activeProviderRows.map(r => r.provider);

    if (!user?.organizationId) {
      return res.json({
        subscription: null,
        features: DEFAULT_FEATURES,
        limits: {
          locations: { current: 0, limit: DEFAULT_FEATURES.maxLocations, allowed: true },
          services: { current: 0, limit: DEFAULT_FEATURES.maxServices, allowed: true },
          users: { current: 0, limit: DEFAULT_FEATURES.maxUsers, allowed: true },
        },
        activeProviders,
      });
    }

    const org = await prisma.organization.findUnique({
      where: { id: user.organizationId },
      select: { subscription: { include: { plan: true } } },
    });
    let subscription = org?.subscription ?? null;
    if (subscription) {
      subscription = await applyExpiryIfNeeded(subscription);
    }

    const isExpiredNoFallback = subscription?.status === 'EXPIRED';
    const isUsable = subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL');
    const features = (isUsable ? subscription!.plan.features : {}) as SubscriptionFeatures;
    const mergedFeatures = isExpiredNoFallback ? {} : { ...DEFAULT_FEATURES, ...features };
    // Limit numbers come from the plan's dedicated columns, not the features
    // JSON blob (nothing populates maxLocations/etc there). An unusable
    // subscription (EXPIRED, no fallback) resolves to a hard 0 rather than
    // falling back to DEFAULT_FEATURES, so the lockdown actually locks.
    const planLimits: { maxLocations?: number | null; maxServicesPerLoc?: number | null; maxUsersPerOrg?: number | null } = isUsable
      ? {
          maxLocations: subscription!.plan.maxLocations,
          maxServicesPerLoc: subscription!.plan.maxServicesPerLoc,
          maxUsersPerOrg: subscription!.plan.maxUsersPerOrg,
        }
      : {};
    // EXPIRED-no-fallback is a hard lockdown (0, no DEFAULT_FEATURES
    // fallback). Any other non-usable state (no subscription, PAST_DUE,
    // etc.) still falls back to DEFAULT_FEATURES, same as `mergedFeatures`.
    const mergedLimits = isExpiredNoFallback
      ? { maxLocations: 0, maxServicesPerLoc: 0, maxUsersPerOrg: 0 }
      : {
          maxLocations: planLimits.maxLocations ?? DEFAULT_FEATURES.maxLocations ?? 0,
          maxServicesPerLoc: planLimits.maxServicesPerLoc ?? DEFAULT_FEATURES.maxServices ?? 0,
          maxUsersPerOrg: planLimits.maxUsersPerOrg ?? DEFAULT_FEATURES.maxUsers ?? 0,
        };

    let upgradePlan: { id: string; name: string } | null = null;
    if (subscription?.plan.upgradePlanId) {
      const upgrade = await prisma.subscriptionPlan.findUnique({
        where: { id: subscription.plan.upgradePlanId },
        select: { id: true, name: true },
      });
      upgradePlan = upgrade;
    } else if (!subscription) {
      // No subscription at all - shouldn't happen post-backfill, but if it
      // does, point at whatever plan is currently marked isDefault so the
      // upsell still has somewhere to send the user.
      const defaultPlan = await prisma.subscriptionPlan.findFirst({ where: { isDefault: true }, select: { id: true, name: true } });
      upgradePlan = defaultPlan;
    }

    // Get current counts
    const [locationCount, serviceCount, userCount] = await Promise.all([
      prisma.location.count({ where: { organizationId: user.organizationId } }),
      prisma.service.count({ where: { location: { organizationId: user.organizationId } } }),
      prisma.user.count({ where: { organizationId: user.organizationId } }),
    ]);

    return res.json({
      subscription: subscription ? {
        planId: subscription.planId,
        planName: subscription.plan.name,
        planCode: subscription.plan.code,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        trialEndsAt: subscription.trialEndsAt,
      } : null,
      features: mergedFeatures,
      limits: {
        locations: {
          current: locationCount,
          limit: mergedLimits.maxLocations,
          allowed: locationCount < mergedLimits.maxLocations,
        },
        services: {
          current: serviceCount,
          limit: mergedLimits.maxServicesPerLoc,
          allowed: serviceCount < mergedLimits.maxServicesPerLoc,
        },
        users: {
          current: userCount,
          limit: mergedLimits.maxUsersPerOrg,
          allowed: userCount < mergedLimits.maxUsersPerOrg,
        },
      },
      activeProviders,
      upgradePlan,
      isExpiredNoFallback,
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    return res.status(500).json({ error: 'Failed to get subscription info' });
  }
};
