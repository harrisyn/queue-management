'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import AdminInvitesPage from '@/components/pages/AdminInvitesPage';

export default function AdminInvitesRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!isAdmin) {
        router.push('/');
      }
    }
  }, [isAuthenticated, isAdmin, loading, router]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isAdmin) {
    return null;
  }

  return <AdminInvitesPage />;
}
