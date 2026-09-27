'use client';

import RequireRole from '@/components/RequireRole';
import WelcomePage from '@/components/pages/WelcomePage';

// First-run setup for a brand-new organization (sign-up lands here). Full
// screen, outside the app shell, so the first thing people see is one task.
export default function WelcomeRoute() {
  return (
    <RequireRole access="admin">
      <WelcomePage />
    </RequireRole>
  );
}
