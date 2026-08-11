'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/api/client';

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

  const getStatusBadge = (status?: string): React.CSSProperties => {
    const base: React.CSSProperties = {
      padding: '0.25rem 0.75rem',
      borderRadius: '9999px',
      fontSize: '0.75rem',
      fontWeight: 500,
      textTransform: 'uppercase' as const,
    };
    
    switch (status) {
      case 'ACTIVE':
        return { ...base, background: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
      case 'TRIAL':
        return { ...base, background: 'rgba(99, 102, 241, 0.2)', color: '#a5b4fc' };
      case 'PAST_DUE':
        return { ...base, background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      case 'CANCELLED':
      case 'EXPIRED':
        return { ...base, background: 'rgba(239, 68, 68, 0.2)', color: '#f87171' };
      default:
        return { ...base, background: 'rgba(100, 116, 139, 0.2)', color: '#94a3b8' };
    }
  };

  return (
    <div style={pageContainer}>
      <header style={header}>
        <div>
          <h1 style={pageTitle}>Organizations</h1>
          <p style={subtitle}>Manage all organizations and their subscriptions</p>
        </div>
      </header>

      {/* Filters */}
      <div style={filtersContainer}>
        <div style={searchBox}>
          <span style={searchIcon}>🔍</span>
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
          <button onClick={() => setError('')} style={dismissBtn}>✕</button>
        </div>
      )}

      {/* Table */}
      <div style={tableContainer}>
        {loading ? (
          <div style={loadingState}>
            <div style={spinner} />
            <p>Loading organizations...</p>
          </div>
        ) : organizations.length === 0 ? (
          <div style={emptyState}>
            <p>No organizations found</p>
          </div>
        ) : (
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
                    <span style={planBadge}>
                      {org.subscription?.plan?.name || 'No Plan'}
                    </span>
                  </td>
                  <td style={td}>
                    <span style={getStatusBadge(org.subscription?.status)}>
                      {org.subscription?.status || 'None'}
                    </span>
                  </td>
                  <td style={td}>
                    <div style={usageCell}>
                      <span>{org._count.locations} locations</span>
                      <span>{org._count.users} users</span>
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
                      <button 
                        onClick={() => openSubscriptionModal(org)}
                        style={actionBtn}
                      >
                        Subscription
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div style={paginationContainer}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            style={pageBtn}
          >
            ← Previous
          </button>
          <span style={pageInfo}>
            Page {page} of {pagination.pages} ({pagination.total} total)
          </span>
          <button
            onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
            disabled={page === pagination.pages}
            style={pageBtn}
          >
            Next →
          </button>
        </div>
      )}

      {/* Subscription Modal */}
      {showSubscriptionModal && selectedOrg && (
        <div style={modalOverlay} onClick={() => setShowSubscriptionModal(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeader}>
              <h2 style={modalTitle}>Manage Subscription</h2>
              <button onClick={() => setShowSubscriptionModal(false)} style={closeBtn}>✕</button>
            </div>
            <div style={modalBody}>
              <p style={modalSubtitle}>
                Organization: <strong>{selectedOrg.name}</strong>
              </p>
              
              <div style={formGroup}>
                <label style={formLabel}>Subscription Plan</label>
                <select
                  value={subscriptionForm.planId}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, planId: e.target.value })}
                  style={formSelect}
                >
                  <option value="">Select a plan...</option>
                  {plans.map(plan => (
                    <option key={plan.id} value={plan.id}>{plan.name} ({plan.code})</option>
                  ))}
                </select>
              </div>

              <div style={formGroup}>
                <label style={formLabel}>Status</label>
                <select
                  value={subscriptionForm.status}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, status: e.target.value })}
                  style={formSelect}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="TRIAL">Trial</option>
                  <option value="PAST_DUE">Past Due</option>
                  <option value="CANCELLED">Cancelled</option>
                  <option value="EXPIRED">Expired</option>
                </select>
              </div>

              <div style={formGroup}>
                <label style={formLabel}>Billing Cycle</label>
                <select
                  value={subscriptionForm.billingCycle}
                  onChange={(e) => setSubscriptionForm({ ...subscriptionForm, billingCycle: e.target.value })}
                  style={formSelect}
                >
                  <option value="monthly">Monthly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            <div style={modalFooter}>
              <button onClick={() => setShowSubscriptionModal(false)} style={cancelBtn}>
                Cancel
              </button>
              <button 
                onClick={handleUpdateSubscription} 
                disabled={saving}
                style={saveBtn}
              >
                {saving ? 'Saving...' : 'Save Changes'}
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
  fontSize: '1rem',
};

