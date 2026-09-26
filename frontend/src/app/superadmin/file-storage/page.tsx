'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, ImageIcon } from 'lucide-react';
import api from '@/api/client';
import { Icon, PageHeader, Card, Badge, Button, Switch, Input } from '@/components/ui';

interface ProviderConfig {
  provider: 'uploadcare';
  configured: boolean;
  isActive: boolean;
  publicKey: string | null;
  secretKeyMasked: string | null;
  updatedAt: string | null;
}

const PROVIDER_LABELS: Record<string, string> = {
  uploadcare: 'Uploadcare',
};

export default function FileStorageProvidersPage() {
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; error?: string }>>({});
  const [forms, setForms] = useState<Record<string, { publicKey: string; secretKey: string; isActive: boolean }>>({});

  useEffect(() => {
    loadProviders();
  }, []);

  const loadProviders = async () => {
    setLoading(true);
    try {
      const data = await api.getFileStorageProviders();
      setProviders(data);
      const initialForms: typeof forms = {};
      for (const p of data as ProviderConfig[]) {
        initialForms[p.provider] = {
          publicKey: p.publicKey || '',
          secretKey: '',
          isActive: p.isActive,
        };
      }
      setForms(initialForms);
    } catch (err) {
      console.error('Failed to load file storage providers', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (provider: string) => {
    const form = forms[provider];
    if (!form.secretKey) {
      alert('Secret key is required to save.');
      return;
    }
    setSaving(provider);
    try {
      await api.saveFileStorageProvider(provider, form);
      await loadProviders();
    } catch (err) {
      console.error('Failed to save provider config', err);
      alert('Failed to save. Check the console for details.');
    } finally {
      setSaving(null);
    }
  };

  const handleTest = async (provider: string) => {
    try {
      const result = await api.testFileStorageProvider(provider);
      setTestResult(prev => ({ ...prev, [provider]: result }));
    } catch (err: any) {
      setTestResult(prev => ({ ...prev, [provider]: { ok: false, error: err?.response?.data?.error || 'Test failed' } }));
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader
        title="File storage"
        subtitle="Configure a file storage provider so organizations can upload a logo for white-labeling."
        icon={ImageIcon}
      />

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--gray-500)' }}>Loading...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {providers.map(p => {
            const form = forms[p.provider] || { publicKey: '', secretKey: '', isActive: false };
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
                    placeholder="Public key"
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
                  <Switch
                    label="Active (organizations can upload logos)"
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
