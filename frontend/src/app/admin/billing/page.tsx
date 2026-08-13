'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { Button, Card, Badge, PageHeader, Icon } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  features: Record<string, boolean>;
  isDefault: boolean;
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
}

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');

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

  const handleChoosePlan = (planId: string) => {
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
  const activeProviders = data?.activeProviders || [];

  return (
    <Layout>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <PageHeader
          title="Billing"
          subtitle={
            data?.subscription
              ? `Current plan: ${data.subscription.planName} (${data.subscription.status})`
              : 'No active subscription'
          }
        />

        {activeProviders.length === 0 && (
          <Card style={{ padding: '1.25rem', marginBottom: '1.5rem', background: '#fffbeb', border: '1px solid #fcd34d' }}>
            No payment providers are configured yet. Please check back later.
          </Card>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
          <button
            onClick={() => setBillingCycle('monthly')}
            className="btn btn-sm"
            style={{ background: billingCycle === 'monthly' ? '#14b8a6' : '#f3f4f6', color: billingCycle === 'monthly' ? 'white' : '#374151' }}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className="btn btn-sm"
            style={{ background: billingCycle === 'yearly' ? '#14b8a6' : '#f3f4f6', color: billingCycle === 'yearly' ? 'white' : '#374151' }}
          >
            Yearly
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          {plans.map(plan => {
            const price = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
            const isCurrent = plan.code === currentPlanCode;
            return (
              <Card key={plan.id} style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: 600 }}>{plan.name}</h3>
                  {isCurrent && <Badge tone="primary">Current</Badge>}
                </div>
                <p style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>{plan.description}</p>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '1rem' }}>
                  {plan.currency} {price}
                  <span style={{ fontSize: '0.875rem', fontWeight: 400, color: '#6b7280' }}>/{billingCycle === 'yearly' ? 'yr' : 'mo'}</span>
                </div>
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
                    disabled={isCurrent || activeProviders.length === 0}
                    onClick={() => handleChoosePlan(plan.id)}
                  >
                    {isCurrent ? <><Icon icon={CheckCircle2} size={14} /> Current Plan</> : 'Subscribe'}
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
