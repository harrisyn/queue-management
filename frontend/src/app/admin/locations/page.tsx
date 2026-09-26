'use client';

import RequireRole from '@/components/RequireRole';
import AdminLocationsPage from '@/components/pages/AdminLocationsPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <AdminLocationsPage />
    </RequireRole>
  );
}
