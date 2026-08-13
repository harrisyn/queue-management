'use client';

import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '@/api/client';
import { Icon } from '@/components/ui';

interface SubscriptionPlan {
  id: string;
  name: string;
  code: string;
  description: string | null;
  priceMonthly: string;
  priceYearly: string;
  currency: string;
  maxLocations: number | null;
  maxServicesPerLoc: number | null;
  maxUsersPerOrg: number | null;
  maxQueueEntriesPerDay: number | null;
  features: Record<string, boolean>;
  displayOrder: number;
  isActive: boolean;
  isDefault: boolean;
  _count: {
    subscriptions: number;
  };
}

const defaultFeatures = [
  { key: 'analytics', label: 'Analytics Dashboard' },
  { key: 'customBranding', label: 'Custom Branding' },
  { key: 'apiAccess', label: 'API Access' },
  { key: 'smsNotifications', label: 'SMS Notifications' },
  { key: 'emailNotifications', label: 'Email Notifications' },
  { key: 'multipleLocations', label: 'Multiple Locations' },
  { key: 'serviceFlows', label: 'Service Flows' },
  { key: 'dataIntegration', label: 'Data Integration' },
  { key: 'prioritySupport', label: 'Priority Support' },
  { key: 'whiteLabel', label: 'White Label' },
];

