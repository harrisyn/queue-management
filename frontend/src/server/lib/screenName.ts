/**
 * The name a public lobby screen may show for a patient, per the service's
 * (or org's default) display mode. Redacted here, not in the browser: the
 * display endpoints are public, so anything in the payload is readable.
 */
export function screenName(mode: string | null | undefined, firstName?: string | null, lastName?: string | null): string | null {
  const first = (firstName || '').trim();
  const last = (lastName || '').trim();
  if (mode === 'FULL_INFO') return [first, last].filter(Boolean).join(' ') || null;
  if (mode === 'NAME_AND_TICKET') return first ? `${first}${last ? ` ${last[0].toUpperCase()}.` : ''}` : null;
  return null;
}
