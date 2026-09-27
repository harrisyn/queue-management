'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Search, Building2, X } from 'lucide-react';
import api from '@/api/client';
import { Icon, PageHeader, Card, Badge, Button, Modal, Select } from '@/components/ui';
import type { BadgeTone } from '@/components/ui';

interface Organization {
  id: string;
  name: string;
  slug: string | null;
  email: string | null;
  phone: string | null;
  createdAt: string;
  subscription?: {
    id: string;
    status: string;
    billingCycle: string;
    currentPeriodEnd: string;
    plan?: {
      id: string;
      name: string;
      code: string;
    };
  };
  _count: {
    locations: number;
    users: number;
  };
}

interface Plan {
  id: string;
  name: string;
  code: string;
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  // Modal state
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [subscriptionForm, setSubscriptionForm] = useState({
    planId: '',
    status: '',
    billingCycle: 'monthly',
  });
  const [saving, setSaving] = useState(false);

  const loadOrganizations = useCallback(async () => {
    try {
      setLoading(true);
      const result = await api.getSuperadminOrganizations({
        search: search || undefined,
        status: statusFilter || undefined,
        planId: planFilter || undefined,
        page,
        limit: 20,
      });
      setOrganizations(result.organizations);
      setPagination(result.pagination);
    } catch (err) {
      console.error('Failed to load organizations', err);
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, planFilter, page]);

  const loadPlans = async () => {
    try {
      const result = await api.getSubscriptionPlans(true);
      setPlans(result);
    } catch (err) {
      console.error('Failed to load plans', err);
    }
  };

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrganizations();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadOrganizations, search]);

  const handleUpdateSubscription = async () => {
    if (!selectedOrg) return;

    setSaving(true);
    try {
      await api.updateOrganizationSubscription(selectedOrg.id, {
        planId: subscriptionForm.planId || undefined,
        status: subscriptionForm.status || undefined,
        billingCycle: subscriptionForm.billingCycle,
      });
      setShowSubscriptionModal(false);
      loadOrganizations();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update subscription');
    } finally {
      setSaving(false);
    }
  };

  const openSubscriptionModal = (org: Organization) => {
    setSelectedOrg(org);
    setSubscriptionForm({
      planId: org.subscription?.plan?.id || '',
      status: org.subscription?.status || 'ACTIVE',
      billingCycle: org.subscription?.billingCycle || 'monthly',
    });
    setShowSubscriptionModal(true);
  };

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

  return (
    <div style={pageContainer}>
      <PageHeader title="Organizations" subtitle="Every workspace, its plan and its status." icon={Building2} />

      {/* Filters */}
      <div style={filtersContainer}>
        <div style={searchBox}>
          <span style={searchIcon}><Icon icon={Search} size={16} color="var(--gray-400)" /></span>
          <input
            type="text"
            placeholder="Search by name, email, or slug..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={searchInput}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={filterSelect}
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="TRIAL">Trial</option>
          <option value="PAST_DUE">Past Due</option>
          <option value="CANCELLED">Cancelled</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          style={filterSelect}
        >
          <option value="">All Plans</option>
          {plans.map(plan => (
            <option key={plan.id} value={plan.id}>{plan.name}</option>
          ))}
        </select>
      </div>

      {error && (
        <div style={errorBanner}>
          <span>{error}</span>
          <button onClick={() => setError('')} style={dismissBtn} aria-label="Dismiss">
            <Icon icon={X} size={16} />
          </button>
        </div>
      )}

      {/* Table */}
      <Card style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--gray-500)' }}>Loading organizations...</p>
          </div>
        ) : organizations.length === 0 ? (
          <div style={emptyState}>
            <p>No organizations found</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Organization</th>
                  <th style={th}>Plan</th>
                  <th style={th}>Status</th>
                  <th style={th}>Usage</th>
                  <th style={th}>Created</th>
                  <th style={th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map(org => (
                  <tr key={org.id} style={tr}>
                    <td style={td}>
                      <div style={orgCell}>
                        <span style={orgName}>{org.name}</span>
                        <span style={orgSlug}>{org.slug || org.email || '—'}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <Badge tone={org.subscription?.plan ? 'primary' : 'neutral'}>
                        {org.subscription?.plan?.name || 'No Plan'}
                      </Badge>
                    </td>
                    <td style={td}>
                      <Badge tone={getStatusTone(org.subscription?.status)}>
                        {org.subscription?.status ? org.subscription.status[0] + org.subscription.status.slice(1).toLowerCase().replace('_', ' ') : 'No plan'}
                      </Badge>
                    </td>
                    <td style={td}>
                      <div style={usageCell}>
                        <span>{org._count.locations} {org._count.locations === 1 ? 'location' : 'locations'}</span>
                        <span>{org._count.users} {org._count.users === 1 ? 'person' : 'people'}</span>
                      </div>
                    </td>
                    <td style={td}>
                      <span style={dateCell}>
                        {new Date(org.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td style={td}>
                      <div style={actionsCell}>
                        <Link href={`/superadmin/organizations/${org.id}`} style={actionLink}>
                          View
                        </Link>
                        <Button variant="secondary" size="sm" onClick={() => openSubscriptionModal(org)}>
                          Subscription
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={paginationContainer}>
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
            ← Previous
          </Button>
          <span style={pageInfo}>
            Page {page} of {pagination.pages} ({pagination.total} total)
          </span>
          <Button variant="secondary" size="sm" onClick={() => setPage(p => Math.min(pagination.pages, p + 1))} disabled={page === pagination.pages}>
            Next →
          </Button>
        </div>
      )}

      {/* Subscription Modal */}
      <Modal
        open={showSubscriptionModal && !!selectedOrg}
        onClose={() => setShowSubscriptionModal(false)}
        title="Manage Subscription"
        maxWidth="500px"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowSubscriptionModal(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleUpdateSubscription} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--gray-500)', marginBottom: '1.5rem' }}>
          Organization: <strong style={{ color: 'var(--gray-900)' }}>{selectedOrg?.name}</strong>
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <Select
            label="Subscription Plan"
            value={subscriptionForm.planId}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, planId: e.target.value })}
          >
            <option value="">Select a plan...</option>
            {plans.map(plan => (
              <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>
            ))}
          </Select>

          <Select
            label="Status"
            value={subscriptionForm.status}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
          >
            <option value="ACTIVE">Active</option>
            <option value="TRIAL">Trial</option>
            <option value="PAST_DUE">Past Due</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="EXPIRED">Expired</option>
          </Select>

          <Select
            label="Billing Cycle"
            value={subscriptionForm.billingCycle}
            onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingCycle: e.target.value })}
          >
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </div>
      </Modal>
    </div>
  );
}