export default function PlansPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [form, setForm] = useState({
    name: '',
    code: '',
    description: '',
    priceMonthly: 0,
    priceYearly: 0,
    currency: 'USD',
    maxLocations: null as number | null,
    maxServicesPerLoc: null as number | null,
    maxUsersPerOrg: null as number | null,
    maxQueueEntriesPerDay: null as number | null,
    features: {} as Record<string, boolean>,
    displayOrder: 0,
    isActive: true,
    isDefault: false,
  });

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const result = await api.getSubscriptionPlans(true);
      setPlans(result);
    } catch (err) {
      console.error('Failed to load plans', err);
      setError('Failed to load subscription plans');
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setForm({
      name: '',
      code: '',
      description: '',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'USD',
      maxLocations: null,
      maxServicesPerLoc: null,
      maxUsersPerOrg: null,
      maxQueueEntriesPerDay: null,
      features: {},
      displayOrder: plans.length,
      isActive: true,
      isDefault: false,
    });
    setShowModal(true);
  };

  const openEditModal = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setForm({
      name: plan.name,
      code: plan.code,
      description: plan.description || '',
      priceMonthly: parseFloat(plan.priceMonthly),
      priceYearly: parseFloat(plan.priceYearly),
      currency: plan.currency,
      maxLocations: plan.maxLocations,
      maxServicesPerLoc: plan.maxServicesPerLoc,
      maxUsersPerOrg: plan.maxUsersPerOrg,
      maxQueueEntriesPerDay: plan.maxQueueEntriesPerDay,
      features: plan.features || {},
      displayOrder: plan.displayOrder,
      isActive: plan.isActive,
      isDefault: plan.isDefault,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      setError('Name and code are required');
      return;
    }

    setSaving(true);
    try {
      if (editingPlan) {
        await api.updateSubscriptionPlan(editingPlan.id, {
          name: form.name,
          description: form.description || undefined,
          priceMonthly: form.priceMonthly,
          priceYearly: form.priceYearly,
          currency: form.currency,
          maxLocations: form.maxLocations,
          maxServicesPerLoc: form.maxServicesPerLoc,
          maxUsersPerOrg: form.maxUsersPerOrg,
          maxQueueEntriesPerDay: form.maxQueueEntriesPerDay,
          features: form.features,
          displayOrder: form.displayOrder,
          isActive: form.isActive,
          isDefault: form.isDefault,
        });
      } else {
        await api.createSubscriptionPlan({
          name: form.name,
          code: form.code.toLowerCase().replace(/\s+/g, '-'),
          description: form.description || undefined,
          priceMonthly: form.priceMonthly,
          priceYearly: form.priceYearly,
          currency: form.currency,
          maxLocations: form.maxLocations,
          maxServicesPerLoc: form.maxServicesPerLoc,
          maxUsersPerOrg: form.maxUsersPerOrg,
          maxQueueEntriesPerDay: form.maxQueueEntriesPerDay,
          features: form.features,
          displayOrder: form.displayOrder,
          isDefault: form.isDefault,
        });
      }
      setShowModal(false);
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: SubscriptionPlan) => {
    if (!confirm(`Delete "${plan.name}"? This cannot be undone.`)) return;

    try {
      await api.deleteSubscriptionPlan(plan.id);
      loadPlans();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete plan');
    }
  };

  const toggleFeature = (key: string) => {
    setForm(prev => ({
      ...prev,
      features: {
        ...prev.features,
        [key]: !prev.features[key],
      },
    }));
  };

  const formatLimit = (value: number | null) => {
    return value === null ? '∞' : value.toString();
  };

  return (
    <div style={pageContainer}>
      <header style={header}>
        <div>
          <h1 style={pageTitle}>Subscription Plans</h1>
          <p style={subtitle}>Define pricing tiers and feature limits</p>
        </div>
        <button onClick={openCreateModal} style={createBtn}>
          <Icon icon={Plus} size={16} /> Create Plan
        </button>
      </header>

      {error && (
        <div style={errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={dismissBtn}>✕</button>
        </div>
      )}

      {loading ? (
        <div style={loadingState}>
          <div style={spinner} />
          <p>Loading plans...</p>
        </div>
      ) : (
        <div style={plansGrid}>
          {plans.map(plan => (
            <div key={plan.id} style={{ ...planCard, opacity: plan.isActive ? 1 : 0.6 }}>
              <div style={planHeader}>
                <div style={planTitleRow}>
                  <h3 style={planName}>{plan.name}</h3>
                  {plan.isDefault && <span style={defaultBadge}>Default</span>}
                  {!plan.isActive && <span style={inactiveBadge}>Inactive</span>}
                </div>
                <span style={planCode}>{plan.code}</span>
              </div>

              <div style={priceSection}>
                <div style={priceRow}>
                  <span style={priceLabel}>Monthly</span>
                  <span style={priceValue}>${plan.priceMonthly}</span>
                </div>
                <div style={priceRow}>
                  <span style={priceLabel}>Yearly</span>
                  <span style={priceValue}>${plan.priceYearly}</span>
                </div>
              </div>

              <div style={limitsSection}>
                <h4 style={sectionTitle}>Limits</h4>
                <div style={limitsGrid}>
                  <div style={limitItem}>
                    <span style={limitValue}>{formatLimit(plan.maxLocations)}</span>
                    <span style={limitLabel}>Locations</span>
                  </div>
                  <div style={limitItem}>
                    <span style={limitValue}>{formatLimit(plan.maxServicesPerLoc)}</span>
                    <span style={limitLabel}>Services/Loc</span>
                  </div>
                  <div style={limitItem}>
                    <span style={limitValue}>{formatLimit(plan.maxUsersPerOrg)}</span>
                    <span style={limitLabel}>Users</span>
                  </div>
                  <div style={limitItem}>
                    <span style={limitValue}>{formatLimit(plan.maxQueueEntriesPerDay)}</span>
                    <span style={limitLabel}>Entries/Day</span>
                  </div>
                </div>
              </div>

              <div style={featuresSection}>
                <h4 style={sectionTitle}>Features</h4>
                <div style={featuresList}>
                  {defaultFeatures.map(f => (
                    <span 
                      key={f.key} 
                      style={plan.features?.[f.key] ? featureEnabled : featureDisabled}
                    >
                      {plan.features?.[f.key] ? '✓' : '✗'} {f.label}
                    </span>
                  ))}
                </div>
              </div>

              <div style={planFooter}>
                <span style={subCount}>{plan._count.subscriptions} orgs</span>
                <div style={planActions}>
                  <button onClick={() => openEditModal(plan)} style={editBtn}>Edit</button>
                  <button 
                    onClick={() => handleDelete(plan)} 
                    style={deleteBtn}
                    disabled={plan._count.subscriptions > 0}
                    title={plan._count.subscriptions > 0 ? 'Cannot delete plan with active subscriptions' : 'Delete plan'}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}

          {plans.length === 0 && (
            <div style={emptyState}>
              <p>No subscription plans created yet.</p>
              <button onClick={openCreateModal} style={createBtn}>Create your first plan</button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div style={modalOverlay} onClick={() => setShowModal(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h2 style={modalTitle}>{editingPlan ? 'Edit Plan' : 'Create Plan'}</h2>
              <button onClick={() => setShowModal(false)} style={closeBtn}>✕</button>
            </div>
            <div style={modalBody}>
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    style={formInput}
                    placeholder="e.g. Professional"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Code *</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    style={formInput}
                    placeholder="e.g. pro"
                    disabled={!!editingPlan}
                  />
                </div>
              </div>

              <div style={formGroup}>
                <label style={formLabel}>Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ ...formInput, minHeight: '80px' }}
                  placeholder="Brief description of this plan"
                />
              </div>

              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Monthly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceMonthly}
                    onChange={(e) => setForm({ ...form, priceMonthly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Yearly Price ($)</label>
                  <input
                    type="number"
                    value={form.priceYearly}
                    onChange={(e) => setForm({ ...form, priceYearly: parseFloat(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <h4 style={{ ...sectionTitle, marginTop: '1.5rem' }}>Limits (leave empty for unlimited)</h4>
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Max Locations</label>
                  <input
                    type="number"
                    value={form.maxLocations ?? ''}
                    onChange={(e) => setForm({ ...form, maxLocations: e.target.value ? parseInt(e.target.value) : null })}
                    style={formInput}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Max Services/Location</label>
                  <input
                    type="number"
                    value={form.maxServicesPerLoc ?? ''}
                    onChange={(e) => setForm({ ...form, maxServicesPerLoc: e.target.value ? parseInt(e.target.value) : null })}
                    style={formInput}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Max Users</label>
                  <input
                    type="number"
                    value={form.maxUsersPerOrg ?? ''}
                    onChange={(e) => setForm({ ...form, maxUsersPerOrg: e.target.value ? parseInt(e.target.value) : null })}
                    style={formInput}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
                <div style={formGroup}>
                  <label style={formLabel}>Max Queue Entries/Day</label>
                  <input
                    type="number"
                    value={form.maxQueueEntriesPerDay ?? ''}
                    onChange={(e) => setForm({ ...form, maxQueueEntriesPerDay: e.target.value ? parseInt(e.target.value) : null })}
                    style={formInput}
                    min="1"
                    placeholder="Unlimited"
                  />
                </div>
              </div>

              <h4 style={{ ...sectionTitle, marginTop: '1.5rem' }}>Features</h4>
              <div style={featuresGrid}>
                {defaultFeatures.map(f => (
                  <label key={f.key} style={featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={form.features[f.key] || false}
                      onChange={() => toggleFeature(f.key)}
                    />
                    <span>{f.label}</span>
                  </label>
                ))}
              </div>

              <div style={formRow}>
                <div style={formGroup}>
                  <label style={formLabel}>Display Order</label>
                  <input
                    type="number"
                    value={form.displayOrder}
                    onChange={(e) => setForm({ ...form, displayOrder: parseInt(e.target.value) || 0 })}
                    style={formInput}
                    min="0"
                  />
                </div>
                <div style={{ ...formGroup, display: 'flex', alignItems: 'center', gap: '1.5rem', paddingTop: '1.5rem' }}>
                  <label style={featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={form.isActive}
                      onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                    />
                    <span>Active</span>
                  </label>
                  <label style={featureCheckbox}>
                    <input
                      type="checkbox"
                      checked={form.isDefault}
                      onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                    />
                    <span>Default for new orgs</span>
                  </label>
                </div>
              </div>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowModal(false)} style={cancelBtn}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={saveBtn}>
                {saving ? 'Saving...' : (editingPlan ? 'Save Changes' : 'Create Plan')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Styles
const pageContainer: React.CSSProperties = {
  maxWidth: '1400px',
  margin: '0 auto',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '2rem',
};

const pageTitle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  color: '#fff',
  marginBottom: '0.5rem',
};

const subtitle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '1rem',
};

const createBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: '#14b8a6',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9375rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const errorBanner: React.CSSProperties = {
  background: 'rgba(239, 68, 68, 0.2)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '8px',
  padding: '1rem',
  marginBottom: '1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: '#f87171',
};

const dismissBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#f87171',
  cursor: 'pointer',
  fontSize: '1.25rem',
};

const loadingState: React.CSSProperties = {
  padding: '3rem',
  textAlign: 'center' as const,
  color: '#94a3b8',
};

const spinner: React.CSSProperties = {
  width: '40px',
  height: '40px',
  border: '4px solid #1e293b',
  borderTop: '4px solid #14b8a6',
  borderRadius: '50%',
  margin: '0 auto 1rem',
  animation: 'spin 1s linear infinite',
};

const plansGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
  gap: '1.5rem',
};

const planCard: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(20, 184, 166, 0.2)',
  overflow: 'hidden',
};

const planHeader: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid rgba(20, 184, 166, 0.1)',
};

const planTitleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  marginBottom: '0.25rem',
};

const planName: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#fff',
};

const defaultBadge: React.CSSProperties = {
  background: 'rgba(16, 185, 129, 0.2)',
  color: '#10b981',
  padding: '0.125rem 0.5rem',
  borderRadius: '4px',
  fontSize: '0.625rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const inactiveBadge: React.CSSProperties = {
  background: 'rgba(100, 116, 139, 0.2)',
  color: '#94a3b8',
  padding: '0.125rem 0.5rem',
  borderRadius: '4px',
  fontSize: '0.625rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
};

const planCode: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
};

const priceSection: React.CSSProperties = {
  padding: '1rem 1.5rem',
  background: 'rgba(15, 23, 42, 0.5)',
};

const priceRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};

const priceLabel: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.875rem',
};

const priceValue: React.CSSProperties = {
  color: '#fff',
  fontWeight: 600,
};

const limitsSection: React.CSSProperties = {
  padding: '1rem 1.5rem',
};

const sectionTitle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  marginBottom: '0.75rem',
};

const limitsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.75rem',
};

const limitItem: React.CSSProperties = {
  textAlign: 'center' as const,
  padding: '0.5rem',
  background: 'rgba(15, 23, 42, 0.5)',
  borderRadius: '6px',
};

const limitValue: React.CSSProperties = {
  display: 'block',
  color: '#5eead4',
  fontSize: '1.25rem',
  fontWeight: 600,
};

const limitLabel: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
};

const featuresSection: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid rgba(20, 184, 166, 0.1)',
};

const featuresList: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap' as const,
  gap: '0.5rem',
};

const featureEnabled: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: 'rgba(16, 185, 129, 0.15)',
  color: '#10b981',
  borderRadius: '4px',
  fontSize: '0.75rem',
};

