'use client';

import RequireRole from '@/components/RequireRole';
import AdminQRPage from '@/components/pages/AdminQRPage';

export default function Page() {
  return (
    <RequireRole access="admin">
      <AdminQRPage />
    </RequireRole>
  );
}
