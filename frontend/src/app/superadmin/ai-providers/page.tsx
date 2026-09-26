'use client';

import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Loader2, Sparkles } from 'lucide-react';
import api, { AiProviderConfig } from '@/api/client';
import { Icon, PageHeader, Card, Badge, Button, Switch, Input } from '@/components/ui';

type ProviderName = AiProviderConfig['provider'];

const PROVIDERS: Record<ProviderName, { label: string; keyHint: string; modelHint: string; needsBaseUrl?: boolean; blurb: string }> = {
  anthropic: {
    label: 'Anthropic (Claude)',
    keyHint: 'sk-ant-…',
    modelHint: 'Leave empty for the default (claude-opus-5)',
    blurb: 'Recommended default. Declined requests are automatically retried on a fallback Claude model.',
  },
  openai: {
    label: 'OpenAI',
    keyHint: 'sk-…',
    modelHint: 'Model name as listed in your OpenAI account',
    blurb: 'Chat Completions with function calling.',
  },
  gemini: {
    label: 'Google Gemini',
    keyHint: 'Google AI Studio API key',
    modelHint: 'Gemini model name, e.g. from AI Studio',
    blurb: 'Generative Language API with function calling.',
  },
  openai_compatible: {
    label: 'OpenAI-compatible endpoint',
    keyHint: 'API key for the endpoint',
    modelHint: 'Model name on that endpoint',
    needsBaseUrl: true,
    blurb: 'Mistral, xAI, Groq, DeepSeek, OpenRouter, Azure OpenAI, or a self-hosted server (vLLM, Ollama) that speaks the OpenAI chat API.',
  },
};

interface FormState { apiKey: string; model: string; baseUrl: string; isActive: boolean }

export default function AiProvidersPage() {
  const [providers, setProviders] = useState<AiProviderConfig[]>([]);
  const [forms, setForms] = useState<Record<string, FormState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { ok: boolean; text: string }>>({});

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.getAiProviders();
      setProviders(data);
      setForms(Object.fromEntries(data.map((p) => [p.provider, { apiKey: '', model: p.model || '', baseUrl: p.baseUrl || '', isActive: p.isActive }])));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const update = (provider: string, patch: Partial<FormState>) =>
    setForms((prev) => ({ ...prev, [provider]: { ...prev[provider], ...patch } }));

  const save = async (p: AiProviderConfig) => {
    const form = forms[p.provider];
    setSaving(p.provider);
    setResults((r) => ({ ...r, [p.provider]: undefined as any }));
    try {
      await api.saveAiProvider(p.provider, {
        apiKey: form.apiKey || undefined,
        model: form.model || undefined,
        baseUrl: form.baseUrl || undefined,
        isActive: form.isActive,
      });
      await load();
      setResults((r) => ({ ...r, [p.provider]: { ok: true, text: form.isActive ? 'Saved and active' : 'Saved' } }));
    } catch (err: any) {
      setResults((r) => ({ ...r, [p.provider]: { ok: false, text: err?.response?.data?.error || 'Could not save' } }));
    } finally {
      setSaving(null);
    }
  };

  const test = async (p: AiProviderConfig) => {
    setTesting(p.provider);
    try {
      const res = await api.testAiProvider(p.provider);
      setResults((r) => ({ ...r, [p.provider]: res.ok ? { ok: true, text: `Connected (${res.model})` } : { ok: false, text: res.error || 'Test failed' } }));
    } catch (err: any) {
      setResults((r) => ({ ...r, [p.provider]: { ok: false, text: err?.response?.data?.error || 'Test failed' } }));
    } finally {
      setTesting(null);
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <PageHeader
        title="AI Providers"
        subtitle="Choose which LLM powers AI-assisted analytics. Only one provider is active at a time; tenants must also have the AI feature in their plan and switch it on."
        icon={Sparkles}
      />

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', margin: 0 }}>
            The model only ever receives aggregated queue statistics (counts, wait and service times, service names), never patient names, contact details or identifiers.
          </p>
          {providers.map((p) => {
            const meta = PROVIDERS[p.provider];
            const form = forms[p.provider];
            const result = results[p.provider];
            if (!form) return null;
            return (
              <Card key={p.provider} style={{ padding: '1.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '0.5rem' }}>
                  <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-900)' }}>{meta.label}</h2>
                  <Badge tone={p.isActive ? 'success' : p.configured ? 'neutral' : 'neutral'}>
                    {p.isActive ? 'Active' : p.configured ? 'Saved' : 'Not set up'}
                  </Badge>
                </div>
                <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem', marginBottom: '1.25rem' }}>{meta.blurb}</p>

                <div style={{ display: 'grid', gap: '0.9rem', marginBottom: '1.25rem' }}>
                  <Input
                    label="API key"
                    type="password"
                    placeholder={p.configured ? `Saved (${p.apiKeyMasked}) - leave empty to keep` : meta.keyHint}
                    value={form.apiKey}
                    onChange={(e) => update(p.provider, { apiKey: e.target.value })}
                  />
                  <Input
                    label="Model"
                    placeholder={p.defaultModel || 'Required'}
                    hint={meta.modelHint}
                    value={form.model}
                    onChange={(e) => update(p.provider, { model: e.target.value })}
                  />
                  {meta.needsBaseUrl && (
                    <Input
                      label="Base URL"
                      placeholder="https://api.example.com/v1"
                      hint="The URL that /chat/completions is appended to"
                      value={form.baseUrl}
                      onChange={(e) => update(p.provider, { baseUrl: e.target.value })}
                    />
                  )}
                  <Switch
                    label="Use this provider for AI analytics"
                    checked={form.isActive}
                    onChange={(e) => update(p.provider, { isActive: e.target.checked })}
                  />
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button variant="primary" onClick={() => save(p)} disabled={saving === p.provider}>
                    {saving === p.provider ? <Icon icon={Loader2} size={16} className="qf-spin" /> : 'Save'}
                  </Button>
                  {p.configured && (
                    <Button variant="secondary" onClick={() => test(p)} disabled={testing === p.provider}>
                      {testing === p.provider ? 'Testing…' : 'Test connection'}
                    </Button>
                  )}
                  {result && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.875rem', color: result.ok ? 'var(--success-600)' : 'var(--error-600)' }}>
                      <Icon icon={result.ok ? CheckCircle2 : XCircle} size={16} />
                      {result.text}
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
