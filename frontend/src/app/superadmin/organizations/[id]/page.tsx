'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/api/client';

interface OrganizationDetail {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEndsAt: string | null;
    cancelledAt: string | null;
    cancelReason: string | null;
    plan?: {
      id: string;
      name: string;
      code: string;
      priceMonthly: string;
      priceYearly: string;
      features: Record<string, boolean>;
    };
  };
  locations: Array<{
    id: string;
    name: string;
    address: string | null;
    publicCode: string | null;
    _count: { services: number; servicePoints: number };
  }>;
  users: Array<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: string;
    createdAt: string;
  }>;
  _count: {
    locations: number;
    users: number;
    dataSources: number;
  };
}

interface UsageData {
  usage: {
    locations: { used: number; limit: number | null; percentage: string | null };
    users: { used: number; limit: number | null; percentage: string | null };
    services: { used: number; limitPerLocation: number | null };
    queueEntries: { today: number; thisMonth: number; dailyLimit: number | null };
  };
}

export default function OrganizationDetailPage({ 
  params 
}: { 
  params: Promise<{ id: string }> 
}) {
  const resolvedParams = use(params);
  const { id } = resolvedParams;
  const router = useRouter();
  
  const [org, setOrg] = useState<OrganizationDetail | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadOrganization();
  }, [id]);

  const loadOrganization = async () => {
    try {
      setLoading(true);
      const [orgData, usageData] = await Promise.all([
        api.getSuperadminOrganization(id),
        api.getSuperadminOrganizationUsage(id),
      ]);
      setOrg(orgData);
      setUsage(usageData);
    } catch (err) {
      console.error('Failed to load organization', err);
      setError('Failed to load organization');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!confirm('Cancel this subscription? The organization will lose access at the end of their billing period.')) return;
    
    const reason = prompt('Reason for cancellation (optional):');
    
    setCancelling(true);
    try {
      await api.cancelOrganizationSubscription(id, reason || undefined);
      loadOrganization();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setCancelling(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('DELETE this organization? This action is IRREVERSIBLE and will delete ALL data including locations, services, users, and queue history.')) return;
    if (!confirm('Are you ABSOLUTELY sure? Type DELETE to confirm.')) return;
    
    setDeleting(true);
    try {
      await api.deleteSuperadminOrganization(id);
      router.push('/superadmin/organizations');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete organization');
      setDeleting(false);
    }
  };

  const getStatusBadge = (status?: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '0.375rem 0.875rem',
      borderRadius: '9999px',
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'uppercase' as const,
    };
    
    switch (status) {
      case 'ACTIVE':
        return { ...base, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
      case 'TRIAL':
        return { ...base, background: 'rgba(20, 184, 166, 0.2)', color: '#5eead4' };
      case 'PAST_DUE':
        return { ...base, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      case 'CANCELLED':
      case 'EXPIRED':
        return { ...base, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
      default:
        return { ...base, background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' };
    }
  };

  const getRoleBadge = (role: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '0.25rem 0.5rem',
      borderRadius: '4px',
      fontSize: '0.75rem',
      fontWeight: 500,
    };
    
    switch (role) {
      case 'ORG_ADMIN':
        return { ...base, background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' };
      case 'LOCATION_ADMIN':
        return { ...base, background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' };
      case 'SERVICE_STAFF':
        return { ...base, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
      default:
        return { ...base, background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' };
    }
  };

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div style={spinner} />
        <p style={{ color: '#94a3b8' }}>Loading organization...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div style={errorContainer}>
        <p style={{ color: '#f87171' }}>{error || 'Organization not found'}</p>
        <Link href="/superadmin/organizations" style={backBtn}>← Back to Organizations</Link>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <header style={header}>
        <div style={headerLeft}>
          <Link href="/superadmin/organizations" style={backLink}>← Back</Link>
          <div>
            <h1 style={pageTitle}>{org.name}</h1>
            <p style={subtitle}>{org.slug || org.email || 'No identifier'}</p>
          </div>
        </div>
        <div style={headerActions}>
          <span style={getStatusBadge(org.subscription?.status)}>
            {org.subscription?.status || 'No Plan'}
          </span>
        </div>
      </header>

      {error && (
        <div style={errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={dismissBtn}>✕</button>
        </div>
      )}

      <div style={contentGrid}>
        {/* Organization Info */}
        <div style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Organization Details</h2>
          </div>
          <div style={cardBody}>
            <div style={infoGrid}>
              <div style={infoItem}>
                <span style={infoLabel}>Name</span>
                <span style={infoValue}>{org.name}</span>
              </div>
              <div style={infoItem}>
                <span style={infoLabel}>Slug</span>
                <span style={infoValue}>{org.slug || '—'}</span>
              </div>
              <div style={infoItem}>
                <span style={infoLabel}>Email</span>
                <span style={infoValue}>{org.email || '—'}</span>
              </div>
              <div style={infoItem}>
                <span style={infoLabel}>Phone</span>
                <span style={infoValue}>{org.phone || '—'}</span>
              </div>
              <div style={infoItem}>
                <span style={infoLabel}>Created</span>
                <span style={infoValue}>{new Date(org.createdAt).toLocaleDateString()}</span>
              </div>
              <div style={infoItem}>
                <span style={infoLabel}>Updated</span>
                <span style={infoValue}>{new Date(org.updatedAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Subscription Info */}
        <div style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Subscription</h2>
            {org.subscription && org.subscription.status !== 'CANCELLED' && (
              <button 
                onClick={handleCancelSubscription} 
                disabled={cancelling}
                style={cancelBtn}
              >
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}
          </div>
          <div style={cardBody}>
            {org.subscription ? (
              <div style={infoGrid}>
                <div style={infoItem}>
                  <span style={infoLabel}>Plan</span>
                  <span style={infoValue}>{org.subscription.plan?.name || 'Unknown'}</span>
                </div>
                <div style={infoItem}>
                  <span style={infoLabel}>Billing</span>
                  <span style={infoValue}>{org.subscription.billingCycle}</span>
                </div>
                <div style={infoItem}>
                  <span style={infoLabel}>Price</span>
                  <span style={infoValue}>
                    ${org.subscription.billingCycle === 'yearly' 
                      ? org.subscription.plan?.priceYearly 
                      : org.subscription.plan?.priceMonthly}/
                    {org.subscription.billingCycle === 'yearly' ? 'yr' : 'mo'}
                  </span>
                </div>
                <div style={infoItem}>
                  <span style={infoLabel}>Period End</span>
                  <span style={infoValue}>
                    {new Date(org.subscription.currentPeriodEnd).toLocaleDateString()}
                  </span>
                </div>
                {org.subscription.trialEndsAt && (
                  <div style={infoItem}>
                    <span style={infoLabel}>Trial Ends</span>
                    <span style={infoValue}>
                      {new Date(org.subscription.trialEndsAt).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {org.subscription.cancelledAt && (
                  <>
                    <div style={infoItem}>
                      <span style={infoLabel}>Cancelled At</span>
                      <span style={infoValue}>
                        {new Date(org.subscription.cancelledAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div style={infoItem}>
                      <span style={infoLabel}>Cancel Reason</span>
                      <span style={infoValue}>{org.subscription.cancelReason || '—'}</span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <p style={noData}>No active subscription</p>
            )}
          </div>
        </div>

        {/* Usage Stats */}
        {usage && (
          <div style={card}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Usage</h2>
            </div>
            <div style={cardBody}>
              <div style={usageGrid}>
                <div style={usageItem}>
                  <div style={usageHeader}>
                    <span style={usageLabel}>Locations</span>
                    <span style={usageValue}>
                      {usage.usage.locations.used}
                      {usage.usage.locations.limit && ` / ${usage.usage.locations.limit}`}
                    </span>
                  </div>
                  {usage.usage.locations.percentage && (
                    <div style={progressBar}>
                      <div style={{ ...progressFill, width: `${usage.usage.locations.percentage}%` }} />
                    </div>
                  )}
                </div>
                <div style={usageItem}>
                  <div style={usageHeader}>
                    <span style={usageLabel}>Users</span>
                    <span style={usageValue}>
                      {usage.usage.users.used}
                      {usage.usage.users.limit && ` / ${usage.usage.users.limit}`}
                    </span>
                  </div>
                  {usage.usage.users.percentage && (
                    <div style={progressBar}>
                      <div style={{ ...progressFill, width: `${usage.usage.users.percentage}%` }} />
                    </div>
                  )}
                </div>
                <div style={usageItem}>
                  <div style={usageHeader}>
                    <span style={usageLabel}>Queue Entries Today</span>
                    <span style={usageValue}>
                      {usage.usage.queueEntries.today}
                      {usage.usage.queueEntries.dailyLimit && ` / ${usage.usage.queueEntries.dailyLimit}`}
                    </span>
                  </div>
                </div>
                <div style={usageItem}>
                  <div style={usageHeader}>
                    <span style={usageLabel}>Entries This Month</span>
                    <span style={usageValue}>{usage.usage.queueEntries.thisMonth}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Locations */}
        <div style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Locations ({org.locations.length})</h2>
          </div>
          <div style={cardBody}>
            {org.locations.length > 0 ? (
              <div style={listContainer}>
                {org.locations.map(loc => (
                  <div key={loc.id} style={listItem}>
                    <div style={listItemMain}>
                      <span style={listItemName}>{loc.name}</span>
                      <span style={listItemMeta}>{loc.address || 'No address'}</span>
                    </div>
                    <div style={listItemStats}>
                      <span>{loc._count.services} services</span>
                      <span>{loc._count.servicePoints} desks</span>
                      {loc.publicCode && <span style={publicCodeBadge}>{loc.publicCode}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p style={noData}>No locations</p>
            )}
          </div>
        </div>

        {/* Users */}
        <div style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Users ({org.users.length})</h2>
          </div>
          <div style={cardBody}>
            {org.users.length > 0 ? (
              <div style={listContainer}>
                {org.users.map(user => (
                  <div key={user.id} style={listItem}>
                    <div style={listItemMain}>
                      <span style={listItemName}>{user.firstName} {user.lastName}</span>
                      <span style={listItemMeta}>{user.email}</span>
                    </div>
                    <span style={getRoleBadge(user.role)}>{user.role.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={noData}>No users</p>
            )}
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div style={dangerCard}>
        <h3 style={dangerTitle}>Danger Zone</h3>
        <p style={dangerText}>
          Deleting this organization will permanently remove all data including locations, services, 
          users, queue history, and settings. This action cannot be undone.
        </p>
        <button 
          onClick={handleDelete} 
          disabled={deleting}
          style={deleteBtn}
        >
          {deleting ? 'Deleting...' : 'Delete Organization'}
        </button>
      </div>
    </div>
  );
}

// Styles
const loadingContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '50vh',
  gap: '1rem',
};

const spinner: React.CSSProperties = {
  width: '40px',
  height: '40px',
  border: '4px solid #1e293b',
  borderTop: '4px solid #14b8a6',
  borderRadius: '50%',
  animation: 'spin 1s linear infinite',
};

const errorContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '50vh',
  gap: '1rem',
};

const backBtn: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: '#14b8a6',
  color: '#fff',
  borderRadius: '8px',
  textDecoration: 'none',
};

const pageContainer: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
};

const header: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '2rem',
};

const headerLeft: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const backLink: React.CSSProperties = {
  color: '#64748b',
  textDecoration: 'none',
  fontSize: '0.875rem',
};

const pageTitle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  color: '#fff',
};

const subtitle: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '1rem',
};

const headerActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
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

const contentGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
  gap: '1.5rem',
  marginBottom: '2rem',
};

const card: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(20, 184, 166, 0.2)',
  overflow: 'hidden',
};

const cardHeader: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderBottom: '1px solid rgba(20, 184, 166, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const cardTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#fff',
};

const cancelBtn: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  background: 'rgba(245, 158, 11, 0.2)',
  color: '#f59e0b',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const cardBody: React.CSSProperties = {
  padding: '1.5rem',
};

const infoGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1rem',
};

const infoItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const infoLabel: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
  textTransform: 'uppercase' as const,
};

const infoValue: React.CSSProperties = {
  color: '#fff',
  fontSize: '0.9375rem',
};

const noData: React.CSSProperties = {
  color: '#64748b',
  fontStyle: 'italic' as const,
};

const usageGrid: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const usageItem: React.CSSProperties = {};

const usageHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};

const usageLabel: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.875rem',
};

const usageValue: React.CSSProperties = {
  color: '#fff',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const progressBar: React.CSSProperties = {
  height: '6px',
  background: 'rgba(20, 184, 166, 0.2)',
  borderRadius: '3px',
  overflow: 'hidden',
};

const progressFill: React.CSSProperties = {
  height: '100%',
  background: '#14b8a6',
  borderRadius: '3px',
  transition: 'width 0.3s ease',
};

const listContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
};

const listItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '0.75rem',
  background: 'rgba(15, 23, 42, 0.5)',
  borderRadius: '8px',
};

const listItemMain: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const listItemName: React.CSSProperties = {
  color: '#fff',
  fontWeight: 500,
};

const listItemMeta: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
};

const listItemStats: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  color: '#64748b',
  fontSize: '0.75rem',
};

const publicCodeBadge: React.CSSProperties = {
  background: 'rgba(20, 184, 166, 0.2)',
  color: '#5eead4',
  padding: '0.125rem 0.5rem',
  borderRadius: '4px',
  fontFamily: 'monospace',
};

const dangerCard: React.CSSProperties = {
  background: 'rgba(239, 68, 68, 0.1)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '12px',
  padding: '1.5rem',
  marginTop: '2rem',
};

const dangerTitle: React.CSSProperties = {
  color: '#f87171',
  fontSize: '1.125rem',
  fontWeight: 600,
  marginBottom: '0.75rem',
};

const dangerText: React.CSSProperties = {
  color: '#fca5a5',
  fontSize: '0.875rem',
  marginBottom: '1rem',
  lineHeight: 1.6,
};

const deleteBtn: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  background: '#dc2626',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
};
