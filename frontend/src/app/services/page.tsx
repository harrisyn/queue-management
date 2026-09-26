'use client';

import RequireRole from '@/components/RequireRole';
import ServicesPage from '@/components/pages/ServicesPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <ServicesPage />
    </RequireRole>
  );
}
