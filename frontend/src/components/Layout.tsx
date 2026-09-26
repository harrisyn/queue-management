'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ListOrdered,
  CalendarDays,
  BarChart3,
  ScrollText,
  MapPin,
  Stethoscope,
  DoorOpen,
  Workflow,
  QrCode,
  MonitorPlay,
  UserPlus,
  Database,
  Plug,
  Settings,
  CreditCard,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useTerms } from '@/hooks/useTerms';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { buildAdminUrl } from '@/lib/subdomain';
import { APP_NAME } from '@/lib/appConfig';

interface ImpersonationInfo {
  returnToken: string;
  returnPath: string;
  orgName: string;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  show: boolean;
}

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Super admin',
  ORG_ADMIN: 'Organization admin',
  LOCATION_ADMIN: 'Location admin',
  SERVICE_STAFF: 'Service staff',
  RECEPTIONIST: 'Receptionist',
  PATIENT: 'Visitor',
};

export function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="var(--primary-500)" />
      <path d="M14 24C14 18.477 18.477 14 24 14V14C29.523 14 34 18.477 34 24V34H14V24Z" fill="white" fillOpacity="0.92" />
      <circle cx="24" cy="22" r="4" fill="var(--primary-700)" />
    </svg>
  );
}

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout, isAdmin, isStaff, isSuperAdmin } = useAuthContext();
  const terms = useTerms();
  const { organizationStatus } = useSubscription();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [impersonation, setImpersonation] = useState<ImpersonationInfo | null>(null);
  const isOrgAdmin = user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('impersonation');
      if (raw) setImpersonation(JSON.parse(raw));
    } catch {
      // Malformed/unavailable sessionStorage - just skip the banner.
    }
  }, []);

  useEffect(() => setMobileMenuOpen(false), [pathname]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const handleExitImpersonation = () => {
    if (!impersonation) return;
    sessionStorage.removeItem('impersonation');
    window.location.href = `${buildAdminUrl(impersonation.returnPath)}#restore=${encodeURIComponent(impersonation.returnToken)}`;
  };

  // Grouped by what people come here to do: run today, look back, set up,
  // administer the organization.
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: 'Today',
      items: [
        { href: '/', label: 'Dashboard', icon: LayoutDashboard, show: true },
        { href: '/queues', label: 'My desk', icon: ListOrdered, show: isStaff },
        { href: '/appointments', label: 'Appointments', icon: CalendarDays, show: isStaff },
      ],
    },
    {
      label: 'Insights',
      items: [
        { href: '/analytics', label: 'Analytics', icon: BarChart3, show: isAdmin },
        { href: '/admin/audit-log', label: 'Audit log', icon: ScrollText, show: isOrgAdmin },
      ],
    },
    {
      label: 'Setup',
      items: [
        { href: '/admin/locations', label: 'Locations', icon: MapPin, show: isAdmin },
        { href: '/services', label: 'Services', icon: Stethoscope, show: isAdmin },
        { href: '/admin/service-points', label: 'Desks & rooms', icon: DoorOpen, show: isAdmin },
        { href: '/admin/flow-designer', label: `${terms.Person} flow`, icon: Workflow, show: isAdmin },
        { href: '/admin/qr', label: 'QR codes', icon: QrCode, show: isAdmin },
        { href: '/admin/displays', label: 'Display screens', icon: MonitorPlay, show: isAdmin },
      ],
    },
    {
      label: 'Organization',
      items: [
        { href: '/admin/invites', label: 'Staff invites', icon: UserPlus, show: isAdmin },
        { href: '/admin/data-sources', label: 'Data sources', icon: Database, show: isAdmin },
        { href: '/admin/integrations', label: 'Integrations', icon: Plug, show: isOrgAdmin },
        { href: '/admin/settings', label: 'Settings', icon: Settings, show: isAdmin },
        { href: '/admin/billing', label: 'Billing', icon: CreditCard, show: isAdmin },
      ],
    },
    {
      label: 'Platform',
      items: [{ href: '/superadmin', label: 'Super admin', icon: ShieldCheck, show: isSuperAdmin }],
    },
  ]
    .map((g) => ({ ...g, items: g.items.filter((i) => i.show) }))
    .filter((g) => g.items.length > 0);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/superadmin') return pathname?.startsWith('/superadmin') || false;
    return pathname === href;
  };

  const nav = (
    <nav className="app-nav" aria-label="Main">
      {groups.map((group) => (
        <div key={group.label} className="app-nav-group">
          <p className="app-nav-label">{group.label}</p>
          {group.items.map((item) => {
            const active = isActive(item.href);
            const ItemIcon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="app-nav-item" aria-current={active ? 'page' : undefined}>
                <ItemIcon size={18} strokeWidth={1.9} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );

  const userBlock = user && (
    <div className="app-user">
      <div className="app-avatar" aria-hidden="true">
        {user.firstName?.[0]}{user.lastName?.[0]}
      </div>
      <div className="app-user-text">
        <span className="app-user-name">{user.firstName} {user.lastName}</span>
        <span className="app-user-role">{ROLE_LABELS[user.role] || user.role}</span>
      </div>
      <button type="button" onClick={handleLogout} className="app-icon-btn" aria-label="Sign out" title="Sign out">
        <LogOut size={17} />
      </button>
    </div>
  );

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="app-brand">
          <BrandMark size={34} />
          <span>{APP_NAME}</span>
        </Link>
        {nav}
        {userBlock}
      </aside>

      <header className="app-mobile-bar">
        <button type="button" className="app-icon-btn" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <Link href="/" className="app-brand app-brand-sm">
          <BrandMark size={28} />
          <span>{APP_NAME}</span>
        </Link>
        <span className="app-avatar app-avatar-sm" aria-hidden="true">
          {user?.firstName?.[0]}{user?.lastName?.[0]}
        </span>
      </header>

      {mobileMenuOpen && (
        <div className="app-drawer-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <div className="app-drawer" role="dialog" aria-label="Menu" onClick={(e) => e.stopPropagation()}>
            <div className="app-drawer-top">
              <span className="app-brand">
                <BrandMark size={30} />
                <span>{APP_NAME}</span>
              </span>
              <button type="button" className="app-icon-btn" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu">
                <X size={20} />
              </button>
            </div>
            {nav}
            {userBlock}
          </div>
        </div>
      )}

      <main className="app-main">
        {impersonation && (
          <div className="app-banner app-banner-impersonating">
            <span>
              You&apos;re viewing <strong>{impersonation.orgName || 'this organization'}</strong> as its admin.
            </span>
            <button type="button" onClick={handleExitImpersonation}>Return to super admin</button>
          </div>
        )}
        {isAdmin && organizationStatus === 'PAUSED' && (
          <div className="app-banner app-banner-paused">
            This workspace is paused by the platform administrator. Staff can still sign in, but {terms.people} can&apos;t join
            queues or see their ticket until it&apos;s reactivated.
          </div>
        )}
        <div className="app-content">{children}</div>
      </main>
    </div>
  );
};

export default Layout;
