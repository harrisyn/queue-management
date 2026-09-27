'use client';

import RequireRole from '@/components/RequireRole';
import AuditLogPage from '@/components/pages/AuditLogPage';

export default function AuditLogRoute() {
  return (
    <RequireRole access="orgAdmin">
      <AuditLogPage />
    </RequireRole>
  );
}
