'use client';

import RequireRole from '@/components/RequireRole';
import AdminDataSourcesPage from '@/components/pages/AdminDataSourcesPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <AdminDataSourcesPage />
    </RequireRole>
  );
}
