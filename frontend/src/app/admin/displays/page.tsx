'use client';

import RequireRole from '@/components/RequireRole';
import AdminDisplaysPage from '@/components/pages/AdminDisplaysPage';

export default function DisplaysRoute() {
  return (
    <RequireRole access="admin">
      <AdminDisplaysPage />
    </RequireRole>
  );
}
