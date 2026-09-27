'use client';

import RequireRole from '@/components/RequireRole';
import AnalyticsPage from '@/components/pages/AnalyticsPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <AnalyticsPage />
    </RequireRole>
  );
}
