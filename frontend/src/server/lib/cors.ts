import prisma from './prisma';
import { APP_URL, buildAppUrl } from '../config/appConfig';

const extraOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((o) => o.trim().replace(/\/$/, ''))
  .filter(Boolean);

const rootHost = new URL(APP_URL).hostname;

// Verified custom domains change rarely; cache lookups briefly so CORS
// preflights don't hit the DB on every request.
const domainCache = new Map<string, { allowed: boolean; expires: number }>();
const CACHE_MS = 60_000;

async function isVerifiedCustomDomain(hostname: string): Promise<boolean> {
  const cached = domainCache.get(hostname);
  if (cached && cached.expires > Date.now()) return cached.allowed;
  const found = await prisma.customDomain.findFirst({
    where: { domain: hostname, status: 'VERIFIED' },
    select: { id: true },
  });
  domainCache.set(hostname, { allowed: !!found, expires: Date.now() + CACHE_MS });
  return !!found;
}

/** The root domain, any of its subdomains (tenants, admin), explicitly
 * configured extra origins, and verified tenant custom domains. */
export async function isAllowedOrigin(origin: string): Promise<boolean> {
  if (extraOrigins.includes(origin)) return true;
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (hostname === rootHost || hostname.endsWith(`.${rootHost}`)) return true;
  if (process.env.NODE_ENV !== 'production' && (hostname === 'localhost' || hostname.endsWith('.localhost'))) {
    return true;
  }
  return isVerifiedCustomDomain(hostname).catch(() => false);
}

export const corsOrigin = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  // No Origin header: same-origin requests, server-to-server calls, curl.
  if (!origin) return callback(null, true);
  isAllowedOrigin(origin).then((allowed) => callback(null, allowed));
};

/** Base URL to send a tenant user back to (e.g. after payment checkout):
 * the origin they came from if it's one of ours, otherwise their org's
 * subdomain. Login state lives in per-origin storage, so returning them to
 * the root domain would sign them out. */
export async function returnBaseUrl(origin: string | undefined, orgSlug: string | null | undefined): Promise<string> {
  if (origin && (await isAllowedOrigin(origin).catch(() => false))) return origin.replace(/\/$/, '');
  return buildAppUrl('/', orgSlug).replace(/\/$/, '');
}
