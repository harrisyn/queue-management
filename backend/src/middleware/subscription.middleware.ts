import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

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
    const subscription = org?.subscription ?? null;

    if (!subscription || subscription.status !== 'ACTIVE') {
      req.subscription = {
        planId: null,
        planName: null,
        status: subscription?.status || null,
        features: DEFAULT_FEATURES,
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
  const subscription = org?.subscription ?? null;

  const features = subscription?.plan?.features as SubscriptionFeatures || DEFAULT_FEATURES;

  let current = 0;
  let limit = 0;

  switch (limitType) {
    case 'locations':
      current = await prisma.location.count({ where: { organizationId } });
      limit = features.maxLocations || DEFAULT_FEATURES.maxLocations || 1;
      break;
    case 'services':
      current = await prisma.service.count({
        where: { location: { organizationId } },
      });
      limit = features.maxServices || DEFAULT_FEATURES.maxServices || 3;
      break;
    case 'users':
      current = await prisma.user.count({ where: { organizationId } });
      limit = features.maxUsers || DEFAULT_FEATURES.maxUsers || 5;
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
  const subscription = org?.subscription ?? null;

  if (!subscription || subscription.status !== 'ACTIVE') {
    return DEFAULT_FEATURES;
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
    const subscription = org?.subscription ?? null;

    const features = subscription?.plan?.features as SubscriptionFeatures || DEFAULT_FEATURES;
    const mergedFeatures = { ...DEFAULT_FEATURES, ...features };

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
          limit: mergedFeatures.maxLocations || 1,
          allowed: locationCount < (mergedFeatures.maxLocations || 1),
        },
        services: {
          current: serviceCount,
          limit: mergedFeatures.maxServices || 3,
          allowed: serviceCount < (mergedFeatures.maxServices || 3),
        },
        users: {
          current: userCount,
          limit: mergedFeatures.maxUsers || 5,
          allowed: userCount < (mergedFeatures.maxUsers || 5),
        },
      },
      activeProviders,
    });
  } catch (error) {
    console.error('Error getting subscription:', error);
    return res.status(500).json({ error: 'Failed to get subscription info' });
  }
};
