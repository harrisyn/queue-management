'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, X } from 'lucide-react';
import api from '@/api/client';
import { Icon, Card, Badge, Button, UsageBar } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

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

const getStatusTone = (status?: string): BadgeTone => {
  switch (status) {
    case 'ACTIVE':
      return 'success';
    case 'TRIAL':
      return 'primary';
    case 'PAST_DUE':
      return 'warning';
    case 'CANCELLED':
    case 'EXPIRED':
      return 'error';
    default:
      return 'neutral';
  }
};

const ROLE_TONE: Record<string, BadgeTone> = {
  ORG_ADMIN: 'primary',
  LOCATION_ADMIN: 'primary',
  SERVICE_STAFF: 'success',
};

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

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div className="spinner" />
        <p style={{ color: 'var(--gray-500)' }}>Loading organization...</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div style={errorContainer}>
        <p style={{ color: 'var(--error-600)' }}>{error || 'Organization not found'}</p>
        <Link href="/superadmin/organizations">
          <Button variant="primary">← Back to Organizations</Button>
        </Link>
      </div>
    );
  }

  return (
    <div style={pageContainer}>
      <header style={header}>
        <div style={headerLeft}>
          <Link href="/superadmin/organizations" style={backLink}>
            <Icon icon={ArrowLeft} size={14} /> Back
          </Link>
          <div>
            <h1 style={pageTitle}>{org.name}</h1>
            <p style={subtitle}>{org.slug || org.email || 'No identifier'}</p>
          </div>
        </div>
        <div style={headerActions}>
          <Badge tone={getStatusTone(org.subscription?.status)}>{org.subscription?.status || 'No Plan'}</Badge>
        </div>
      </header>

      {error && (
        <div style={errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={dismissBtn} aria-label="Dismiss">
            <Icon icon={X} size={16} />
          </button>
        </div>
      )}

      <div style={contentGrid}>
        {/* Organization Info */}
        <Card style={{ overflow: 'hidden' }}>
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
        </Card>

        {/* Subscription Info */}
        <Card style={{ overflow: 'hidden' }}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Subscription</h2>
            {org.subscription && org.subscription.status !== 'CANCELLED' && (
              <Button variant="secondary" size="sm" onClick={handleCancelSubscription} disabled={cancelling} style={{ color: 'var(--warning-600)' }}>
                {cancelling ? 'Cancelling...' : 'Cancel'}
              </Button>
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
        </Card>

        {/* Usage Stats */}
        {usage && (
          <Card style={{ overflow: 'hidden' }}>
            <div style={cardHeader}>
              <h2 style={cardTitle}>Usage</h2>
            </div>
            <div style={cardBody}>
              <div style={usageGrid}>
                <UsageBar label="Locations" current={usage.usage.locations.used} limit={usage.usage.locations.limit} />
                <UsageBar label="Users" current={usage.usage.users.used} limit={usage.usage.users.limit} />
                <UsageBar label="Queue Entries Today" current={usage.usage.queueEntries.today} limit={usage.usage.queueEntries.dailyLimit} />
                <div>
                  <div style={usageHeader}>
                    <span style={usageLabel}>Entries This Month</span>
                    <span style={usageValue}>{usage.usage.queueEntries.thisMonth}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Locations */}
        <Card style={{ overflow: 'hidden' }}>
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
        </Card>

        {/* Users */}
        <Card style={{ overflow: 'hidden' }}>
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
                    <Badge tone={ROLE_TONE[user.role] || 'neutral'}>{user.role.replace('_', ' ')}</Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p style={noData}>No users</p>
            )}
          </div>
        </Card>
      </div>

      {/* Danger Zone */}
      <div style={dangerCard}>
        <h3 style={dangerTitle}>Danger Zone</h3>
        <p style={dangerText}>
          Deleting this organization will permanently remove all data including locations, services,
          users, queue history, and settings. This action cannot be undone.
        </p>
        <Button variant="secondary" onClick={handleDelete} disabled={deleting} style={deleteBtn}>
          {deleting ? 'Deleting...' : 'Delete Organization'}
        </Button>
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

const errorContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '50vh',
  gap: '1rem',
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
  gap: '1rem',
  flexWrap: 'wrap' as const,
};

const headerLeft: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const backLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  color: 'var(--gray-400)',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
};

const pageTitle: React.CSSProperties = {
  fontSize: '2rem',
  fontWeight: 700,
  color: 'var(--gray-900)',
};

const subtitle: React.CSSProperties = {
  color: 'var(--gray-500)',
  fontSize: '1rem',
};

const headerActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
};

const errorBanner: React.CSSProperties = {
  background: 'var(--error-50)',
  border: '1px solid var(--error-100)',
  borderRadius: 'var(--radius-lg)',
  padding: '1rem',
  marginBottom: '1.5rem',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  color: 'var(--error-600)',
};

const dismissBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--error-600)',
  cursor: 'pointer',
  display: 'inline-flex',
};

const contentGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
  gap: '1.5rem',
  marginBottom: '2rem',
};

const cardHeader: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderBottom: '1px solid var(--gray-100)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const cardTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 700,
  color: 'var(--gray-900)',
};

const cardBody: React.CSSProperties = {
  padding: '1.5rem',
};

const infoGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, 1fr)',
  gap: '1.1rem',
};

const infoItem: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const infoLabel: React.CSSProperties = {
  color: 'var(--gray-400)',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.03em',
};

const infoValue: React.CSSProperties = {
  color: 'var(--gray-900)',
  fontSize: '0.9375rem',
};

const noData: React.CSSProperties = {
  color: 'var(--gray-400)',
  fontStyle: 'italic' as const,
};

const usageGrid: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '1.25rem',
};

const usageHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginBottom: '0.5rem',
};

const usageLabel: React.CSSProperties = {
  color: 'var(--gray-500)',
  fontSize: '0.875rem',
};

const usageValue: React.CSSProperties = {
  color: 'var(--gray-900)',
  fontSize: '0.875rem',
  fontWeight: 600,
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
  padding: '0.75rem 0.9rem',
  background: 'var(--gray-50)',
  borderRadius: 'var(--radius-lg)',
  flexWrap: 'wrap' as const,
  gap: '0.5rem',
};

const listItemMain: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const listItemName: React.CSSProperties = {
  color: 'var(--gray-900)',
  fontWeight: 600,
};

const listItemMeta: React.CSSProperties = {
  color: 'var(--gray-400)',
  fontSize: '0.75rem',
};

const listItemStats: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
  alignItems: 'center',
  color: 'var(--gray-400)',
  fontSize: '0.75rem',
};

const publicCodeBadge: React.CSSProperties = {
  background: 'var(--primary-50)',
  color: 'var(--primary-700)',
  padding: '0.125rem 0.5rem',
  borderRadius: 'var(--radius-sm)',
  fontFamily: 'var(--font-mono)',
};

const dangerCard: React.CSSProperties = {
  background: 'var(--error-50)',
  border: '1px solid var(--error-100)',
  borderRadius: 'var(--radius-xl)',
  padding: '1.5rem',
  marginTop: '0.5rem',
};

const dangerTitle: React.CSSProperties = {
  color: 'var(--error-600)',
  fontSize: '1.125rem',
  fontWeight: 700,
  marginBottom: '0.75rem',
};

const dangerText: React.CSSProperties = {
  color: 'var(--error-600)',
  fontSize: '0.875rem',
  marginBottom: '1rem',
  lineHeight: 1.6,
};

const deleteBtn: React.CSSProperties = {
  background: 'var(--error-600)',
  color: '#fff',
  border: 'none',
};
