'use client';

import { toast, errorMessage } from '@/lib/toast';
import React, { useEffect, useState } from 'react';
import { PackagePlus } from 'lucide-react';
import api from '@/api/client';
import { PageHeader, Card, Button, Input } from '@/components/ui';

interface AddOnPricingRow {
  resourceType: 'LOCATIONS' | 'USERS' | 'DISPLAY_MEDIA';
  pricePerUnitMonthly: string;
  pricePerUnitOneOff: string;
  currency: string;
}

const RESOURCE_LABELS: Record<string, string> = {
  LOCATIONS: 'Extra location',
  USERS: 'Extra staff seat',
  DISPLAY_MEDIA: 'Lobby media pack (large uploads, streams, +25 items)',
};

export default function AddOnPricingPage() {
  const [rows, setRows] = useState<AddOnPricingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, { pricePerUnitMonthly: string; pricePerUnitOneOff: string; currency: string }>>({});

  useEffect(() => {
    loadPricing();
  }, []);

  const loadPricing = async () => {
    setLoading(true);
    try {
      const data = await api.getAddOnPricing();
      setRows(data);
      const initialForms: typeof forms = {};
      for (const r of data as AddOnPricingRow[]) {
        initialForms[r.resourceType] = {
          pricePerUnitMonthly: r.pricePerUnitMonthly,
          pricePerUnitOneOff: r.pricePerUnitOneOff,
          currency: r.currency,
        };
      }
      setForms(initialForms);
    } catch (err) {
      console.error('Failed to load add-on pricing', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (resourceType: 'LOCATIONS' | 'USERS' | 'DISPLAY_MEDIA') => {
    const form = forms[resourceType];
    setSaving(resourceType);
    try {
      await api.updateAddOnPricing(resourceType, {
        pricePerUnitMonthly: parseFloat(form.pricePerUnitMonthly) || 0,
        pricePerUnitOneOff: parseFloat(form.pricePerUnitOneOff) || 0,
        currency: form.currency,
      });
      await loadPricing();
    } catch (err) {
      console.error('Failed to save add-on pricing', err);
      toast.error('Couldn’t save the prices. Try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div style={{ maxWidth: '900px' }}>
      <PageHeader
        title="Add-on pricing"
        subtitle="Set the price organizations pay for extra locations and extra users beyond their plan limit."
        icon={PackagePlus}
      />

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--gray-500)' }}>Loading...</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {rows.map(row => {
            const form = forms[row.resourceType] || { pricePerUnitMonthly: '0', pricePerUnitOneOff: '0', currency: 'USD' };
            return (
              <Card key={row.resourceType} style={{ padding: '1.75rem' }}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--gray-900)', marginBottom: '1.25rem' }}>
                  {RESOURCE_LABELS[row.resourceType] || row.resourceType}
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <Input
                    label="Price per unit / month (recurring)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricePerUnitMonthly}
                    onChange={e => setForms(prev => ({ ...prev, [row.resourceType]: { ...form, pricePerUnitMonthly: e.target.value } }))}
                  />
                  <Input
                    label="Price per unit (one-off)"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.pricePerUnitOneOff}
                    onChange={e => setForms(prev => ({ ...prev, [row.resourceType]: { ...form, pricePerUnitOneOff: e.target.value } }))}
                  />
                </div>

                <Button variant="primary" onClick={() => handleSave(row.resourceType)} disabled={saving === row.resourceType}>
                  {saving === row.resourceType ? 'Saving...' : 'Save'}
                </Button>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
