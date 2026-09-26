'use client';

import RequireRole from '@/components/RequireRole';
import IntegrationsPage from '@/components/pages/IntegrationsPage';

export default function IntegrationsRoute() {
  return (
    <RequireRole access="orgAdmin">
      <IntegrationsPage />
    </RequireRole>
  );
}
