'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, CreditCard } from 'lucide-react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { Button, Card, Badge, PageHeader, Icon } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceQuarterly: string;
  priceYearly: string;
  currency: string;
  maxLocations: number | null;
  maxServicesPerLoc: number | null;
  maxUsersPerOrg: number | null;
  maxQueueEntriesPerDay: number | null;
  features: Record<string, boolean>;
  tierRank: number;
  isDefault: boolean;
  isRecommended: boolean;
}

interface SubscriptionData {
  subscription: {
    planId: string;
    planName: string;
    planCode: string;
    status: string;
    currentPeriodEnd: string | null;
    trialEndsAt: string | null;
  } | null;
  activeProviders: ('stripe' | 'paystack')[];
  upgradePlan: { id: string; name: string } | null;
  isExpiredNoFallback: boolean;
}

type BillingCycle = 'monthly' | 'quarterly' | 'yearly';

const CYCLE_MONTHS: Record<BillingCycle, number> = { monthly: 1, quarterly: 3, yearly: 12 };

const FEATURE_LABELS: Record<string, string> = {
  multiLocation: 'Multiple locations',
  smsNotifications: 'SMS notifications',
  analytics: 'Analytics dashboard',
  apiAccess: 'API access',
  customBranding: 'Custom branding',
  serviceFlows: 'Service flows',
  servicePoints: 'Service points',
};

function priceForCycle(plan: Plan, cycle: BillingCycle): number {
  if (cycle === 'quarterly') return Number(plan.priceQuarterly);
  if (cycle === 'yearly') return Number(plan.priceYearly);
  return Number(plan.priceMonthly);
}

