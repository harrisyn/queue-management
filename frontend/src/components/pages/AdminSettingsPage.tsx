'use client';

import React, { useEffect, useState } from 'react';
import { Info, Settings, Upload, Lock, Globe, CheckCircle2, RefreshCw } from 'lucide-react';
import api from '@/api/client';
import type { CustomDomainInfo } from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import Layout from '@/components/Layout';
import { Icon, PageHeader, Button } from '@/components/ui';
import { buildTenantUrl } from '@/lib/subdomain';
import { isReservedSlug } from '@/lib/reservedSlugs';

interface IdentityField {
  key: string;
  label: string;
  type: string;
  required: boolean;
}

interface Organization {
  id: string;
  name: string;
  slug?: string;
  email?: string;
  phone?: string;
  identityFieldsConfig?: Record<string, { required: boolean; label: string; type?: string }>;
  defaultDisplayMode?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  hidePoweredBy?: boolean;
}

const DEFAULT_IDENTITY_FIELDS: IdentityField[] = [
  { key: 'firstName', label: 'First Name', type: 'text', required: false },
  { key: 'lastName', label: 'Last Name', type: 'text', required: false },
  { key: 'phone', label: 'Phone Number', type: 'tel', required: false },
  { key: 'mrNumber', label: 'MR Number', type: 'text', required: false },
  { key: 'patientId', label: 'Patient ID', type: 'text', required: false },
  { key: 'nationalId', label: 'National ID', type: 'text', required: false },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', required: false },
  { key: 'gender', label: 'Gender', type: 'select', required: false },
  { key: 'email', label: 'Email Address', type: 'email', required: false },
  { key: 'insuranceId', label: 'Insurance ID', type: 'text', required: false },
];

