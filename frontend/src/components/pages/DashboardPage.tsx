'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import api from '@/api/client';
import Layout from '@/components/Layout';

interface Stats {
  locations: number;
  services: number;
  activeQueues: number;
  todayServed: number;
}

interface Organization {
  id: string;
  name: string;
  slug?: string;
  email?: string;
}

const DashboardPage: React.FC = () => {
  const { user, isAdmin, isStaff } = useAuthContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError('');

      // Get organization info for the logged-in user
      if (user?.organizationId) {
        const org = await api.getOrganization(user.organizationId);
        setOrganization(org);
        
        // Get real stats
        const statsData = await api.getDashboardStats(user.organizationId);
        setStats(statsData);
      } else {
        // No organization on this account (e.g. a superadmin browsing the
        // regular tenant app shell by mistake). Never guess an org - render
        // the empty state instead of leaking another tenant's data.
        setOrganization(null);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div style={loadingContainer}>
          <div className="spinner" />
          <p style={loadingText}>Loading dashboard...</p>
        </div>
      </Layout>
    );
  }

  if (!loading && !user?.organizationId && !organization) {
    return (
      <Layout>
        <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
          No organization is associated with this account.
        </div>
      </Layout>
    );
  }

  const quickActions = [
    { 
      href: '/queues', 
      icon: '📋',
      title: 'Manage Queues', 
      desc: 'View and manage active queues',
      color: '#6366f1',
      show: isStaff 
    },
    { 
      href: '/services', 
      icon: '⚙️',
      title: 'Services', 
      desc: 'Configure services and schedules',
      color: '#8b5cf6',
      show: isAdmin 
    },
    { 
      href: '/admin/locations', 
      icon: '📍',
      title: 'Locations', 
      desc: 'Manage locations and branches',
      color: '#06b6d4',
      show: isAdmin 
    },
    { 
      href: '/admin/invites', 
      icon: '✉️',
      title: 'Invites', 
      desc: 'Manage staff invitations',
      color: '#f59e0b',
      show: isAdmin 
    },
    { 
      href: '/admin/settings', 
      icon: '🏢',
      title: 'Organization', 
      desc: 'Edit organization details',
      color: '#10b981',
      show: isAdmin 
    },
    { 
      href: '/analytics', 
      icon: '📊',
      title: 'Analytics', 
      desc: 'View reports and metrics',
      color: '#ec4899',
      show: isAdmin 
    },
  ].filter(action => action.show);

  const statCards = [
    { label: 'Locations', value: stats?.locations ?? 0, icon: '📍', color: '#6366f1' },
    { label: 'Services', value: stats?.services ?? 0, icon: '⚙️', color: '#8b5cf6' },
    { label: 'Active Queues', value: stats?.activeQueues ?? 0, icon: '📋', color: '#10b981' },
    { label: 'Served Today', value: stats?.todayServed ?? 0, icon: '✅', color: '#f59e0b' },
  ];

  return (
    <Layout>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerSection}>
          <div>
            <h1 style={welcomeTitle}>Welcome back, {user?.firstName}! 👋</h1>
            <p style={welcomeSubtitle}>
              {organization ? (
                <>Managing <strong>{organization.name}</strong></>
              ) : (
                'Here\'s what\'s happening with your queues today.'
              )}
            </p>
          </div>
          <div style={headerActions}>
            {organization && (
              <Link href={`/admin/qr`} style={primaryButton}>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                  <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM16 13a1 1 0 100 2h1a1 1 0 100-2h-1z" />
                </svg>
                <span>Generate QR</span>
              </Link>
            )}
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div style={errorAlert}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div style={statsGrid}>
          {statCards.map((stat, index) => (
            <div key={index} style={statCardStyle}>
              <div style={statCardHeader}>
                <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
              </div>
              <div style={{ ...statValue, color: stat.color }}>{stat.value}</div>
              <div style={statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <section style={sectionStyle}>
          <h2 style={sectionTitle}>Quick Actions</h2>
          <div style={actionsGrid}>
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href} style={actionCard}>
                <div style={{ ...actionIconBox, background: `${action.color}15` }}>
                  <span style={{ fontSize: '1.5rem' }}>{action.icon}</span>
                </div>
                <div style={actionContent}>
                  <h3 style={actionTitle}>{action.title}</h3>
                  <p style={actionDesc}>{action.desc}</p>
                </div>
                <svg width="20" height="20" viewBox="0 0 20 20" fill="#9ca3af" style={actionArrow}>
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </Link>
            ))}
          </div>
        </section>

        {/* Getting Started Card - shown if no locations */}
        {stats && stats.locations === 0 && (
          <div style={gettingStartedCard}>
            <div style={gettingStartedIcon}>🚀</div>
            <div style={gettingStartedContent}>
              <h3 style={gettingStartedTitle}>Get Started</h3>
              <p style={gettingStartedText}>
                Create your first location to start managing queues. Add services to each location and generate QR codes for customers to join.
              </p>
              <Link href="/admin/locations" style={gettingStartedBtn}>
                Create First Location →
              </Link>
            </div>
          </div>
        )}

        {/* Tips Card */}
        <div style={tipsCard}>
          <div style={tipsIcon}>💡</div>
          <div style={tipsContent}>
            <h3 style={tipsTitle}>Pro Tip</h3>
            <p style={tipsText}>
              Generate a QR code and display it at your entrance. Customers can scan to join the queue without downloading any app!
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Styles
const containerStyle: React.CSSProperties = {
  maxWidth: '1200px',
  margin: '0 auto',
};

const loadingContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '400px',
  gap: '1rem',
};

const loadingText: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.9375rem',
};

const headerSection: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  marginBottom: '2rem',
  flexWrap: 'wrap',
  gap: '1rem',
};

const welcomeTitle: React.CSSProperties = {
  fontSize: '1.75rem',
  fontWeight: 700,
  color: '#111827',
  marginBottom: '0.5rem',
};

const welcomeSubtitle: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '1rem',
};

const headerActions: React.CSSProperties = {
  display: 'flex',
  gap: '0.75rem',
};

const primaryButton: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.75rem 1.25rem',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  borderRadius: '0.75rem',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.9375rem',
  boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
  transition: 'all 0.2s',
};

const errorAlert: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem 1.25rem',
  background: '#fef2f2',
  border: '1px solid #fecaca',
  color: '#dc2626',
  borderRadius: '0.75rem',
  marginBottom: '1.5rem',
};

const statsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: '1.25rem',
  marginBottom: '2rem',
};

const statCardStyle: React.CSSProperties = {
  background: 'white',
  padding: '1.5rem',
  borderRadius: '1rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e5e7eb',
};

const statCardHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const statValue: React.CSSProperties = {
  fontSize: '2.25rem',
  fontWeight: 700,
  marginBottom: '0.25rem',
};

const statLabel: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.875rem',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: '2rem',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#111827',
  marginBottom: '1rem',
};

const actionsGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: '1rem',
};

const actionCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '1rem',
  padding: '1.25rem',
  background: 'white',
  borderRadius: '1rem',
  textDecoration: 'none',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e5e7eb',
  transition: 'all 0.2s',
};

const actionIconBox: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const actionContent: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
};

const actionTitle: React.CSSProperties = {
  fontWeight: 600,
  color: '#111827',
  marginBottom: '0.25rem',
  fontSize: '0.9375rem',
};

const actionDesc: React.CSSProperties = {
  color: '#6b7280',
  fontSize: '0.8125rem',
};

const actionArrow: React.CSSProperties = {
  flexShrink: 0,
};

const gettingStartedCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1.5rem',
  padding: '1.5rem',
  background: 'linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)',
  borderRadius: '1rem',
  border: '1px solid #c4b5fd',
  marginBottom: '2rem',
};

const gettingStartedIcon: React.CSSProperties = {
  fontSize: '2rem',
  flexShrink: 0,
};

const gettingStartedContent: React.CSSProperties = {
  flex: 1,
};

const gettingStartedTitle: React.CSSProperties = {
  fontWeight: 700,
  color: '#5b21b6',
  marginBottom: '0.5rem',
  fontSize: '1.125rem',
};

const gettingStartedText: React.CSSProperties = {
  color: '#7c3aed',
  fontSize: '0.9375rem',
  lineHeight: 1.5,
  marginBottom: '1rem',
};

const gettingStartedBtn: React.CSSProperties = {
  display: 'inline-block',
  padding: '0.5rem 1rem',
  background: '#7c3aed',
  color: 'white',
  borderRadius: '0.5rem',
  textDecoration: 'none',
  fontWeight: 600,
  fontSize: '0.875rem',
};

const tipsCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1rem',
  padding: '1.25rem',
  background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
  borderRadius: '1rem',
  border: '1px solid #fcd34d',
};

const tipsIcon: React.CSSProperties = {
  fontSize: '1.5rem',
  flexShrink: 0,
};

const tipsContent: React.CSSProperties = {
  flex: 1,
};

const tipsTitle: React.CSSProperties = {
  fontWeight: 600,
  color: '#92400e',
  marginBottom: '0.25rem',
};

const tipsText: React.CSSProperties = {
  color: '#a16207',
  fontSize: '0.875rem',
  lineHeight: 1.5,
};

export default DashboardPage;