// Styles
const pageContainer: React.CSSProperties = {
  maxWidth: '1400px',
  margin: 0,
};

const filtersContainer: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  marginBottom: '1.5rem',
  flexWrap: 'wrap' as const,
};

const searchBox: React.CSSProperties = {
  flex: 1,
  minWidth: '250px',
  position: 'relative' as const,
};

const searchIcon: React.CSSProperties = {
  position: 'absolute' as const,
  left: '1rem',
  top: '50%',
  transform: 'translateY(-50%)',
  display: 'flex',
};

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem 0.75rem 2.75rem',
  fontSize: '0.9375rem',
};

const filterSelect: React.CSSProperties = {
  padding: '0.75rem 1rem',
  fontSize: '0.9375rem',
  minWidth: '160px',
  width: 'auto',
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

const emptyState: React.CSSProperties = {
  padding: '3rem',
  textAlign: 'center' as const,
  color: 'var(--gray-400)',
};

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const th: React.CSSProperties = {
  padding: '1rem 1.5rem',
  textAlign: 'left' as const,
  color: 'var(--gray-400)',
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--gray-100)',
  whiteSpace: 'nowrap' as const,
};

const tr: React.CSSProperties = {
  borderBottom: '1px solid var(--gray-100)',
};

const td: React.CSSProperties = {
  padding: '1rem 1.5rem',
  verticalAlign: 'middle' as const,
};

const orgCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const orgName: React.CSSProperties = {
  color: 'var(--gray-900)',
  fontWeight: 600,
};

const orgSlug: React.CSSProperties = {
  color: 'var(--gray-400)',
  fontSize: '0.75rem',
};

const usageCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  color: 'var(--gray-500)',
  fontSize: '0.875rem',
};

const dateCell: React.CSSProperties = {
  color: 'var(--gray-400)',
  fontSize: '0.875rem',
};

const actionsCell: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
  alignItems: 'center',
};

const actionLink: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'var(--primary-50)',
  color: 'var(--primary-700)',
  borderRadius: 'var(--radius-md)',
  textDecoration: 'none',
  fontSize: '0.8125rem',
  fontWeight: 600,
};

const paginationContainer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '1rem',
  marginTop: '1.5rem',
};

const pageInfo: React.CSSProperties = {
  color: 'var(--gray-500)',
  fontSize: '0.875rem',
};
