const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN || 'localhost:8003';

/**
 * Extracts the subdomain from a Host header value, relative to APP_DOMAIN.
 * Returns null for the bare root domain or `www`.
 * Returns null (treated as root) for any host that isn't a subdomain of
 * APP_DOMAIN at all (e.g. a raw IP during local debugging).
 */
export function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0];
  const domain = APP_DOMAIN.split(':')[0];

  if (hostname === domain || hostname === `www.${domain}`) {
    return null;
  }
  if (!hostname.endsWith(`.${domain}`)) {
    return null;
  }
  return hostname.slice(0, hostname.length - domain.length - 1);
}

function protocolFor(domain: string): string {
  return domain.startsWith('localhost') ? 'http' : 'https';
}

export function buildTenantUrl(slug: string, path: string = '/'): string {
  const protocol = protocolFor(APP_DOMAIN);
  return `${protocol}://${slug}.${APP_DOMAIN}${path}`;
}

export function buildAdminUrl(path: string = '/'): string {
  const protocol = protocolFor(APP_DOMAIN);
  return `${protocol}://admin.${APP_DOMAIN}${path}`;
}

export function buildRootUrl(path: string = '/'): string {
  const protocol = protocolFor(APP_DOMAIN);
  return `${protocol}://${APP_DOMAIN}${path}`;
}
