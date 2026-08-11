'use client';

import React, { useEffect, useState } from 'react';
import api from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';

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

const DISPLAY_MODES = [
  { value: 'TICKET_ONLY', label: 'Ticket Number Only', description: 'Display only the ticket number on queue boards' },
  { value: 'NAME_AND_TICKET', label: 'Name & Ticket', description: 'Show patient name with ticket number' },
  { value: 'FULL_INFO', label: 'Full Information', description: 'Display name, ticket and additional info' },
];

export default function AdminSettingsPage() {
  const { user, isAdmin } = useAuthContext();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'general' | 'identity' | 'display'>('general');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    email: '',
    phone: '',
  });
  
  // Identity fields configuration
  const [identityFields, setIdentityFields] = useState<IdentityField[]>([]);
  const [customField, setCustomField] = useState({ key: '', label: '', type: 'text' });
  const [displayMode, setDisplayMode] = useState('TICKET_ONLY');

  useEffect(() => {
    if (isAdmin && user?.organizationId) {
      loadOrganization();
    } else {
      setLoading(false);
    }
  }, [isAdmin, user]);

  const loadOrganization = async () => {
    try {
      const org = await api.getOrganization(user!.organizationId!);
      setOrganization(org);
      setFormData({
        name: org.name || '',
        slug: org.slug || '',
        email: org.email || '',
        phone: org.phone || '',
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
      });
      setOrganization(updated);
      setMessage({ type: 'success', text: 'Organization settings saved successfully!' });
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to save settings' });
    } finally {
      setSaving(false);
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
      <div style={{ padding: '1.5rem', maxWidth: '900px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: '#111827' }}>
            Organization Settings
          </h1>
          <p style={{ color: '#6b7280' }}>
            Manage your organization details, customer fields, and display preferences.
          </p>
        </div>

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
                    {formData.slug ? (
                      <>Your public URL will be: <strong>yourdomain.com/{formData.slug}</strong></>
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
                        borderColor: displayMode === mode.value ? '#6366f1' : '#e5e7eb',
                        background: displayMode === mode.value ? '#eef2ff' : 'white',
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

            {/* Save Button */}
            <div style={formActions}>
              <button type="submit" disabled={saving} style={saveButton}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>

        {/* Organization ID Info */}
        <div style={infoCard}>
          <div style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>ℹ️</div>
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
  background: '#6366f1',
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
  background: '#6366f1',
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
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
  fontSize: '0.9375rem',
  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
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
