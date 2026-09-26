'use client';

import RequireRole from '@/components/RequireRole';
import AdminSettingsPage from '@/components/pages/AdminSettingsPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <AdminSettingsPage />
    </RequireRole>
  );
}
