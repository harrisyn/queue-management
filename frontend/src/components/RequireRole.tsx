'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';

type Access = 'staff' | 'admin' | 'orgAdmin';

/**
 * Route guard for tenant app pages: sends signed-out users to /login and
 * under-privileged users to the dashboard. Replaces the per-page copy of
 * this logic in app/.../page.tsx wrappers.
 */
export default function RequireRole({ access, children }: { access: Access; children: React.ReactNode }) {
  const { isAuthenticated, isAdmin, isStaff, user, loading } = useAuthContext();
  const router = useRouter();

  const allowed =
    access === 'staff' ? isStaff : access === 'admin' ? isAdmin : user?.role === 'ORG_ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (loading) return;
    if (!isAuthenticated) router.push('/login');
    else if (!allowed) router.push('/');
  }, [isAuthenticated, allowed, loading, router]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
      </div>
    );
  }
  if (!isAuthenticated || !allowed) return null;
  return <>{children}</>;
}
