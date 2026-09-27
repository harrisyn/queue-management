import dns from 'dns';
import net from 'net';

// Outbound requests to tenant-configured URLs (webhooks, data sources) must
// not be usable to reach internal services (SSRF): the DB, Redis, cloud
// metadata endpoints, other containers on the Docker network.

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const lower = ip.toLowerCase();
  if (lower.startsWith('::ffff:')) return isPrivateAddress(lower.slice(7));
  return lower === '::1' || lower === '::' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
}

/** Throws unless `rawUrl` is http(s) and resolves only to public addresses.
 * ALLOW_PRIVATE_OUTBOUND_URLS=true relaxes this for local development. */
export async function assertPublicUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw Object.assign(new Error('Invalid URL'), { status: 400 });
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw Object.assign(new Error('URL must use http or https'), { status: 400 });
  }
  if (process.env.ALLOW_PRIVATE_OUTBOUND_URLS === 'true') return url;
  if (process.env.NODE_ENV === 'production' && url.protocol !== 'https:') {
    throw Object.assign(new Error('URL must use https'), { status: 400 });
  }

  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = net.isIP(host)
    ? [host]
    : (await dns.promises.lookup(host, { all: true }).catch(() => [])).map((a) => a.address);
  if (addresses.length === 0) {
    throw Object.assign(new Error(`Could not resolve ${host}`), { status: 400 });
  }
  if (addresses.some(isPrivateAddress)) {
    throw Object.assign(new Error('URL points to a private network address'), { status: 400 });
  }
  return url;
}
