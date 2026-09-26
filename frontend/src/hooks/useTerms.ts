'use client';

import { useMemo } from 'react';
import { useAuthContext } from '@/contexts/AuthContext';
import { termsFor, type Terms, type TermSource } from '@/lib/terms';

/** The signed-in organization's word for the people it serves. Pass an
 * org explicitly on public pages, where nobody is signed in. */
export function useTerms(org?: TermSource | null): Terms {
  const { user } = useAuthContext();
  const source = org ?? user?.organization ?? null;
  return useMemo(() => termsFor(source), [source?.industry, source?.customerLabel, source?.customerLabelPlural]);
}
