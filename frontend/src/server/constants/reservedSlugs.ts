// Mirrored in frontend/src/lib/reservedSlugs.ts for client-side validation —
// keep both lists in sync when adding entries.
export const RESERVED_SLUGS = [
  'admin', 'www', 'api', 'app', 'mail', 'ftp', 'ns1', 'ns2',
  'status', 'docs', 'support', 'staging', 'dev', 'test', 'blog',
  'assets', 'static', 'cdn', 'help', 'login', 'register', 'auth',
];

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(slug.toLowerCase());
}
