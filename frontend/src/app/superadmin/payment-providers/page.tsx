'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import api from '@/api/client';
import { Icon } from '@/components/ui';

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
      alert('Secret key and webhook secret are required to save.');
      return;
    }
    setSaving(provider);
    try {
      await api.savePaymentProvider(provider, form);
      await loadProviders();
    } catch (err) {
      console.error('Failed to save provider config', err);
      alert('Failed to save. Check the console for details.');
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

  if (loading) {
    return <div style={{ color: '#94a3b8', padding: '2rem' }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 700, color: '#fff', marginBottom: '0.5rem' }}>Payment Providers</h1>
        <p style={{ color: '#94a3b8' }}>Configure Stripe and Paystack so tenants can subscribe to a plan.</p>
      </header>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {providers.map(p => {
          const form = forms[p.provider] || { publicKey: '', secretKey: '', webhookSecret: '', isActive: false };
          const result = testResult[p.provider];
          return (
            <div key={p.provider} style={{ background: '#1e293b', borderRadius: '12px', border: '1px solid rgba(20, 184, 166, 0.2)', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#fff' }}>{PROVIDER_LABELS[p.provider]}</h2>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.25rem 0.625rem', borderRadius: '9999px', background: p.isActive ? 'rgba(20, 184, 166, 0.2)' : 'rgba(100, 116, 139, 0.2)', color: p.isActive ? '#5eead4' : '#94a3b8' }}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {p.configured && (
                <p style={{ color: '#64748b', fontSize: '0.8125rem', marginBottom: '1rem' }}>
                  Current secret key: <code>{p.secretKeyMasked}</code>
                </p>
              )}

              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  placeholder="Public key (optional)"
                  value={form.publicKey}
                  onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, publicKey: e.target.value } }))}
                  style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid rgba(20, 184, 166, 0.2)', background: '#0f172a', color: '#fff' }}
                />
                <input
                  placeholder="Secret key"
                  type="password"
                  value={form.secretKey}
                  onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, secretKey: e.target.value } }))}
                  style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid rgba(20, 184, 166, 0.2)', background: '#0f172a', color: '#fff' }}
                />
                <input
                  placeholder="Webhook secret"
                  type="password"
                  value={form.webhookSecret}
                  onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, webhookSecret: e.target.value } }))}
                  style={{ padding: '0.625rem 0.875rem', borderRadius: '8px', border: '1px solid rgba(20, 184, 166, 0.2)', background: '#0f172a', color: '#fff' }}
                />
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.875rem' }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={e => setForms(prev => ({ ...prev, [p.provider]: { ...form, isActive: e.target.checked } }))}
                  />
                  Active (tenants can pay with this provider)
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <button
                  onClick={() => handleSave(p.provider)}
                  disabled={saving === p.provider}
                  style={{ padding: '0.625rem 1.25rem', background: '#14b8a6', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                >
                  {saving === p.provider ? <Icon icon={Loader2} size={16} /> : 'Save'}
                </button>
                {p.configured && (
                  <button
                    onClick={() => handleTest(p.provider)}
                    style={{ padding: '0.625rem 1.25rem', background: 'rgba(20, 184, 166, 0.15)', color: '#2dd4bf', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Test Connection
                  </button>
                )}
                {result && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: result.ok ? '#5eead4' : '#f87171' }}>
                    <Icon icon={result.ok ? CheckCircle2 : XCircle} size={16} />
                    {result.ok ? 'Key is valid' : result.error}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
