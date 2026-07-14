'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import api from '@/api/client';
import Layout from '@/components/Layout';

interface Stats {
  organizations?: number;
  totalQueues?: number;
  activeQueues?: number;
  totalServices?: number;
  todayTickets?: number;
}

interface SummaryActivity {
  id: string;
  ticketNumber: string;
  status: string;
  joinedAt: string;
  userName: string;
  serviceName: string;
}

interface ActivityItem {
  id: string;
  type: 'queue' | 'ticket' | 'service';
  message: string;
  time: string;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} hour${Math.floor(diff / 3600) > 1 ? 's' : ''} ago`;
  return `${Math.floor(diff / 86400)} day${Math.floor(diff / 86400) > 1 ? 's' : ''} ago`;
}

const DashboardPage: React.FC = () => {
  const { user, isAdmin, isStaff } = useAuthContext();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    loadDashboard();
  }, [isAdmin]);

  const loadDashboard = async () => {
    try {
      const [summary, orgs] = await Promise.allSettled([
        api.getDashboardSummary(),
        isAdmin ? api.getOrganizations() : Promise.resolve(null),
      ]);

      const statsData: Stats = {};

      if (summary.status === 'fulfilled') {
        statsData.totalQueues = summary.value.totalQueues ?? 0;
        statsData.activeQueues = summary.value.activeQueues ?? 0;
        statsData.totalServices = summary.value.totalServices ?? 0;
        statsData.todayTickets = summary.value.todayTickets ?? 0;

        if (summary.value.recentActivity?.length) {
          const activities: ActivityItem[] = (summary.value.recentActivity as SummaryActivity[]).map((a) => ({
            id: a.id,
            type: 'ticket' as const,
            message: `Ticket ${a.ticketNumber} — ${a.userName} joined ${a.serviceName}`,
            time: timeAgo(a.joinedAt),
          }));
          setRecentActivity(activities);
        }
      }

      if (orgs.status === 'fulfilled' && orgs.value) {
        statsData.organizations = orgs.value.length;
      }

      setStats(statsData);
    } catch (err) {
      console.error('Failed to load dashboard', err);
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

  const quickActions = [
    { 
      href: '/queues', 
      icon: QueueIcon, 
      title: 'Manage Queues', 
      desc: 'View and manage active queues',
      color: '#6366f1',
      show: isStaff 
    },
    { 
      href: '/services', 
      icon: ServicesIcon, 
      title: 'Services', 
      desc: 'Configure services and schedules',
      color: '#8b5cf6',
      show: isAdmin 
    },
    { 
      href: '/locations', 
      icon: LocationIcon, 
      title: 'Locations', 
      desc: 'Manage locations and branches',
      color: '#06b6d4',
      show: isAdmin 
    },
    { 
      href: '/analytics', 
      icon: AnalyticsIcon, 
      title: 'Analytics', 
      desc: 'View reports and metrics',
      color: '#10b981',
      show: isAdmin 
    },
    { 
      href: '/my-queue', 
      icon: TicketIcon, 
      title: 'My Queue', 
      desc: 'Check your queue status',
      color: '#f59e0b',
      show: true 
    },
    { 
      href: '/appointments', 
      icon: CalendarIcon, 
      title: 'Appointments', 
      desc: 'Book or view appointments',
      color: '#ec4899',
      show: true 
    },
  ].filter(action => action.show);

  const statCards = [
    { label: 'Total Queues', value: stats?.totalQueues ?? 0, icon: '📋', color: '#6366f1', show: isStaff || isAdmin },
    { label: 'Active Queues', value: stats?.activeQueues ?? 0, icon: '⚡', color: '#10b981', show: isStaff || isAdmin },
    { label: 'Today\'s Tickets', value: stats?.todayTickets ?? 0, icon: '🎟️', color: '#f59e0b', show: isStaff || isAdmin },
    { label: 'Services', value: stats?.totalServices ?? 0, icon: '🏥', color: '#8b5cf6', show: isAdmin },
    { label: 'Organizations', value: stats?.organizations ?? 0, icon: '🏢', color: '#06b6d4', show: isAdmin },
  ].filter(stat => stat.show);

  return (
    <Layout>
      <div style={containerStyle}>
        {/* Header */}
        <div style={headerSection}>
          <div>
            <h1 style={welcomeTitle}>Welcome back, {user?.firstName}! 👋</h1>
            <p style={welcomeSubtitle}>
              Here&apos;s what&apos;s happening with your queues today.
            </p>
          </div>
          <div style={headerActions}>
            <Link href="/join" style={scanQRButton}>
              <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
                <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM16 13a1 1 0 100 2h1a1 1 0 100-2h-1z" />
              </svg>
              <span>Generate QR</span>
            </Link>
          </div>
        </div>

        {/* Stats Grid */}
        {statCards.length > 0 && (
          <div style={statsGrid}>
            {statCards.map((stat, index) => (
              <div key={index} style={statCardStyle}>
                <div style={statCardHeader}>
                  <span style={{ fontSize: '1.5rem' }}>{stat.icon}</span>
                  <div style={{ ...statTrend, color: '#10b981' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path fillRule="evenodd" d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
                    </svg>
                    <span>12%</span>
                  </div>
                </div>
                <div style={{ ...statValue, color: stat.color }}>{stat.value}</div>
                <div style={statLabel}>{stat.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Quick Actions */}
        <section style={sectionStyle}>
          <h2 style={sectionTitle}>Quick Actions</h2>
          <div style={actionsGrid}>
            {quickActions.map((action, index) => (
              <Link key={index} href={action.href} style={actionCard}>
                <div style={{ ...actionIconBox, background: `${action.color}15` }}>
                  <action.icon color={action.color} />
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

        {/* Activity Feed */}
        <section style={sectionStyle}>
          <div style={sectionHeader}>
            <h2 style={sectionTitle}>Recent Activity</h2>
            <Link href="/activity" style={viewAllLink}>View all</Link>
          </div>
          <div style={activityList}>
            {recentActivity.map((activity) => (
              <div key={activity.id} style={activityItem}>
                <div style={activityDot} />
                <div style={activityContent}>
                  <p style={activityMessage}>{activity.message}</p>
                  <span style={activityTime}>{activity.time}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Tips Card */}
        <div style={tipsCard}>
          <div style={tipsIcon}>💡</div>
          <div style={tipsContent}>
            <h3 style={tipsTitle}>Pro Tip</h3>
            <p style={tipsText}>
              Generate a QR code and display it at your entrance. Customers can scan to join the queue without downloading any app!
            </p>
          </div>
          <button style={dismissBtn}>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </Layout>
  );
};

// Icons
const QueueIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
  </svg>
);

const ServicesIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const LocationIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <circle cx="12" cy="11" r="3" fill="white" />
  </svg>
);

const AnalyticsIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const TicketIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
  </svg>
);

const CalendarIcon = ({ color }: { color: string }) => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill={color}>
    <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

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

const scanQRButton: React.CSSProperties = {
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

const statTrend: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.25rem',
  fontSize: '0.75rem',
  fontWeight: 600,
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

const sectionHeader: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '1rem',
};

const sectionTitle: React.CSSProperties = {
  fontSize: '1.125rem',
  fontWeight: 600,
  color: '#111827',
  marginBottom: '1rem',
};

const viewAllLink: React.CSSProperties = {
  color: '#6366f1',
  fontSize: '0.875rem',
  fontWeight: 500,
  textDecoration: 'none',
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

const activityList: React.CSSProperties = {
  background: 'white',
  borderRadius: '1rem',
  padding: '1rem',
  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
  border: '1px solid #e5e7eb',
};

const activityItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '1rem',
  padding: '0.75rem 0',
  borderBottom: '1px solid #f3f4f6',
};

const activityDot: React.CSSProperties = {
  width: '8px',
  height: '8px',
  borderRadius: '50%',
  background: '#6366f1',
  marginTop: '0.5rem',
  flexShrink: 0,
};

const activityContent: React.CSSProperties = {
  flex: 1,
};

const activityMessage: React.CSSProperties = {
  color: '#374151',
  fontSize: '0.9375rem',
  marginBottom: '0.25rem',
};

const activityTime: React.CSSProperties = {
  color: '#9ca3af',
  fontSize: '0.8125rem',
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

const dismissBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: '#a16207',
  cursor: 'pointer',
  padding: '0.25rem',
  flexShrink: 0,
};

export default DashboardPage;
