'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/api/client';

interface DashboardStats {
  stats: {
    totalOrganizations: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    cancelledSubscriptions: number;
    totalLocations: number;
    totalUsers: number;
    mrr: string;
  };
  planBreakdown: Array<{
    id: string;
    name: string;
    code: string;
    activeCount: number;
  }>;
  recentOrganizations: Array<{
    id: string;
    name: string;
    email: string;
    createdAt: string;
    subscription?: {
      status: string;
      plan?: { name: string; code: string };
    };
    _count: { locations: number; users: number };
  }>;
}

export default function SuperadminDashboard() {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const result = await api.getSuperadminDashboard();
      setData(result);
    } catch (err) {
      console.error('Failed to load dashboard', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div style={spinner} />
        <p style={{ color: '#94a3b8' }}>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={errorContainer}>
        <p style={{ color: '#f87171' }}>{error}</p>
        <button onClick={loadDashboard} style={retryBtn}>Retry</button>
      </div>
    );
  }

  const { stats, planBreakdown, recentOrganizations } = data!;

  return (
    <div style={pageContainer}>
      <header style={header}>
        <h1 style={pageTitle}>SuperAdmin Dashboard</h1>
        <p style={subtitle}>System-wide overview and management</p>
      </header>

      {/* Stats Grid */}
      <div style={statsGrid}>
        <div style={statCard}>
          <div style={statIcon}>🏢</div>
          <div style={statContent}>
            <span style={statValue}>{stats.totalOrganizations}</span>
            <span style={statLabel}>Organizations</span>
          </div>
        </div>
        <div style={statCard}>
          <div style={statIcon}>✅</div>
          <div style={statContent}>
            <span style={statValue}>{stats.activeSubscriptions}</span>
            <span style={statLabel}>Active Subscriptions</span>
          </div>
        </div>
        <div style={statCard}>
          <div style={statIcon}>🆓</div>
          <div style={statContent}>
            <span style={statValue}>{stats.trialSubscriptions}</span>
            <span style={statLabel}>On Trial</span>
          </div>
        </div>
        <div style={{ ...statCard, background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }}>
          <div style={statIcon}>💰</div>
          <div style={statContent}>
            <span style={statValue}>${stats.mrr}</span>
            <span style={statLabel}>Monthly Revenue</span>
          </div>
        </div>
        <div style={statCard}>
          <div style={statIcon}>📍</div>
          <div style={statContent}>
            <span style={statValue}>{stats.totalLocations}</span>
            <span style={statLabel}>Total Locations</span>
          </div>
        </div>
        <div style={statCard}>
          <div style={statIcon}>👥</div>
          <div style={statContent}>
            <span style={statValue}>{stats.totalUsers}</span>
            <span style={statLabel}>Total Users</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={contentGrid}>
        {/* Plan Breakdown */}
        <div style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Subscription Distribution</h2>
            <Link href="/superadmin/plans" style={cardLink}>Manage Plans →</Link>
          </div>
          <div style={planList}>
            {planBreakdown.map(plan => (
              <div key={plan.id} style={planItem}>
                <div style={planInfo}>
                  <span style={planName}>{plan.name}</span>
                  <span style={planCode}>{plan.code}</span>
                </div>
                <div style={planCount}>
                  <span style={countValue}>{plan.activeCount}</span>
                  <span style={countLabel}>orgs</span>
                </div>
              </div>
            ))}
            {planBreakdown.length === 0 && (
              <div style={emptyState}>
                <p>No subscription plans created yet.</p>
                <Link href="/superadmin/plans" style={createLink}>Create your first plan →</Link>
              </div>
            )}
          </div>
        </div>

        {/* Recent Organizations */}
        <div style={card}>
          <div style={cardHeader}>
            <h2 style={cardTitle}>Recent Organizations</h2>
            <Link href="/superadmin/organizations" style={cardLink}>View All →</Link>
          </div>
          <div style={orgList}>
            {recentOrganizations.map(org => (
              <Link key={org.id} href={`/superadmin/organizations/${org.id}`} style={orgItem}>
                <div style={orgInfo}>
                  <span style={orgName}>{org.name}</span>
                  <span style={orgEmail}>{org.email || 'No email'}</span>
                </div>
                <div style={orgMeta}>
                  <span style={getStatusBadge(org.subscription?.status)}>
                    {org.subscription?.status || 'No Plan'}
                  </span>
                  <span style={orgStats}>
                    {org._count.locations} loc · {org._count.users} users
                  </span>
                </div>
              </Link>
            ))}
            {recentOrganizations.length === 0 && (
              <div style={emptyState}>
                <p>No organizations yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div style={actionsCard}>
        <h3 style={actionsTitle}>Quick Actions</h3>
        <div style={actionsGrid}>
          <Link href="/superadmin/plans" style={actionBtn}>
            <span style={actionIcon}>➕</span>
            <span>Create Plan</span>
          </Link>
          <Link href="/superadmin/organizations" style={actionBtn}>
            <span style={actionIcon}>🔍</span>
            <span>Search Orgs</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

const getStatusBadge = (status?: string): React.CSSProperties => {
  const base: React.CSSProperties = {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
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
  borderTop: '4px solid #6366f1',
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

const retryBtn: React.CSSProperties = {
  padding: '0.75rem 1.5rem',
  background: '#6366f1',
  color: '#fff',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontWeight: 500,
};

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

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1rem',
  marginBottom: '2rem',
};

const statCard: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
  borderRadius: '12px',
  padding: '1.5rem',
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  border: '1px solid rgba(99, 102, 241, 0.2)',
};

const statIcon: React.CSSProperties = {
  fontSize: '2rem',
};

const statContent: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
};

const statValue: React.CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#fff',
};

const statLabel: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#94a3b8',
};

const contentGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
  gap: '1.5rem',
  marginBottom: '2rem',
};

const card: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  border: '1px solid rgba(99, 102, 241, 0.2)',
  overflow: 'hidden',
};

const cardHeader: React.CSSProperties = {
  padding: '1.25rem 1.5rem',
  borderBottom: '1px solid rgba(99, 102, 241, 0.1)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

const cardTitle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#fff',
};

const cardLink: React.CSSProperties = {
  color: '#a5b4fc',
  textDecoration: 'none',
  fontSize: '0.875rem',
};

const planList: React.CSSProperties = {
  padding: '0.5rem',
};

const planItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem',
  borderRadius: '8px',
  background: 'rgba(15, 23, 42, 0.5)',
  marginBottom: '0.5rem',
};

const planInfo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const planName: React.CSSProperties = {
  color: '#fff',
  fontWeight: 500,
};

const planCode: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
};

const planCount: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: '0.25rem',
};

const countValue: React.CSSProperties = {
  fontSize: '1.5rem',
  fontWeight: 700,
  color: '#a5b4fc',
};

const countLabel: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
};

const orgList: React.CSSProperties = {
  padding: '0.5rem',
};

const orgItem: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '1rem',
  borderRadius: '8px',
  background: 'rgba(15, 23, 42, 0.5)',
  marginBottom: '0.5rem',
  textDecoration: 'none',
  cursor: 'pointer',
  transition: 'background 0.2s',
};

const orgInfo: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const orgName: React.CSSProperties = {
  color: '#fff',
  fontWeight: 500,
};

const orgEmail: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.875rem',
};

const orgMeta: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-end',
  gap: '0.25rem',
};

const orgStats: React.CSSProperties = {
  color: '#64748b',
  fontSize: '0.75rem',
};

const emptyState: React.CSSProperties = {
  padding: '2rem',
  textAlign: 'center' as const,
  color: '#64748b',
};

const createLink: React.CSSProperties = {
  color: '#a5b4fc',
  textDecoration: 'none',
  display: 'block',
  marginTop: '0.5rem',
};

const actionsCard: React.CSSProperties = {
  background: '#1e293b',
  borderRadius: '12px',
  padding: '1.5rem',
  border: '1px solid rgba(99, 102, 241, 0.2)',
};

const actionsTitle: React.CSSProperties = {
  fontSize: '1rem',
  fontWeight: 600,
  color: '#fff',
  marginBottom: '1rem',
};

const actionsGrid: React.CSSProperties = {
  display: 'flex',
  gap: '1rem',
  flexWrap: 'wrap' as const,
};

const actionBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: 'rgba(99, 102, 241, 0.2)',
  border: '1px solid rgba(99, 102, 241, 0.3)',
  borderRadius: '8px',
  color: '#a5b4fc',
  textDecoration: 'none',
  fontSize: '0.875rem',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'all 0.2s',
};

const actionIcon: React.CSSProperties = {
  fontSize: '1rem',
};
