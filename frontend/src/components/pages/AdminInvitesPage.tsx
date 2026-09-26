'use client';

import React, { useEffect, useState } from 'react';
import { ClipboardList, Mail, Check, Link2, Copy } from 'lucide-react';
import api from '@/api/client';
import { useAuthContext } from '@/contexts/AuthContext';
import Layout from '@/components/Layout';
import { Icon, PageHeader } from '@/components/ui';

type Invite = {
  id: string;
  code: string;
  role: string;
  organizationId?: string | null;
  used: boolean;
  expiresAt?: string | null;
  createdAt: string;
  createdBy?: string | null;
  // Additional fields for invitee details
  inviteeEmail?: string;
  inviteeName?: string;
};

const AdminInvitesPage: React.FC = () => {
  const { user, isAdmin } = useAuthContext();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    role: 'SERVICE_STAFF',
    expiresAt: '',
    inviteeEmail: '',
    inviteeName: '',
  });

  useEffect(() => {
    if (isAdmin) {
      loadInvites();
    } else {
      setLoading(false);
    }
  }, [isAdmin]);

  const loadInvites = async () => {
    setLoading(true);
    try {
      const data = await api.getInvites();
      setInvites(data);
    } catch { /* ignore */ }
    finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = { role: formData.role };
      if (formData.expiresAt) payload.expiresAt = formData.expiresAt;
      if (user?.organizationId) payload.organizationId = user.organizationId;
      
      const res = await api.createInvite(payload);
      setInvites(prev => [res.invite, ...prev]);
      setShowForm(false);
      resetForm();
      
      // Auto-copy the new code
      if (res.invite.code) {
        copyToClipboard(res.invite.code);
      }
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create invite');
    }
  };

  const copyToClipboard = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch { /* ignore */ }
  };

  const copyInviteLink = async (code: string) => {
    const link = `${window.location.origin}/register?invite=${code}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setFormData({
      role: 'SERVICE_STAFF',
      expiresAt: '',
      inviteeEmail: '',
      inviteeName: '',
    });
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      SERVICE_STAFF: 'Service Staff',
      RECEPTIONIST: 'Receptionist',
      LOCATION_ADMIN: 'Location Admin',
      ORG_ADMIN: 'Organization Admin',
    };
    return labels[role] || role.replace('_', ' ');
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      SERVICE_STAFF: { bg: '#dbeafe', text: '#1d4ed8' },
      RECEPTIONIST: { bg: '#f3e8ff', text: '#7c3aed' },
      LOCATION_ADMIN: { bg: '#d1fae5', text: '#059669' },
      ORG_ADMIN: { bg: '#fee2e2', text: '#dc2626' },
    };
    return colors[role] || { bg: '#f3f4f6', text: '#374151' };
  };

  if (!isAdmin) {
    return (
      <Layout>
        <div style={{ padding: 20 }}>Admins only</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div>
        <PageHeader
          icon={Mail}
          title="Staff Invites"
          subtitle="Create invite codes for operators and staff to join your organization."
          actions={
            <button onClick={() => setShowForm(true)} style={addButton}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
              Create Invite
            </button>
          }
        />

        {/* How it works */}
        <div style={howItWorksCard}>
          <h3 style={{ fontWeight: 600, color: '#111827', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Icon icon={ClipboardList} size={20} color="#0e8f80" />
            How Invites Work
          </h3>
          <ol style={{ margin: 0, paddingLeft: '1.5rem', color: '#4b5563', fontSize: '0.9375rem', lineHeight: 1.8 }}>
            <li>Create an invite with the desired role for the new staff member</li>
            <li>Share the invite code or registration link with them</li>
            <li>They register at <code style={codeInline}>/register</code> using the invite code</li>
            <li>Once used, the invite is marked as consumed and cannot be reused</li>
          </ol>
        </div>

        {/* Create Form Modal */}
        {showForm && (
          <div style={modalOverlay} onClick={() => setShowForm(false)}>
            <div style={modalContent} onClick={e => e.stopPropagation()}>
              <div style={modalHeader}>
                <h2 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827' }}>Create New Invite</h2>
                <button onClick={() => setShowForm(false)} style={closeButton}>×</button>
              </div>
              <form onSubmit={handleCreate}>
                <div style={formGrid}>
                  <div style={formField}>
                    <label style={labelStyle}>Role *</label>
                    <select
                      value={formData.role}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                      style={selectStyle}
                    >
                      <option value="SERVICE_STAFF">Service Staff</option>
                      <option value="RECEPTIONIST">Receptionist</option>
                      <option value="LOCATION_ADMIN">Location Admin</option>
                      <option value="ORG_ADMIN">Organization Admin</option>
                    </select>
                    <p style={helpText}>
                      {formData.role === 'SERVICE_STAFF' && 'Can manage queues and serve customers'}
                      {formData.role === 'RECEPTIONIST' && 'Can check in appointments and manage queues'}
                      {formData.role === 'LOCATION_ADMIN' && 'Can manage a specific location and its services'}
                      {formData.role === 'ORG_ADMIN' && 'Full access to organization settings'}
                    </p>
                  </div>

                  <div style={formField}>
                    <label style={labelStyle}>Expires At (optional)</label>
                    <input
                      type="datetime-local"
                      value={formData.expiresAt}
                      onChange={(e) => setFormData({ ...formData, expiresAt: e.target.value })}
                      style={inputStyle}
                    />
                    <p style={helpText}>Leave empty for no expiration</p>
                  </div>

                  <div style={formField}>
                    <label style={labelStyle}>Invitee Name (optional)</label>
                    <input
                      type="text"
                      value={formData.inviteeName}
                      onChange={(e) => setFormData({ ...formData, inviteeName: e.target.value })}
                      placeholder="John Doe"
                      style={inputStyle}
                    />
                    <p style={helpText}>For your reference only</p>
                  </div>

                  <div style={formField}>
                    <label style={labelStyle}>Invitee Email (optional)</label>
                    <input
                      type="email"
                      value={formData.inviteeEmail}
                      onChange={(e) => setFormData({ ...formData, inviteeEmail: e.target.value })}
                      placeholder="john@example.com"
                      style={inputStyle}
                    />
                    <p style={helpText}>For your reference only</p>
                  </div>
                </div>

                <div style={formActions}>
                  <button type="button" onClick={() => setShowForm(false)} style={cancelButton}>
                    Cancel
                  </button>
                  <button type="submit" style={submitButton}>
                    Create Invite
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invites List */}
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" />
          </div>
        ) : invites.length === 0 ? (
          <div style={emptyState}>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'center' }}>
              <Icon icon={Mail} size={48} color="#0e8f80" strokeWidth={1.5} />
            </div>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#111827', marginBottom: '0.5rem' }}>
              No invites yet
            </h3>
            <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
              Create your first invite to add staff members to your organization.
            </p>
            <button onClick={() => setShowForm(true)} style={submitButton}>
              Create First Invite
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {invites.map(invite => (
              <div key={invite.id} style={inviteCard}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                    <code style={codeStyle}>{invite.code}</code>
                    <span style={{
                      ...roleBadge,
                      background: getRoleBadgeColor(invite.role).bg,
                      color: getRoleBadgeColor(invite.role).text,
                    }}>
                      {getRoleLabel(invite.role)}
                    </span>
                    {invite.used ? (
                      <span style={usedBadge}><Icon icon={Check} size={12} /> Used</span>
                    ) : (
                      <span style={availableBadge}>Available</span>
                    )}
                  </div>
                  <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                    Created {new Date(invite.createdAt).toLocaleDateString()}
                    {invite.expiresAt && ` • Expires ${new Date(invite.expiresAt).toLocaleDateString()}`}
                  </div>
                </div>
                
                {!invite.used && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      onClick={() => copyToClipboard(invite.code)}
                      style={actionButton}
                      title="Copy code"
                    >
                      <Icon icon={copiedCode === invite.code ? Check : Copy} size={16} />
                    </button>
                    <button
                      onClick={() => copyInviteLink(invite.code)}
                      style={actionButton}
                      title="Copy registration link"
                    >
                      <Icon icon={Link2} size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
};

// Styles
const addButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: 'white',
  color: '#0e8f80',
  borderRadius: '0.75rem',
  border: 'none',
  fontWeight: 600,
  fontSize: '0.9375rem',
  cursor: 'pointer',
  boxShadow: '0 4px 14px rgba(0, 0, 0, 0.15)',
};

const howItWorksCard: React.CSSProperties = {
  background: '#f0f9ff',
  border: '1px solid #bae6fd',
  borderRadius: '0.75rem',
  padding: '1.25rem',
  marginBottom: '1.5rem',
};

const codeInline: React.CSSProperties = {
  background: '#e0f2fe',
  padding: '0.125rem 0.375rem',
  borderRadius: '0.25rem',
  fontSize: '0.875rem',
  fontFamily: 'monospace',
};

const modalOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: '1rem',
};

const modalContent: React.CSSProperties = {
  background: 'white',
  borderRadius: '1rem',
  padding: '1.5rem',
  maxWidth: '500px',
  width: '100%',
  maxHeight: '90vh',
  overflow: 'auto',
};

const modalHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1.5rem',
};

const closeButton: React.CSSProperties = {
  background: 'none',
  border: 'none',
  fontSize: '1.5rem',
  color: '#9ca3af',
  cursor: 'pointer',
  padding: '0.25rem',
};

const formGrid: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
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

const selectStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  fontSize: '0.9375rem',
  background: '#f9fafb',
  color: '#111827',
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
  fontSize: '0.75rem',
  color: '#9ca3af',
};

const formActions: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
  marginTop: '1.5rem',
};

const cancelButton: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  background: 'white',
  color: '#374151',
  fontWeight: 500,
  cursor: 'pointer',
};

const submitButton: React.CSSProperties = {
  padding: '0.625rem 1.25rem',
  borderRadius: '0.5rem',
  border: 'none',
  background: '#0e8f80',
  color: 'white',
  fontWeight: 600,
  cursor: 'pointer',
};

const emptyState: React.CSSProperties = {
  textAlign: 'center',
  padding: '3rem',
  background: 'white',
  borderRadius: '1rem',
  border: '1px solid #e5e7eb',
};

const inviteCard: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem 1.25rem',
  background: 'white',
  borderRadius: '0.75rem',
  border: '1px solid #e5e7eb',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
};

const codeStyle: React.CSSProperties = {
  background: '#f3f4f6',
  padding: '0.375rem 0.625rem',
  borderRadius: '0.375rem',
  fontFamily: 'monospace',
  fontSize: '0.9375rem',
  fontWeight: 600,
  color: '#111827',
};

const roleBadge: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  borderRadius: '0.375rem',
  fontSize: '0.75rem',
  fontWeight: 500,
};

const usedBadge: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.25rem 0.5rem',
  borderRadius: '0.375rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  background: '#f3f4f6',
  color: '#6b7280',
};

const availableBadge: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  borderRadius: '0.375rem',
  fontSize: '0.75rem',
  fontWeight: 500,
  background: '#dcfce7',
  color: '#166534',
};

const actionButton: React.CSSProperties = {
  width: '36px',
  height: '36px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  borderRadius: '0.5rem',
  border: '1px solid #e5e7eb',
  background: 'white',
  cursor: 'pointer',
  fontSize: '1rem',
};

export default AdminInvitesPage;
