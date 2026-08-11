'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, isAdmin, isStaff, isSuperAdmin } = useAuthContext();
  const router = useRouter();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const navItems = [
    { href: '/', label: 'Dashboard', icon: DashboardIcon, show: true },
    { href: '/queues', label: 'Queues', icon: QueueIcon, show: isStaff },
    { href: '/services', label: 'Services', icon: ServicesIcon, show: isAdmin },
    { href: '/admin/locations', label: 'Locations', icon: LocationIcon, show: isAdmin },
    { href: '/admin/service-points', label: 'Service Points', icon: ServicePointIcon, show: isAdmin },
    { href: '/admin/flow-designer', label: 'Flow Designer', icon: FlowIcon, show: isAdmin },
    { href: '/admin/qr', label: 'QR Codes', icon: QRCodeIcon, show: isAdmin },
    { href: '/admin/invites', label: 'Invites', icon: InviteIcon, show: isAdmin },
    { href: '/admin/data-sources', label: 'Data Sources', icon: DataSourceIcon, show: isAdmin },
    { href: '/admin/settings', label: 'Settings', icon: SettingsIcon, show: isAdmin },
    { href: '/analytics', label: 'Analytics', icon: AnalyticsIcon, show: isAdmin },
    { href: '/superadmin', label: 'Super Admin', icon: SuperAdminIcon, show: isSuperAdmin },
  ].filter(item => item.show);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/superadmin') return pathname?.startsWith('/superadmin') || false;
    return pathname === href;
  };

  return (
    <div style={layoutContainer}>
      {/* Sidebar for desktop */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <Link href="/" style={logoLink}>
          <div style={logoContainer}>
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="url(#sidebarGradient)" />
              <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
              <circle cx="24" cy="22" r="4" fill="#6366f1"/>
              <defs>
                <linearGradient id="sidebarGradient" x1="0" y1="0" x2="48" y2="48">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
            <span style={logoText}>QMS</span>
          </div>
        </Link>

        {/* Navigation */}
        <nav style={navStyle}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...navItemStyle,
                ...(isActive(item.href) ? activeNavItemStyle : {}),
              }}
            >
              <item.icon active={isActive(item.href)} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User section at bottom */}
        {user && (
          <div style={userSectionStyle}>
            <div style={userInfoContainer}>
              <div style={avatarStyle}>
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div style={userDetails}>
                <span style={userName}>{user.firstName} {user.lastName}</span>
                <span style={userRoleBadge(user.role)}>
                  {user.role.replace('_', ' ')}
                </span>
              </div>
            </div>
            <button onClick={handleLogout} style={logoutBtn} title="Logout">
              <LogoutIcon />
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <div style={mobileHeader}>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
          style={menuBtn}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <Link href="/" style={mobileLogoLink}>
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="url(#mobileGradient)" />
            <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.9"/>
            <circle cx="24" cy="22" r="4" fill="#6366f1"/>
            <defs>
              <linearGradient id="mobileGradient" x1="0" y1="0" x2="48" y2="48">
                <stop stopColor="#6366f1"/>
                <stop offset="1" stopColor="#8b5cf6"/>
              </linearGradient>
            </defs>
          </svg>
          <span style={mobileLogoText}>QMS</span>
        </Link>
        {user && (
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)} 
            style={mobileAvatarBtn}
          >
            {user.firstName?.[0]}{user.lastName?.[0]}
          </button>
        )}
      </div>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div style={mobileMenuOverlay} onClick={() => setMobileMenuOpen(false)}>
          <div style={mobileMenuContent} onClick={e => e.stopPropagation()}>
            <nav style={mobileNavStyle}>
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    ...mobileNavItem,
                    ...(isActive(item.href) ? activeMobileNavItem : {}),
                  }}
                >
                  <item.icon active={isActive(item.href)} />
                  <span>{item.label}</span>
                </Link>
              ))}
            </nav>
            {user && (
              <button onClick={handleLogout} style={mobileLogoutBtn}>
                <LogoutIcon />
                <span>Logout</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main content */}
      <main style={mainStyle}>
        <div style={contentWrapper}>
          {children}
        </div>
      </main>
    </div>
  );
};

// Icons
const DashboardIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
  </svg>
);

const QueueIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
  </svg>
);

const ServicesIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const LocationIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
  </svg>
);

const AnalyticsIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
  </svg>
);

const QRCodeIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zM13 3a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
    <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zM10 7a1 1 0 011 1v1h2a1 1 0 110 2h-3a1 1 0 01-1-1V8a1 1 0 011-1zM16 9a1 1 0 100 2 1 1 0 000-2zM9 13a1 1 0 011-1h1a1 1 0 110 2v2a1 1 0 11-2 0v-3zM16 13a1 1 0 100 2h1a1 1 0 100-2h-1z" />
  </svg>
);

const InviteIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
  </svg>
);

const DataSourceIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path d="M3 12v3c0 1.657 3.134 3 7 3s7-1.343 7-3v-3c0 1.657-3.134 3-7 3s-7-1.343-7-3z" />
    <path d="M3 7v3c0 1.657 3.134 3 7 3s7-1.343 7-3V7c0 1.657-3.134 3-7 3S3 8.657 3 7z" />
    <path d="M17 5c0 1.657-3.134 3-7 3S3 6.657 3 5s3.134-3 7-3 7 1.343 7 3z" />
  </svg>
);

const SettingsIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
  </svg>
);

const ServicePointIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
  </svg>
);

const FlowIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V4a2 2 0 00-2-2H6zm1 2a1 1 0 000 2h6a1 1 0 100-2H7zm6 7a1 1 0 011 1v3a1 1 0 11-2 0v-3a1 1 0 011-1zm-3 3a1 1 0 100 2h.01a1 1 0 100-2H10zm-4 1a1 1 0 011-1h.01a1 1 0 110 2H7a1 1 0 01-1-1zm1-4a1 1 0 100 2h.01a1 1 0 100-2H7zm2 1a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zm4-4a1 1 0 100 2h.01a1 1 0 100-2H13zM9 9a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1zM7 8a1 1 0 000 2h.01a1 1 0 000-2H7z" clipRule="evenodd" />
  </svg>
);

const TicketIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 100 4v2a2 2 0 01-2 2H4a2 2 0 01-2-2v-2a2 2 0 100-4V6z" />
  </svg>
);

const SuperAdminIcon = ({ active }: { active: boolean }) => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill={active ? '#6366f1' : '#6b7280'}>
    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="#6b7280">
    <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
  </svg>
);

// Styles
const layoutContainer: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  background: '#f9fafb',
};

const sidebarStyle: React.CSSProperties = {
  width: '260px',
  background: 'white',
  borderRight: '1px solid #e5e7eb',
  display: 'flex',
  flexDirection: 'column',
  position: 'fixed',
  top: 0,
  left: 0,
  bottom: 0,
  zIndex: 40,
};

const logoLink: React.CSSProperties = {
  textDecoration: 'none',
  padding: '1.5rem',
  borderBottom: '1px solid #e5e7eb',
};

const logoContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const logoText: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: '#111827',
  letterSpacing: '-0.02em',
};

const navStyle: React.CSSProperties = {
  flex: 1,
  padding: '1rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const navItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  borderRadius: '0.75rem',
  color: '#4b5563',
  textDecoration: 'none',
  fontSize: '0.9375rem',
  fontWeight: 500,
  transition: 'all 0.15s',
};

const activeNavItemStyle: React.CSSProperties = {
  background: '#eef2ff',
  color: '#6366f1',
};

const userSectionStyle: React.CSSProperties = {
  padding: '1rem',
  borderTop: '1px solid #e5e7eb',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
};

const userInfoContainer: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const avatarStyle: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 600,
  fontSize: '0.875rem',
};

const userDetails: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.125rem',
};

const userName: React.CSSProperties = {
  fontWeight: 600,
  fontSize: '0.875rem',
  color: '#111827',
};

const userRoleBadge = (role: string): React.CSSProperties => ({
  fontSize: '0.6875rem',
  fontWeight: 500,
  color: getRoleColor(role),
  textTransform: 'capitalize',
});

const logoutBtn: React.CSSProperties = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid #e5e7eb',
  background: 'white',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  transition: 'all 0.15s',
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  marginLeft: '260px',
  minHeight: '100vh',
};

const contentWrapper: React.CSSProperties = {
  padding: '2rem',
  maxWidth: '1400px',
  margin: '0 auto',
};

// Mobile styles
const mobileHeader: React.CSSProperties = {
  display: 'none',
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  height: '64px',
  background: 'white',
  borderBottom: '1px solid #e5e7eb',
  padding: '0 1rem',
  alignItems: 'center',
  justifyContent: 'space-between',
  zIndex: 50,
};

const menuBtn: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '8px',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: '#374151',
};

const mobileLogoLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  textDecoration: 'none',
};

const mobileLogoText: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '1.125rem',
  color: '#111827',
};

const mobileAvatarBtn: React.CSSProperties = {
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  border: 'none',
  background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
  color: 'white',
  fontWeight: 600,
  fontSize: '0.875rem',
  cursor: 'pointer',
};

const mobileMenuOverlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  zIndex: 60,
};

const mobileMenuContent: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: '280px',
  background: 'white',
  padding: '1rem',
  paddingTop: '80px',
};

const mobileNavStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const mobileNavItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: '0.75rem',
  color: '#4b5563',
  textDecoration: 'none',
  fontSize: '1rem',
  fontWeight: 500,
};

const activeMobileNavItem: React.CSSProperties = {
  background: '#eef2ff',
  color: '#6366f1',
};

const mobileLogoutBtn: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '1rem',
  borderRadius: '0.75rem',
  color: '#ef4444',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
  fontSize: '1rem',
  fontWeight: 500,
  cursor: 'pointer',
  marginTop: '1rem',
};

const getRoleColor = (role: string): string => {
  const colors: Record<string, string> = {
    SUPER_ADMIN: '#dc2626',
    ORG_ADMIN: '#2563eb',
    LOCATION_ADMIN: '#059669',
    SERVICE_STAFF: '#d97706',
    RECEPTIONIST: '#7c3aed',
    PATIENT: '#0891b2',
  };
  return colors[role] || '#6b7280';
};

export default Layout;
