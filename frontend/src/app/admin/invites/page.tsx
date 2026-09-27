'use client';

import RequireRole from '@/components/RequireRole';
import AdminInvitesPage from '@/components/pages/AdminInvitesPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <AdminInvitesPage />
    </RequireRole>
  );
}
