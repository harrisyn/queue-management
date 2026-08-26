'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import api from '@/api/client';
import { useAuthContext } from './AuthContext';

// Feature types
export interface SubscriptionFeatures {
  multiLocation: boolean;
  maxLocations: number;
  maxServices: number;
  maxUsers: number;
  smsNotifications: boolean;
  analytics: boolean;
  apiAccess: boolean;
  customBranding: boolean;
  customDomain: boolean;
  serviceFlows: boolean;
  servicePoints: boolean;
}

export interface LimitInfo {
  current: number;
  limit: number;
  allowed: boolean;
}

export interface SubscriptionInfo {
  planId: string | null;
  planName: string | null;
  planCode: string | null;
  status: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
}

interface SubscriptionContextType {
  subscription: SubscriptionInfo | null;
  features: SubscriptionFeatures;
  limits: {
    locations: LimitInfo;
    services: LimitInfo;
    users: LimitInfo;
  };
  activeProviders: string[];
  organizationStatus: 'ACTIVE' | 'PAUSED';
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  hasFeature: (feature: keyof SubscriptionFeatures) => boolean;
  canCreate: (resource: 'locations' | 'services' | 'users') => boolean;
  getRemainingCount: (resource: 'locations' | 'services' | 'users') => number;
}

// Default values for free tier
const DEFAULT_FEATURES: SubscriptionFeatures = {
  multiLocation: false,
  maxLocations: 1,
  maxServices: 3,
  maxUsers: 5,
  smsNotifications: false,
  analytics: false,
  apiAccess: false,
  customBranding: false,
  customDomain: false,
  serviceFlows: false,
  servicePoints: true,
};

const DEFAULT_LIMITS = {
  locations: { current: 0, limit: 1, allowed: true },
  services: { current: 0, limit: 3, allowed: true },
  users: { current: 0, limit: 5, allowed: true },
};

const SubscriptionContext = createContext<SubscriptionContextType | null>(null);

export const SubscriptionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthContext();
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [features, setFeatures] = useState<SubscriptionFeatures>(DEFAULT_FEATURES);
  const [limits, setLimits] = useState(DEFAULT_LIMITS);
  const [activeProviders, setActiveProviders] = useState<string[]>([]);
  const [organizationStatus, setOrganizationStatus] = useState<'ACTIVE' | 'PAUSED'>('ACTIVE');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!isAuthenticated) {
      setSubscription(null);
      setFeatures(DEFAULT_FEATURES);
      setLimits(DEFAULT_LIMITS);
      setActiveProviders([]);
      setOrganizationStatus('ACTIVE');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await api.getMySubscription();
      setSubscription(data.subscription);
      // Only backfill DEFAULT_FEATURES when there's no subscription at all.
      // When the backend deliberately sends `features: {}` for an
      // EXPIRED-no-fallback org (a locked-down account), merging in the
      // defaults here would silently re-enable every feature client-side
      // and undo the lockdown.
      setFeatures(data.subscription === null ? { ...DEFAULT_FEATURES, ...data.features } : { ...data.features } as typeof DEFAULT_FEATURES);
      setLimits(data.limits);
      setActiveProviders(data.activeProviders || []);
      setOrganizationStatus(data.organizationStatus || 'ACTIVE');
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
      setError('Failed to load subscription info');
      // Use defaults on error
      setSubscription(null);
      setFeatures(DEFAULT_FEATURES);
      setLimits(DEFAULT_LIMITS);
      setActiveProviders([]);
      setOrganizationStatus('ACTIVE');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const hasFeature = useCallback((feature: keyof SubscriptionFeatures): boolean => {
    return !!features[feature];
  }, [features]);

  const canCreate = useCallback((resource: 'locations' | 'services' | 'users'): boolean => {
    return limits[resource].allowed;
  }, [limits]);

  const getRemainingCount = useCallback((resource: 'locations' | 'services' | 'users'): number => {
    const { current, limit } = limits[resource];
    return Math.max(0, limit - current);
  }, [limits]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        features,
        limits,
        activeProviders,
        organizationStatus,
        loading,
        error,
        refresh: fetchSubscription,
        hasFeature,
        canCreate,
        getRemainingCount,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
};

// Feature gate component - renders children only if feature is available
export const FeatureGate: React.FC<{
  feature: keyof SubscriptionFeatures;
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ feature, children, fallback = null }) => {
  const { hasFeature, loading } = useSubscription();

  if (loading) return null;
  if (!hasFeature(feature)) return <>{fallback}</>;
  return <>{children}</>;
};

// Limit gate component - renders children only if limit allows creation
export const LimitGate: React.FC<{
  resource: 'locations' | 'services' | 'users';
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ resource, children, fallback = null }) => {
  const { canCreate, loading } = useSubscription();

  if (loading) return null;
  if (!canCreate(resource)) return <>{fallback}</>;
  return <>{children}</>;
};

// Upgrade prompt component
export const UpgradePrompt: React.FC<{
  feature?: keyof SubscriptionFeatures;
  resource?: 'locations' | 'services' | 'users';
  className?: string;
}> = ({ feature, resource, className }) => {
  const { features, limits } = useSubscription();

  let message = 'Upgrade your plan to access this feature.';
  
  if (feature) {
    const featureNames: Record<keyof SubscriptionFeatures, string> = {
      multiLocation: 'Multiple Locations',
      maxLocations: 'More Locations',
      maxServices: 'More Services',
      maxUsers: 'More Users',
      smsNotifications: 'SMS Notifications',
      analytics: 'Analytics Dashboard',
      apiAccess: 'API Access',
      customBranding: 'Custom Branding',
      customDomain: 'Custom Domain',
      serviceFlows: 'Service Flows',
      servicePoints: 'Service Points',
    };
    message = `Upgrade to access ${featureNames[feature]}.`;
  }

  if (resource) {
    const limit = limits[resource];
    message = `You've reached the limit of ${limit.limit} ${resource}. Upgrade to add more.`;
  }

  return (
    <div 
      className={className}
      style={{
        padding: '16px 20px',
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        borderRadius: '8px',
        border: '1px solid #f59e0b',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2">
        <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, color: '#92400e', fontWeight: 500 }}>{message}</p>
      </div>
      <button
        onClick={() => window.location.href = '/admin/billing'}
        style={{
          padding: '8px 16px',
          background: '#f59e0b',
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Upgrade
      </button>
    </div>
  );
};

export default SubscriptionContext;
