'use client';

import { toast, errorMessage } from '@/lib/toast';
import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Wallet } from 'lucide-react';
import api from '@/api/client';
import { Icon, PageHeader, Card, Badge, Button, Switch, Input } from '@/components/ui';

interface ProviderConfig {
  provider: 'stripe' | 'paystack';
  configured: boolean;
  isActive: boolean;
  publicKey: string | null;
  secretKeyMasked: string | null;
  updatedAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  stripe: 'Stripe',
  paystack: 'Paystack',
};

export default function PaymentProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [forms, setForms] = useState<Record<string, { publicKey: string; secretKey: string; webhookSecret: string; isActive: boolean }>>({});

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await api.getPaymentProviders();
      setProviders(data);
      const initialForms: typeof forms = {};
      for (const p of data as ProviderConfig[]) {
        initialForms[p.provider] = {
          publicKey: p.publicKey || '',
          secretKey: '',
          webhookSecret: '',
          isActive: p.isActive,
        };
      }
      setForms(initialForms);
    } catch (err) {
      console.error('Failed to load payment providers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (provider: 'stripe' | 'paystack') => {
    const form = forms[provider];
    if (!form.secretKey || !form.webhookSecret) {
      toast.error('Add the secret key and webhook secret to save.');
      return;
    }
    setSaving(provider);
    try {
      await api.savePaymentProvider(provider, form);
      await loadProviders();
    } catch (err) {
      console.error('Failed to save provider config', err);
      toast.error('Couldn’t save. Check the keys and try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (provider: 'stripe' | 'paystack') => {
    try {
      const result = await api.testPaymentProvider(provider);
      setTestResult(prev => ({ ...prev, [provider]: result }));
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [provider]: { ok: false, error: err?.response?.data?.error || 'Test failed' } }));
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader
        title="Payment providers"
        subtitle="Configure Stripe and Paystack so tenants can subscribe to a plan."
        icon={Wallet}
      />

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--gray-500)' }}>Loading...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {providers.map(p => {
            const form = forms[p.provider] || { publicKey: '', secretKey: '', webhookSecret: '', isActive: false };
            const result = testResult[p.provider];
            return (
              <Card key={p.provider} style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-900)' }}>{PROVIDER_LABELS[p.provider]}</h2>
                  <Badge tone={p.isActive ? 'success' : 'neutral'}>{p.isActive ? 'Active' : 'Inactive'}</Badge>
                </div>

                {p.configured && (
                  <p style={{ color: 'var(--gray-400)', fontSize: '0.8125rem', marginBottom: '1.25rem' }}>
                    Current secret key: <code style={{ background: 'var(--gray-100)', padding: '0.125rem 0.375rem', borderRadius: 'var(--radius-sm)' }}>{p.secretKeyMasked}</code>
                  </p>
                )}

                <div style={{ display: 'grid', gap: '0.9rem', marginBottom: '1.25rem' }}>
                  <Input
                    label="Public key"
                    placeholder="Public key (optional)"
                    value={form.publicKey}
                    onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, publicKey: e.target.value } }))}
                  />
                  <Input
                    label="Secret key"
                    placeholder="Secret key"
                    type="password"
                    value={form.secretKey}
                    onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, secretKey: e.target.value } }))}
                  />
                  <Input
                    label="Webhook secret"
                    placeholder="Webhook secret"
                    type="password"
                    value={form.webhookSecret}
                    onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, webhookSecret: e.target.value } }))}
                  />
                  <Switch
                    label="Active (tenants can pay with this provider)"
                    checked={form.isActive}
                    onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, isActive: e.target.checked } }))}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => handleSave(p.provider)} disabled={saving === p.provider}>
                    {saving === p.provider ? <Icon icon={Loader2} size={16} className="animate-spin" /> : 'Save'}
                  </Button>
                  {p.configured && (
                    <Button variant="secondary" onClick={() => handleTest(p.provider)}>
                      Test Connection
                    </Button>
                  )}
                  {result && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: result.ok ? 'var(--success-600)' : 'var(--error-600)' }}>
                      <Icon icon={result.ok ? CheckCircle2 : XCircle} size={16} />
                      {result.ok ? 'Key is valid' : result.error}
                    </span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
