'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import RegisterPage from '@/components/pages/RegisterPage';
import AcceptInvitePage from '@/components/pages/AcceptInvitePage';

// /register?invite=CODE is the staff invite link (see AdminInvitesPage);
// plain /register is the new-organization sign-up wizard.
function RegisterRouter() {
  const invite = useSearchParams()?.get('invite');
  return invite ? <AcceptInvitePage code={invite} /> : <RegisterPage />;
}

export default function Register() {
  return (
    <Suspense fallback={null}>
      <RegisterRouter />
    </Suspense>
  );
}