const COLOR_PRESETS = [
  { name: 'Teal', value: '#14b8a6' },
  { name: 'Blue', value: '#2563eb' },
  { name: 'Purple', value: '#7c3aed' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Green', value: '#16a34a' },
];

const DISPLAY_MODES = [
  { value: 'TICKET_ONLY', label: 'Ticket Number Only', description: 'Display only the ticket number on queue boards' },
  { value: 'NAME_AND_TICKET', label: 'Name & Ticket', description: 'Show patient name with ticket number' },
  { value: 'FULL_INFO', label: 'Full Information', description: 'Display name, ticket and additional info' },
];

export default function AdminSettingsPage() {
  const { user, isAdmin } = useAuthContext();
  const { hasFeature } = useSubscription();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'identity' | 'display' | 'branding' | 'domain'>('general');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
    primaryColor: '',
    hidePoweredBy: false,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Custom domain configuration
  const [customDomain, setCustomDomainState] = useState<CustomDomainInfo | null>(null);
  const [domainInput, setDomainInput] = useState('');
  const [domainLoading, setDomainLoading] = useState(true);
  const [domainSaving, setDomainSaving] = useState(false);
  const [domainVerifying, setDomainVerifying] = useState(false);
  const [domainMessage, setDomainMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Identity fields configuration
  const [identityFields, setIdentityFields] = useState<IdentityField[]>([]);
  const [customField, setCustomField] = useState({ key: '', label: '', type: 'text' });
  const [displayMode, setDisplayMode] = useState('TICKET_ONLY');

  useEffect(() => {
    if (isAdmin && user?.organizationId) {
      loadOrganization();
      loadCustomDomain(user.organizationId);
    } else {
      setLoading(false);
      setDomainLoading(false);
    }
  }, [isAdmin, user]);

  const loadCustomDomain = async (organizationId: string) => {
    setDomainLoading(true);
    try {
      const domain = await api.getCustomDomain(organizationId);
      setCustomDomainState(domain);
    } catch (err) {
      console.error(err);
    } finally {
      setDomainLoading(false);
    }
  };

  const loadOrganization = async () => {
    try {
      const org = await api.getOrganization(user!.organizationId!);
      setOrganization(org);
      setFormData({
        name: org.name || '',
        slug: org.slug || '',
        email: org.email || '',
        phone: org.phone || '',
        primaryColor: org.primaryColor || '',
        hidePoweredBy: org.hidePoweredBy || false,
      });
      
      // Load identity fields config
      if (org.identityFieldsConfig) {
        const fields = Object.entries(org.identityFieldsConfig).map(([key, config]: [string, any]) => ({
          key,
          label: config.label || key,
          type: config.type || 'text',
          required: config.required || false,
        }));
        setIdentityFields(fields);
      } else {
        // Use defaults - all fields optional by default
        setIdentityFields(DEFAULT_IDENTITY_FIELDS.slice(0, 3).map(f => ({
          ...f,
          required: false,
        })));
      }
      
      setDisplayMode(org.defaultDisplayMode || 'TICKET_ONLY');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;

    if (formData.slug && isReservedSlug(formData.slug)) {
      setMessage({ type: 'error', text: 'This slug is reserved and cannot be used.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    try {
      // Build identity fields config
      const identityFieldsConfig: Record<string, { required: boolean; label: string; type?: string }> = {};
      identityFields.forEach(field => {
        identityFieldsConfig[field.key] = {
          required: field.required,
          label: field.label,
          type: field.type,
        };
      });

      const updated = await api.updateOrganization(organization.id, {
        name: formData.name,
        slug: formData.slug || undefined,
        email: formData.email || undefined,
        phone: formData.phone || undefined,
        identityFieldsConfig,
        defaultDisplayMode: displayMode,
        primaryColor: formData.primaryColor || null,
        hidePoweredBy: formData.hidePoweredBy,
      });
      setOrganization(updated);
      setMessage({ type: 'success', text: 'Organization settings saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async () => {
    if (!organization || !logoFile) return;

    setUploadingLogo(true);
    setMessage(null);
    try {
      const result = await api.uploadOrganizationLogo(organization.id, logoFile);
      setOrganization({ ...organization, logoUrl: result.logoUrl });
      setLogoFile(null);
      setMessage({ type: 'success', text: 'Logo uploaded successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to upload logo' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSetCustomDomain = async () => {
    if (!organization || !domainInput.trim()) return;
    setDomainSaving(true);
    setDomainMessage(null);
    try {
      const result = await api.setCustomDomain(organization.id, domainInput.trim());
      setCustomDomainState(result);
      setDomainInput('');
      setDomainMessage({ type: 'success', text: 'Domain saved. Add the CNAME record below, then verify.' });
    } catch (err: any) {
      setDomainMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save domain' });
    } finally {
      setDomainSaving(false);
    }
  };

  const handleVerifyCustomDomain = async () => {
    if (!organization) return;
    setDomainVerifying(true);
    setDomainMessage(null);
    try {
      const result = await api.verifyCustomDomain(organization.id);
      setCustomDomainState(result);
      setDomainMessage({ type: 'success', text: 'Domain verified! It now serves your branded login page.' });
    } catch (err: any) {
      setDomainMessage({ type: 'error', text: err.response?.data?.message || err.response?.data?.error || 'Verification failed' });
    } finally {
      setDomainVerifying(false);
    }
  };

  const handleRemoveCustomDomain = async () => {
    if (!organization) return;
    setDomainSaving(true);
    setDomainMessage(null);
    try {
      await api.deleteCustomDomain(organization.id);
      setCustomDomainState(null);
      setDomainMessage({ type: 'success', text: 'Custom domain removed.' });
    } catch (err: any) {
      setDomainMessage({ type: 'error', text: err.response?.data?.error || 'Failed to remove domain' });
    } finally {
      setDomainSaving(false);
    }
  };

  const toggleFieldRequired = (key: string) => {
    setIdentityFields(fields => 
      fields.map(f => f.key === key ? { ...f, required: !f.required } : f)
    );
  };

  const addField = (field: IdentityField) => {
    if (!identityFields.find(f => f.key === field.key)) {
      setIdentityFields([...identityFields, field]);
    }
  };

  const removeField = (key: string) => {
    // Don't allow removing firstName
    if (key === 'firstName') return;
    setIdentityFields(fields => fields.filter(f => f.key !== key));
  };

  const addCustomField = () => {
    if (!customField.key || !customField.label) return;
    const key = customField.key.replace(/\s+/g, '').toLowerCase();
    if (identityFields.find(f => f.key === key)) {
      setMessage({ type: 'error', text: 'Field already exists' });
      return;
    }
    setIdentityFields([...identityFields, { ...customField, key, required: false }]);
    setCustomField({ key: '', label: '', type: 'text' });
  };

  const generateSlug = () => {
    const slug = formData.name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    setFormData({ ...formData, slug });
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div style={{ padding: 20 }}>Admins only</div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '3rem', textAlign: 'center' }}>
          <div className="spinner" />
        </div>
      </Layout>
    );
  }

  if (!user?.organizationId && !organization) {
    return (
      <Layout>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
          No organization is associated with this account.
        </div>
      </Layout>
    );
  }

  // Available fields that haven't been added yet
  const availableFields = DEFAULT_IDENTITY_FIELDS.filter(
    f => !identityFields.find(existing => existing.key === f.key)
  );

  return (
    <Layout>
      <div>
        <PageHeader
          icon={Settings}
          title="Organization Settings"
          subtitle="Manage your organization details, customer fields, and display preferences."
        />

        {/* Message */}
        {message && (
          <div style={{
            padding: '1rem',
            borderRadius: '0.75rem',
            marginBottom: '1.5rem',
            background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#dc2626',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fecaca'}`,
          }}>
            {message.text}
          </div>
        )}

        {/* Tabs */}
        <div style={tabsContainer}>
          <button
            type="button"
            onClick={() => setActiveTab('general')}
            style={activeTab === 'general' ? activeTabStyle : tabStyle}
          >
            General
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('identity')}
            style={activeTab === 'identity' ? activeTabStyle : tabStyle}
          >
            Customer Fields
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('display')}
            style={activeTab === 'display' ? activeTabStyle : tabStyle}
          >
            Display Settings
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            style={activeTab === 'branding' ? activeTabStyle : tabStyle}
          >
            Branding
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('domain')}
            style={activeTab === 'domain' ? activeTabStyle : tabStyle}
          >
            Domain
          </button>
        </div>

        {/* Settings Form */}
        <div style={formCard}>
          <form onSubmit={handleSave}>
            {/* General Tab */}
            {activeTab === 'general' && (
              <>
                <div style={sectionHeader}>
                  <h2 style={sectionTitle}>Basic Information</h2>
                </div>

                <div style={formGrid}>
                  <div style={formField}>
                    <label style={labelStyle}>Organization Name *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                      style={inputStyle}
                    />
                  </div>

                  <div style={formField}>
                    <label style={labelStyle}>Contact Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contact@yourorg.com"
                      style={inputStyle}
                    />
                  </div>

                  <div style={formField}>
                    <label style={labelStyle}>Phone Number</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="+1 (555) 000-0000"
                      style={inputStyle}
                    />
                  </div>
                </div>

                {/* URL Settings Section */}
                <div style={{ ...sectionHeader, marginTop: '2rem' }}>
                  <h2 style={sectionTitle}>URL Settings</h2>
                </div>

                <div style={formField}>
                  <label style={labelStyle}>Organization Slug</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="text"
                      value={formData.slug}
                      onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      placeholder="your-org-name"
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button type="button" onClick={generateSlug} style={generateButton}>
                      Generate
                    </button>
                  </div>
                  <p style={helpText}>
                    {formData.slug && isReservedSlug(formData.slug) ? (
                      <span style={{ color: '#dc2626' }}>This slug is reserved and can&apos;t be used.</span>
                    ) : formData.slug ? (
                      <>Your workspace URL will be: <strong>{buildTenantUrl(formData.slug).replace(/^https?:\/\//, '')}</strong></>
                    ) : (
                      'Create a memorable URL slug for your organization'
                    )}
                  </p>
                </div>
              </>
            )}

            {/* Identity Fields Tab */}
            {activeTab === 'identity' && (
              <>
                <div style={sectionHeader}>
                  <h2 style={sectionTitle}>Customer Identification Fields</h2>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Configure what information to collect from customers when they join queues.
                  </p>
                </div>

                {/* Active Fields */}
                <div style={{ marginBottom: '1.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                    Active Fields
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {identityFields.map(field => (
                      <div key={field.key} style={fieldRow}>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 500 }}>{field.label}</span>
                          <span style={{ color: '#9ca3af', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                            ({field.key})
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={() => toggleFieldRequired(field.key)}
                              disabled={field.key === 'firstName'}
                            />
                            <span style={{ fontSize: '0.8125rem', color: '#6b7280' }}>Required</span>
                          </label>
                          {field.key !== 'firstName' && (
                            <button
                              type="button"
                              onClick={() => removeField(field.key)}
                              style={removeButton}
                            >
                              ✕
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Add Standard Fields */}
                {availableFields.length > 0 && (
                  <div style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                      Add Standard Field
                    </h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {availableFields.map(field => (
                        <button
                          key={field.key}
                          type="button"
                          onClick={() => addField(field)}
                          style={addFieldButton}
                        >
                          + {field.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add Custom Field */}
                <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: '0.5rem' }}>
                  <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#374151', marginBottom: '0.75rem' }}>
                    Add Custom Field
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="text"
                      placeholder="Field Key (e.g., referralSource)"
                      value={customField.key}
                      onChange={(e) => setCustomField({ ...customField, key: e.target.value })}
                      style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
                    />
                    <input
                      type="text"
                      placeholder="Display Label"
                      value={customField.label}
                      onChange={(e) => setCustomField({ ...customField, label: e.target.value })}
                      style={{ ...inputStyle, flex: 1, minWidth: '150px' }}
                    />
                    <select
                      value={customField.type}
                      onChange={(e) => setCustomField({ ...customField, type: e.target.value })}
                      style={{ ...inputStyle, width: '120px' }}
                    >
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="date">Date</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                    </select>
                    <button type="button" onClick={addCustomField} style={addButton}>
                      Add
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* Display Settings Tab */}
            {activeTab === 'display' && (
              <>
                <div style={sectionHeader}>
                  <h2 style={sectionTitle}>Queue Display Preferences</h2>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Control how customer information appears on display boards.
                  </p>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {DISPLAY_MODES.map(mode => (
                    <label
                      key={mode.value}
                      style={{
                        ...displayModeOption,
                        borderColor: displayMode === mode.value ? '#14b8a6' : '#e5e7eb',
                        background: displayMode === mode.value ? 'rgba(20, 184, 166, 0.08)' : 'white',
                      }}
                    >
                      <input
                        type="radio"
                        name="displayMode"
                        value={mode.value}
                        checked={displayMode === mode.value}
                        onChange={(e) => setDisplayMode(e.target.value)}
                        style={{ marginRight: '0.75rem' }}
                      />
                      <div>
                        <div style={{ fontWeight: 500, color: '#111827' }}>{mode.label}</div>
                        <div style={{ fontSize: '0.8125rem', color: '#6b7280' }}>{mode.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </>
            )}

            {/* Branding Tab */}
            {activeTab === 'branding' && (
              <>
                <div style={sectionHeader}>
                  <h2 style={sectionTitle}>White-Labeling</h2>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Show your own logo and colors on your login screen, public join page, and status display.
                  </p>
                </div>

                {!hasFeature('customBranding') ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.75rem', color: '#92400e' }}>
                    <Icon icon={Lock} size={20} />
                    <span>White-labeling isn&apos;t included in your current plan. Upgrade to customize your branding.</span>
                  </div>
                ) : (
                  <>
                    <div style={formField}>
                      <label style={labelStyle}>Logo</label>
                      {organization?.logoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={organization.logoUrl} alt="Current logo" style={{ height: '48px', marginBottom: '0.75rem', display: 'block' }} />
                      )}
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/svg+xml,image/webp"
                          onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                        />
                        <Button type="button" variant="secondary" disabled={!logoFile || uploadingLogo} onClick={handleLogoUpload}>
                          <Icon icon={Upload} size={16} /> {uploadingLogo ? 'Uploading...' : 'Upload'}
                        </Button>
                      </div>
                    </div>

                    <div style={formField}>
                      <label style={labelStyle}>Primary Color</label>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                          type="color"
                          value={formData.primaryColor || '#14b8a6'}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          style={{ width: '48px', height: '40px', padding: '0.25rem', border: '1px solid #e5e7eb', borderRadius: '0.5rem' }}
                        />
                        <input
                          type="text"
                          value={formData.primaryColor}
                          onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                          placeholder="#14b8a6"
                          style={{ ...inputStyle, maxWidth: '160px' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {COLOR_PRESETS.map(preset => (
                          <button
                            key={preset.value}
                            type="button"
                            onClick={() => setFormData({ ...formData, primaryColor: preset.value })}
                            title={preset.name}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '9999px',
                              background: preset.value,
                              cursor: 'pointer',
                              border: formData.primaryColor?.toLowerCase() === preset.value
                                ? '2px solid #111827'
                                : '2px solid transparent',
                              boxShadow: '0 0 0 1px rgba(0,0,0,0.08)',
                              padding: 0,
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <input
                        type="checkbox"
                        checked={formData.hidePoweredBy}
                        onChange={(e) => setFormData({ ...formData, hidePoweredBy: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                      <span style={{ color: '#374151' }}>Hide &quot;Powered by QueueFlow&quot;</span>
                    </label>
                  </>
                )}
              </>
            )}

            {/* Domain Tab */}
            {activeTab === 'domain' && (
              <>
                <div style={sectionHeader}>
                  <h2 style={sectionTitle}>Custom Domain</h2>
                  <p style={{ color: '#6b7280', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Point your own domain at your workspace so staff sign in at your address instead of a QueueFlow subdomain.
                  </p>
                </div>

                {!hasFeature('customDomain') ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1.25rem', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '0.75rem', color: '#92400e' }}>
                    <Icon icon={Lock} size={20} />
                    <span>Custom domains aren&apos;t included in your current plan. Upgrade to connect your own domain.</span>
                  </div>
                ) : domainLoading ? (
                  <div style={{ padding: '1rem', color: '#6b7280' }}>Loading...</div>
                ) : (
                  <>
                    {domainMessage && (
                      <div style={{
                        padding: '0.875rem 1rem',
                        borderRadius: '0.625rem',
                        marginBottom: '1.25rem',
                        background: domainMessage.type === 'success' ? '#dcfce7' : '#fef2f2',
                        color: domainMessage.type === 'success' ? '#166534' : '#dc2626',
                        border: `1px solid ${domainMessage.type === 'success' ? '#86efac' : '#fecaca'}`,
                        fontSize: '0.875rem',
                      }}>
                        {domainMessage.text}
                      </div>
                    )}

                    {!customDomain ? (
                      <div style={formField}>
                        <label style={labelStyle}>Domain</label>
                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          <input
                            type="text"
                            value={domainInput}
                            onChange={(e) => setDomainInput(e.target.value)}
                            placeholder="queue.yourcompany.com"
                            style={{ ...inputStyle, flex: 1 }}
                          />
                          <Button type="button" variant="primary" disabled={!domainInput.trim() || domainSaving} onClick={handleSetCustomDomain}>
                            <Icon icon={Globe} size={16} /> {domainSaving ? 'Saving...' : 'Add Domain'}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
                          <span style={{ fontWeight: 600, fontSize: '1rem', color: '#111827' }}>{customDomain.domain}</span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            padding: '0.2rem 0.6rem',
                            borderRadius: '9999px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            background: customDomain.status === 'VERIFIED' ? '#dcfce7' : '#fef3c7',
                            color: customDomain.status === 'VERIFIED' ? '#166534' : '#854d0e',
                          }}>
                            {customDomain.status === 'VERIFIED' && <Icon icon={CheckCircle2} size={12} />}
                            {customDomain.status === 'VERIFIED' ? 'Verified' : 'Pending verification'}
                          </span>
                        </div>

                        {customDomain.status !== 'VERIFIED' && (
                          <div style={{ padding: '1rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.75rem', marginBottom: '1.25rem' }}>
                            <p style={{ fontSize: '0.875rem', color: '#374151', marginBottom: '0.75rem' }}>
                              Add this CNAME record at your DNS provider, then verify:
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.5rem 1rem', fontSize: '0.8125rem', fontFamily: 'monospace' }}>
                              <span style={{ color: '#6b7280' }}>Type</span>
                              <span>CNAME</span>
                              <span style={{ color: '#6b7280' }}>Name</span>
                              <span>{customDomain.domain}</span>
                              <span style={{ color: '#6b7280' }}>Value</span>
                              <span>{customDomain.cnameTarget}</span>
                            </div>
                            <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: '0.75rem' }}>
                              DNS changes can take a few minutes to a few hours to propagate.
                            </p>
                          </div>
                        )}

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                          {customDomain.status !== 'VERIFIED' && (
                            <Button type="button" variant="primary" disabled={domainVerifying} onClick={handleVerifyCustomDomain}>
                              <Icon icon={RefreshCw} size={16} /> {domainVerifying ? 'Checking...' : 'Verify'}
                            </Button>
                          )}
                          <Button type="button" variant="secondary" disabled={domainSaving} onClick={handleRemoveCustomDomain}>
                            Remove Domain
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}

            {/* Save Button */}
            {activeTab !== 'domain' && (
              <div style={formActions}>
                <button type="submit" disabled={saving} style={saveButton}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </form>
        </div>

        {/* Organization ID Info */}
        <div style={infoCard}>
          <div style={{ marginBottom: '0.5rem' }}>
            <Icon icon={Info} size={20} color="#6b7280" />
          </div>
          <div>
            <p style={{ color: '#374151', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
              <strong>Organization ID:</strong>
            </p>
            <code style={codeStyle}>{organization?.id}</code>
            <p style={{ color: '#9ca3af', fontSize: '0.75rem', marginTop: '0.5rem' }}>
              This ID is used for API integrations and advanced configurations.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// Styles
const tabsContainer: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  marginBottom: '1rem',
  borderBottom: '1px solid #e5e7eb',
  paddingBottom: '0.5rem',
};

const tabStyle: React.CSSProperties = {
  padding: '0.5rem 1rem',
  border: 'none',
  background: 'transparent',
  color: '#6b7280',
  fontWeight: 500,
  cursor: 'pointer',
  borderRadius: '0.375rem',
  fontSize: '0.875rem',
};

const activeTabStyle: React.CSSProperties = {
  ...tabStyle,
  background: '#14b8a6',
  color: 'white',
};

const fieldRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '0.75rem 1rem',
  background: 'white',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
};

const removeButton: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  border: 'none',
  background: '#fef2f2',
  color: '#dc2626',
  borderRadius: '0.25rem',
  cursor: 'pointer',
  fontSize: '0.75rem',
};

const addFieldButton: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  border: '1px dashed #d1d5db',
  background: 'white',
  color: '#6b7280',
  borderRadius: '0.375rem',
  cursor: 'pointer',
  fontSize: '0.8125rem',
};

const addButton: React.CSSProperties = {
  padding: '0.75rem 1rem',
  border: 'none',
  background: '#14b8a6',
  color: 'white',
  borderRadius: '0.5rem',
  cursor: 'pointer',
  fontWeight: 500,
};

const displayModeOption: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  padding: '1rem',
  borderRadius: '0.5rem',
  border: '2px solid #e5e7eb',
  cursor: 'pointer',
  transition: 'all 0.15s',
};

const formCard: React.CSSProperties = {
  background: 'white',
  padding: '2rem',
  borderRadius: '1rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e5e7eb',
  marginBottom: '1.5rem',
};

const sectionHeader: React.CSSProperties = {
  marginBottom: '1rem',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  flexWrap: 'wrap',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#111827',
};

const formGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
  gap: '1rem',
};

const formField: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.375rem',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.875rem',
  fontWeight: 500,
  color: '#374151',
};

const inputStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  fontSize: '0.9375rem',
  background: '#f9fafb',
  color: '#111827',
};

const helpText: React.CSSProperties = {
  fontSize: '0.8125rem',
  color: '#6b7280',
  marginTop: '0.25rem',
};

const generateButton: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#374151',
  fontWeight: 500,
  cursor: 'pointer',
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
};

const comingSoonBadge: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  background: '#fef3c7',
  color: '#92400e',
  borderRadius: '0.375rem',
  fontSize: '0.75rem',
  fontWeight: 500,
};

const infoBox: React.CSSProperties = {
  padding: '1rem',
  background: '#f9fafb',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
};

const formActions: React.CSSProperties = {
  marginTop: '2rem',
  display: 'flex',
  justifyContent: 'flex-end',
};

const saveButton: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#14b8a6',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9375rem',
};

const infoCard: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  padding: '1rem',
  background: '#f0f9ff',
  borderRadius: '0.75rem',
  border: '1px solid #bae6fd',
};

const codeStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.25rem 0.5rem',
  background: '#e0f2fe',
  borderRadius: '0.25rem',
  fontSize: '0.8125rem',
  fontFamily: 'monospace',
  color: '#0369a1',
};