function savingsPercent(plan: Plan, cycle: BillingCycle): number | null {
  const monthly = Number(plan.priceMonthly);
  if (monthly === 0 || cycle === 'monthly') return null;
  const cyclePrice = priceForCycle(plan, cycle);
  const equivalentMonthlyTotal = monthly * CYCLE_MONTHS[cycle];
  if (equivalentMonthlyTotal === 0) return null;
  const pct = Math.round((1 - cyclePrice / equivalentMonthlyTotal) * 100);
  return pct > 0 ? pct : null;
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');

  useEffect(() => {
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [subData, plansData] = await Promise.all([
        api.getMySubscription(),
        api.getPlans(),
      ]);
      setData(subData);
      setPlans(plansData);
    } catch (err) {
      console.error('Failed to load billing info', err);
    } finally {
      setLoading(false);
    }
  };

  const handleChoosePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    const isFree = plan && Number(plan.priceMonthly) === 0 && Number(plan.priceQuarterly) === 0 && Number(plan.priceYearly) === 0;
    if (isFree) {
      try {
        await api.switchToFreePlan(planId);
        await load();
      } catch (err) {
        console.error('Failed to switch plan', err);
        alert('Could not switch plans. Please try again.');
      }
      return;
    }
    setCheckoutPlanId(planId);
  };

  const handleCheckout = async (provider: 'stripe' | 'paystack') => {
    if (!checkoutPlanId) return;
    try {
      const { redirectUrl } = await api.createSubscriptionCheckout({
        planId: checkoutPlanId,
        provider,
        billingCycle,
      });
      window.location.href = redirectUrl;
    } catch (err) {
      console.error('Checkout failed', err);
      alert('Could not start checkout. Please try again.');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      </Layout>
    );
  }

  const currentPlanCode = data?.subscription?.planCode;
  const currentPlanId = data?.subscription?.planId;
  const currentPlanTierRank = plans.find(p => p.code === currentPlanCode)?.tierRank ?? -1;
  const activeProviders = data?.activeProviders || [];

  return (
    <Layout>
      <div>
        <PageHeader
          icon={CreditCard}
          title="Billing"
          subtitle={
            data?.subscription
              ? `Current plan: ${data.subscription.planName} (${data.subscription.status})`
              : 'No active subscription'
          }
        />

        {data?.isExpiredNoFallback && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#fef2f2', border: '1px solid #fca5a5', color: '#991b1b' }}>
            Your trial has ended. Choose a plan below to restore full access — your existing data is safe and untouched.
          </Card>
        )}

        {activeProviders.length === 0 && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
            No payment providers are configured yet. Please check back later.
          </Card>
        )}

        {data?.upgradePlan && data.upgradePlan.id !== currentPlanId && (() => {
          const upgradeTargetPlan = plans.find(p => p.id === data.upgradePlan!.id);
          const upgradeTargetIsFree = upgradeTargetPlan
            ? Number(upgradeTargetPlan.priceMonthly) === 0 && Number(upgradeTargetPlan.priceQuarterly) === 0 && Number(upgradeTargetPlan.priceYearly) === 0
            : true;
          const upgradeDisabled = !upgradeTargetIsFree && activeProviders.length === 0;
          return (
            <Card style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem', background: '#f0fdfa', border: '1px solid #99f6e4', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#0f766e', fontSize: '0.875rem' }}>
                Need more room to grow? <strong>Upgrade to {data.upgradePlan.name}</strong> for higher limits and more features.
              </span>
              <Button variant="primary" size="sm" disabled={upgradeDisabled} onClick={() => handleChoosePlan(data.upgradePlan!.id)}>Upgrade to {data.upgradePlan.name}</Button>
            </Card>
          );
        })()}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          {(['monthly', 'quarterly', 'yearly'] as BillingCycle[]).map(cycle => {
            const bestSavings = plans.length > 0
              ? Math.max(...plans.map(p => savingsPercent(p, cycle) ?? 0))
              : 0;
            return (
              <button
                key={cycle}
                onClick={() => setBillingCycle(cycle)}
                className="btn btn-sm"
                style={{ background: billingCycle === cycle ? '#14b8a6' : '#f3f4f6', color: billingCycle === cycle ? 'white' : '#374151', display: 'flex', alignItems: 'center', gap: '0.375rem' }}
              >
                {cycle === 'monthly' ? 'Monthly' : cycle === 'quarterly' ? 'Quarterly' : 'Yearly'}
                {bestSavings > 0 && (
                  <span style={{ fontSize: '0.6875rem', fontWeight: 700, background: billingCycle === cycle ? 'rgba(255,255,255,0.25)' : '#dcfce7', color: billingCycle === cycle ? 'white' : '#16a34a', padding: '0.0625rem 0.375rem', borderRadius: '999px' }}>
                    Save {bestSavings}%
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {plans.map(plan => {
            const price = priceForCycle(plan, billingCycle);
            const isFree = Number(plan.priceMonthly) === 0 && Number(plan.priceQuarterly) === 0 && Number(plan.priceYearly) === 0;
            const isCurrent = plan.code === currentPlanCode;
            const showRecommended = plan.isRecommended && currentPlanTierRank < plan.tierRank;
            const savings = savingsPercent(plan, billingCycle);
            const cycleSuffix = billingCycle === 'yearly' ? '/yr' : billingCycle === 'quarterly' ? '/qtr' : '/mo';

            const limitRows: { label: string; value: number | null }[] = [
              { label: 'Locations', value: plan.maxLocations },
              { label: 'Services/loc', value: plan.maxServicesPerLoc },
              { label: 'Users', value: plan.maxUsersPerOrg },
              { label: 'Entries/day', value: plan.maxQueueEntriesPerDay },
            ];
            const featureBullets = Object.entries(plan.features)
              .filter(([, enabled]) => enabled)
              .map(([key]) => FEATURE_LABELS[key] || key)
              .slice(0, 3);

            return (
              <Card
                key={plan.id}
                style={{
                  padding: '1rem',
                  border: showRecommended ? '2px solid #14b8a6' : undefined,
                  position: 'relative',
                }}
              >
                {showRecommended && (
                  <div style={{ position: 'absolute', top: '-0.625rem', left: '1rem' }}>
                    <Badge tone="primary">Recommended</Badge>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{plan.name}</h3>
                  {isCurrent && <Badge tone="primary">Current</Badge>}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.375rem', marginBottom: '0.75rem' }}>
                  <span style={{ fontSize: '1.375rem', fontWeight: 700 }}>
                    {isFree ? 'Free' : `${plan.currency} ${price}`}
                  </span>
                  {!isFree && <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>{cycleSuffix}</span>}
                  {savings && (
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: '#16a34a', background: '#dcfce7', padding: '0.0625rem 0.375rem', borderRadius: '999px' }}>
                      Save {savings}%
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.375rem', marginBottom: '0.75rem', fontSize: '0.75rem' }}>
                  {limitRows.filter(r => r.value !== null).map(r => (
                    <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', color: '#6b7280' }}>
                      <span>{r.label}</span>
                      <strong style={{ color: '#111827' }}>{r.value}</strong>
                    </div>
                  ))}
                </div>

                {featureBullets.length > 0 && (
                  <ul style={{ margin: '0 0 0.75rem', paddingLeft: '1rem', fontSize: '0.75rem', color: '#4b5563' }}>
                    {featureBullets.map(f => <li key={f}>{f}</li>)}
                  </ul>
                )}

                {checkoutPlanId === plan.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {activeProviders.includes('stripe') && (
                      <Button variant="primary" size="sm" onClick={() => handleCheckout('stripe')}>Pay with Stripe</Button>
                    )}
                    {activeProviders.includes('paystack') && (
                      <Button variant="primary" size="sm" onClick={() => handleCheckout('paystack')}>Pay with Paystack</Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => setCheckoutPlanId(null)}>Cancel</Button>
                  </div>
                ) : (
                  <Button
                    variant={isCurrent ? 'secondary' : 'primary'}
                    size="sm"
                    disabled={isCurrent || (!isFree && activeProviders.length === 0)}
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    {isCurrent ? <><Icon icon={CheckCircle2} size={14} /> Current Plan</> : isFree ? 'Switch to Free' : 'Subscribe'}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
