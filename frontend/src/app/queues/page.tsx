'use client';

import RequireRole from '@/components/RequireRole';
import QueueManagementPage from '@/components/pages/QueueManagementPage';

export default function Page() {
  return (
    <RequireRole access="staff">
      <QueueManagementPage />
    </RequireRole>
  );
}