const searchInput: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem 1rem 0.75rem 2.75rem',
  background: '#1e293b',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9375rem',
};

const filterSelect: React.CSSProperties = {
  padding: '0.75rem 1rem',
  background: '#1e293b',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9375rem',
  minWidth: '150px',
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

const tableContainer: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  overflow: 'hidden',
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
  borderTop: '4px solid #6366f1',
  borderRadius: '50%',
  margin: '0 auto 1rem',
  animation: 'spin 1s linear infinite',
};

const emptyState: React.CSSProperties = {
  padding: '3rem',
  textAlign: 'center' as const,
  color: '#64748b',
};

const table: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const th: React.CSSProperties = {
  padding: '1rem 1.5rem',
  textAlign: 'left' as const,
  color: '#94a3b8',
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
};

const tr: React.CSSProperties = {
  borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
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
  color: '#fff',
  fontWeight: 500,
};

const orgSlug: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
};

const planBadge: React.CSSProperties = {
  background: 'rgba(99, 102, 241, 0.2)',
  color: '#a5b4fc',
  padding: '0.25rem 0.75rem',
  borderRadius: '4px',
  fontSize: '0.875rem',
};

const usageCell: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
  color: '#94a3b8',
  fontSize: '0.875rem',
};

const dateCell: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.875rem',
};

const actionsCell: React.CSSProperties = {
  display: 'flex',
  gap: '0.5rem',
};

const actionLink: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'rgba(99, 102, 241, 0.2)',
  color: '#a5b4fc',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '0.75rem',
  fontWeight: 500,
};

const actionBtn: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
  background: 'rgba(16, 185, 129, 0.2)',
  color: '#10b981',
  border: 'none',
  borderRadius: '6px',
  fontSize: '0.75rem',
  fontWeight: 500,
  cursor: 'pointer',
};

const paginationContainer: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: '1rem',
  marginTop: '1.5rem',
};

const pageBtn: React.CSSProperties = {
  padding: '0.5rem 1rem',
  background: '#1e293b',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  borderRadius: '6px',
  color: '#a5b4fc',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const pageInfo: React.CSSProperties = {
  color: '#94a3b8',
  fontSize: '0.875rem',
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
};

const modal: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  width: '100%',
  maxWidth: '500px',
  border: '1px solid rgba(99, 102, 241, 0.3)',
};

const modalHeader: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
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

const modalSubtitle: React.CSSProperties = {
  color: '#94a3b8',
  marginBottom: '1.5rem',
};

const formGroup: React.CSSProperties = {
  marginBottom: '1.25rem',
};

const formLabel: React.CSSProperties = {
  display: 'block',
  color: '#94a3b8',
  fontSize: '0.875rem',
  marginBottom: '0.5rem',
};

const formSelect: React.CSSProperties = {
  width: '100%',
  padding: '0.75rem',
  background: '#0f172a',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '0.9375rem',
};

const modalFooter: React.CSSProperties = {
  padding: '1rem 1.5rem',
  borderTop: '1px solid rgba(99, 102, 241, 0.1)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '0.75rem',
};

const cancelBtn: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  background: 'transparent',
  border: '1px solid rgba(99, 102, 241, 0.3)',
  borderRadius: '8px',
  color: '#94a3b8',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const saveBtn: React.CSSProperties = {
  padding: '0.75rem 1.25rem',
  background: '#6366f1',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 500,
};
