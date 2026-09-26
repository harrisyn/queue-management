'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, CreditCard, Home, ChevronLeft, ChevronRight, Zap, Wallet, PackagePlus, ImageIcon, Sparkles } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Icon } from '@/components/ui';

export default function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (!loading && (!user || user.role !== 'SUPER_ADMIN')) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={loadingContainer}>
        <div className="spinner" />
        <p style={{ color: 'var(--gray-500)' }}>Loading...</p>
      </div>
    );
  }

  if (!user || user.role !== 'SUPER_ADMIN') {
    return null;
  }

  const navItems = [
    { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/superadmin/organizations', label: 'Organizations', icon: Building2 },
    { href: '/superadmin/plans', label: 'Subscription Plans', icon: CreditCard },
    { href: '/superadmin/payment-providers', label: 'Payment Providers', icon: Wallet },
    { href: '/superadmin/addon-pricing', label: 'Add-On Pricing', icon: PackagePlus },
    { href: '/superadmin/file-storage', label: 'File Storage', icon: ImageIcon },
    { href: '/superadmin/ai-providers', label: 'AI Providers', icon: Sparkles },
  ];

  return (
    <div style={layoutContainer}>
      {/* Sidebar */}
      <aside style={{ ...sidebar, width: sidebarOpen ? '260px' : '60px' }}>
        <div style={sidebarHeader}>
          <div style={logoSection}>
            <span style={logoIcon}><Icon icon={Zap} size={22} color="var(--primary-500)" /></span>
            {sidebarOpen && <span style={logoText}>SuperAdmin</span>}
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            style={toggleBtn}
            title={sidebarOpen ? 'Collapse' : 'Expand'}
          >
            <Icon icon={sidebarOpen ? ChevronLeft : ChevronRight} size={16} />
          </button>
        </div>

        <nav style={navContainer}>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              style={{
                ...navLink,
                ...(pathname === item.href ? activeNavLink : {}),
              }}
            >
              <span style={navIcon}><Icon icon={item.icon} size={20} /></span>
              {sidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div style={sidebarFooter}>
          <Link href="/" style={backLink}>
            <span style={navIcon}><Icon icon={Home} size={20} /></span>
            {sidebarOpen && <span>Back to App</span>}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ ...mainContent, marginLeft: sidebarOpen ? '260px' : '60px' }}>
        {children}
      </main>
    </div>
  );
}

// Styles
const loadingContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  gap: '1rem',
  background: 'var(--gray-50)',
};

const layoutContainer: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--gray-50)',
};

const sidebar: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  height: '100vh',
  background: 'white',
  borderRight: '1px solid var(--gray-200)',
  display: 'flex',
  flexDirection: 'column',
  transition: 'width 0.3s ease',
  zIndex: 100,
};

const sidebarHeader: React.CSSProperties = {
  padding: '1.5rem 1rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  borderBottom: '1px solid var(--gray-100)',
};

const logoSection: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
};

const logoIcon: React.CSSProperties = {
  fontSize: '1.5rem',
};

const logoText: React.CSSProperties = {
  fontSize: '1.25rem',
  fontWeight: 700,
  color: 'var(--gray-900)',
  whiteSpace: 'nowrap',
};

const toggleBtn: React.CSSProperties = {
  background: 'var(--gray-100)',
  border: 'none',
  color: 'var(--gray-500)',
  padding: '0.5rem',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  fontSize: '0.875rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const navContainer: React.CSSProperties = {
  flex: 1,
  padding: '1rem 0.75rem',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.25rem',
};

const navLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  color: 'var(--gray-500)',
  textDecoration: 'none',
  borderRadius: 'var(--radius-lg)',
  fontSize: '0.9375rem',
  fontWeight: 500,
  transition: 'all 0.2s ease',
  whiteSpace: 'nowrap',
};

const activeNavLink: React.CSSProperties = {
  background: 'var(--primary-50)',
  color: 'var(--primary-700)',
};

const navIcon: React.CSSProperties = {
  fontSize: '1.25rem',
  minWidth: '1.5rem',
  textAlign: 'center' as const,
  display: 'inline-flex',
};

const sidebarFooter: React.CSSProperties = {
  padding: '1rem 0.75rem',
  borderTop: '1px solid var(--gray-100)',
};

const backLink: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  color: 'var(--gray-400)',
  textDecoration: 'none',
  borderRadius: 'var(--radius-lg)',
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
};

const mainContent: React.CSSProperties = {
  minHeight: '100vh',
  padding: '2rem',
  transition: 'margin-left 0.3s ease',
};
