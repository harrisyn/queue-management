'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthContext } from '@/contexts/AuthContext';
import QueueManagementPage from '@/components/pages/QueueManagementPage';

export default function QueuesPage() {
  const { isAuthenticated, isStaff, loading } = useAuthContext();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!isAuthenticated) {
        router.push('/login');
      } else if (!isStaff) {
        router.push('/');
      }
    }
  }, [isAuthenticated, isStaff, loading, router]);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <div className="spinner" />
        <p style={{ marginTop: '1rem' }}>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return null;
  }

  return <QueueManagementPage />;
}
