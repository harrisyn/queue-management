import dns from 'dns';
import crypto from 'crypto';

const DOMAIN_PATTERN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))+$/i;

export function isValidDomain(domain: string): boolean {
  return DOMAIN_PATTERN.test(domain);
}

export function generateVerificationToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

// The domain is considered owned once its CNAME record resolves to the
// app's own root domain - only someone with control of the domain's DNS can
// make that true. Trailing dots and case are normalized before comparing.
export async function resolveCnameTarget(domain: string): Promise<string | null> {
  try {
    const records = await dns.promises.resolveCname(domain);
    return records[0]?.replace(/\.$/, '').toLowerCase() ?? null;
  } catch {
    return null;
  }
}

export async function verifyCnameMatches(domain: string, expectedTarget: string): Promise<boolean> {
  const resolved = await resolveCnameTarget(domain);
  if (!resolved) return false;
  return resolved === expectedTarget.replace(/\.$/, '').toLowerCase();
}