const featureDisabled: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: 'rgba(100, 116, 139, 0.15)',
  color: '#64748b',
  borderRadius: '4px',
  fontSize: '0.75rem',
};

const planFooter: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid rgba(20, 184, 166, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const subCount: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.875rem',
};

const planActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};

const editBtn: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'rgba(20, 184, 166, 0.2)',
  color: '#5eead4',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const deleteBtn: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'rgba(239, 68, 68, 0.2)',
  color: '#f87171',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const emptyState: React.CSSProperties = {
  gridColumn: '1 / -1',
  padding: '3rem',
  textAlign: 'center' as const,
  color: '#64748b',
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(20, 184, 166, 0.2)',
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed' as const,
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  background: 'rgba(0, 0, 0, 0.7)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  padding: '2rem',
};

const modal: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '600px',
  maxHeight: '90vh',
  overflow: 'auto',
  border: '1px solid rgba(20, 184, 166, 0.3)',
};

const modalHeader: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid rgba(20, 184, 166, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  position: 'sticky' as const,
  top: 0,
  background: '#1e293b',
};

const modalTitle: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 600,
  color: '#fff',
};

const closeBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#64748b',
  fontSize: '1.5rem',
  cursor: 'pointer',
};

const modalBody: React.CSSProperties = {
  padding: '1.5rem',
};

const formRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '1rem',
};

const formGroup: React.CSSProperties = {
  marginBottom: '1rem',
};

const formLabel: React.CSSProperties = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.875rem',
  marginBottom: '0.5rem',
};

const formInput: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  background: '#0f172a',
  border: '1px solid rgba(20, 184, 166, 0.2)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9375rem',
};

const featuresGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '0.75rem',
};

const featureCheckbox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  color: '#94a3b8',
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const modalFooter: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid rgba(20, 184, 166, 0.1)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  position: 'sticky' as const,
  bottom: 0,
  background: '#1e293b',
};

const cancelBtn: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  background: 'transparent',
  border: '1px solid rgba(20, 184, 166, 0.3)',
  borderRadius: '8px',
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const saveBtn: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  background: '#14b8a6',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};
