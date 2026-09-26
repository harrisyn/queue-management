'use client';

import RequireRole from '@/components/RequireRole';
import AppointmentsPage from '@/components/pages/AppointmentsPage';

export default function AppointmentsRoute() {
  return (
    <RequireRole access="staff">
      <AppointmentsPage />
    </RequireRole>
  );
}
