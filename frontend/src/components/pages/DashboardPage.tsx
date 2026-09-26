'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Settings,
  MapPin,
  Mail,
  Building2,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Rocket,
  QrCode,
  ChevronRight,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import api from '@/api/client';
import Layout from '@/components/Layout';
import { Icon, PageHeader, UsageBar } from '@/components/ui';

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

interface UsageLimit {
  current: number;
  limit: number | null;
  allowed: boolean;
}

interface SubscriptionLimits {
  locations: UsageLimit;
  services: UsageLimit;
  users: UsageLimit;
  queueEntriesDaily: UsageLimit;
  queueEntriesPeriod: UsageLimit;
}

const DashboardPage: React.FC = () => {
  const { user, isAdmin, isStaff } = useAuthContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [limits, setLimits] = useState<SubscriptionLimits | null>(null);
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

        const subData = await api.getMySubscription();
        if (subData.limits) setLimits(subData.limits);
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
      icon: ClipboardList,
      title: 'Manage Queues',
      desc: 'View and manage active queues',
      show: isStaff,
    },
    {
      href: '/services',
      icon: Settings,
      title: 'Services',
      desc: 'Configure services and schedules',
      show: isAdmin,
    },
    {
      href: '/admin/locations',
      icon: MapPin,
      title: 'Locations',
      desc: 'Manage locations and branches',
      show: isAdmin,
    },
    {
      href: '/admin/invites',
      icon: Mail,
      title: 'Invites',
      desc: 'Manage staff invitations',
      show: isAdmin,
    },
    {
      href: '/admin/settings',
      icon: Building2,
      title: 'Organization',
      desc: 'Edit organization details',
      show: isAdmin,
    },
    {
      href: '/analytics',
      icon: BarChart3,
      title: 'Analytics',
      desc: 'View reports and metrics',
      show: isAdmin,
    },
  ].filter(action => action.show);

  const statCards = [
    { label: 'Locations', value: stats?.locations ?? 0, icon: MapPin },
    { label: 'Services', value: stats?.services ?? 0, icon: Settings },
    { label: 'Active Queues', value: stats?.activeQueues ?? 0, icon: ClipboardList },
    { label: 'Served Today', value: stats?.todayServed ?? 0, icon: CheckCircle2 },
  ];

  return (
    <Layout>
      <div style={containerStyle}>
        <PageHeader
          icon={ClipboardList}
          title={`Welcome back, ${user?.firstName}!`}
          subtitle={
            organization
              ? `Managing ${organization.name}`
              : "Here's what's happening with your queues today."
          }
          actions={
            organization && (
              <Link href="/admin/qr" className="btn btn-primary">
                <Icon icon={QrCode} size={18} />
                <span>Generate QR</span>
              </Link>
            )
          }
        />

        {/* Error message */}
        {error && (
          <div style={errorAlert}>
            <Icon icon={AlertTriangle} size={18} color="#dc2626" />
            <span>{error}</span>
          </div>
        )}

        {/* Stats Grid */}
        <div style={statsGrid}>
          {statCards.map((stat, index) => (
            <div key={index} className="card" style={statCardStyle}>
              <div style={statCardHeader}>
                <Icon icon={stat.icon} size={22} color="#0e8f80" />
              </div>
              <div style={statValue}>{stat.value}</div>
              <div style={statLabel}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Usage Widget - only near-limit resources, full breakdown lives on the billing page */}
        {isAdmin && limits && (() => {
          const nearLimitEntries = (
            [
              ['Locations', limits.locations],
              ['Users', limits.users],
              ['Services', limits.services],
              ['Queue entries today', limits.queueEntriesDaily],
              ['Queue entries this period', limits.queueEntriesPeriod],
            ] as [string, UsageLimit][]
          ).filter(([, l]) => l.limit !== null && l.current / l.limit >= 0.8);

          if (nearLimitEntries.length === 0) return null;

          return (
            <section style={sectionStyle}>
              <h2 style={sectionTitle}>Usage</h2>
              <div className="card" style={{ padding: '1.25rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                {nearLimitEntries.map(([label, l]) => (
                  <UsageBar key={label} label={label} current={l.current} limit={l.limit} />
                ))}
              </div>
            </section>
          );
        })()}

        {/* Quick Actions */}
        <section style={sectionStyle}>
          <h2 style={sectionTitle}>Quick Actions</h2>
          <div style={actionsGrid}>
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href} className="card card-hover" style={actionCard}>
                <div style={actionIconBox}>
                  <Icon icon={action.icon} size={22} color="#0e8f80" />
                </div>
                <div style={actionContent}>
                  <h3 style={actionTitle}>{action.title}</h3>
                  <p style={actionDesc}>{action.desc}</p>
                </div>
                <Icon icon={ChevronRight} size={18} color="#9ca3af" />
              </Link>
            ))}
          </div>
        </section>

        {/* Getting Started Card - shown if no locations */}
        {stats && stats.locations === 0 && (
          <div style={gettingStartedCard}>
            <Icon icon={Rocket} size={28} color="#0b7a6d" />
            <div style={gettingStartedContent}>
              <h3 style={gettingStartedTitle}>Get Started</h3>
              <p style={gettingStartedText}>
                Create your first location to start managing queues. Add services to each location and generate QR codes for customers to join.
              </p>
              <Link href="/admin/locations" className="btn btn-primary btn-sm">
                Create First Location
                <Icon icon={ChevronRight} size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* Tips Card */}
        <div style={tipsCard}>
          <Icon icon={Lightbulb} size={22} color="#92400e" />
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
const containerStyle: React.CSSProperties = {};

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
  padding: '1.5rem',
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
  color: '#111827',
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
  textDecoration: 'none',
};

const actionIconBox: React.CSSProperties = {
  width: '48px',
  height: '48px',
  borderRadius: '0.75rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  background: 'rgba(14, 143, 128, 0.1)',
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

const gettingStartedCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1.5rem',
  padding: '1.5rem',
  background: 'rgba(14, 143, 128, 0.08)',
  borderRadius: '1rem',
  border: '1px solid rgba(14, 143, 128, 0.25)',
  marginBottom: '2rem',
};

const gettingStartedContent: React.CSSProperties = {
  flex: 1,
};

const gettingStartedTitle: React.CSSProperties = {
  fontWeight: 700,
  color: '#0a655a',
  marginBottom: '0.5rem',
  fontSize: '1.125rem',
};

const gettingStartedText: React.CSSProperties = {
  color: '#0b7a6d',
  fontSize: '0.9375rem',
  lineHeight: 1.5,
  marginBottom: '1rem',
};

const tipsCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1rem',
  padding: '1.25rem',
  background: '#fef3c7',
  borderRadius: '1rem',
  border: '1px solid #fcd34d',
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
