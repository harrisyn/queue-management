// Registers tenant custom domains with the hosting platform so they get
// routed to this deployment and issued a TLS certificate. Only Vercel is
// implemented (VERCEL_TOKEN + VERCEL_PROJECT_ID, optional VERCEL_TEAM_ID);
// with neither set - e.g. self-hosted behind Caddy/nginx - every call is a
// no-op and ownership is checked by CNAME alone.

export interface DomainStatus {
  managed: boolean; // false = no hosting provider configured
  verified: boolean; // provider has confirmed ownership / DNS
  message?: string;
}

const API = 'https://api.vercel.com';

function config() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (!token || !projectId) return null;
  const team = process.env.VERCEL_TEAM_ID ? `teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '';
  return { token, projectId, team };
}

async function vercel(path: string, init: RequestInit = {}) {
  const cfg = config()!;
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API}${path}${cfg.team ? sep + cfg.team : ''}`, {
    ...init,
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json', ...init.headers },
  });
  const body = (await res.json().catch(() => ({}))) as any;
  return { ok: res.ok, status: res.status, body };
}

export const isHostingManaged = () => config() !== null;

/** CNAME target tenants must point their domain at. */
export function cnameTarget(): string {
  if (process.env.CUSTOM_DOMAIN_CNAME_TARGET) return process.env.CUSTOM_DOMAIN_CNAME_TARGET;
  if (isHostingManaged()) return 'cname.vercel-dns.com';
  try {
    return new URL(process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:8003').hostname;
  } catch {
    return 'localhost';
  }
}

export async function addDomain(domain: string): Promise<DomainStatus> {
  const cfg = config();
  if (!cfg) return { managed: false, verified: false };
  const res = await vercel(`/v10/projects/${cfg.projectId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ name: domain }),
  });
  // 409 = already attached to this project; fine.
  if (!res.ok && res.status !== 409) {
    return { managed: true, verified: false, message: res.body?.error?.message || `Hosting provider error ${res.status}` };
  }
  return { managed: true, verified: !!res.body?.verified };
}

export async function checkDomain(domain: string): Promise<DomainStatus> {
  const cfg = config();
  if (!cfg) return { managed: false, verified: false };
  const [project, dns] = await Promise.all([
    vercel(`/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(domain)}`),
    vercel(`/v6/domains/${encodeURIComponent(domain)}/config`),
  ]);
  if (!project.ok) {
    // Not attached yet (e.g. added before hosting was configured) - attach now.
    return addDomain(domain);
  }
  if (!project.body?.verified) {
    await vercel(`/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(domain)}/verify`, { method: 'POST' });
  }
  const misconfigured = dns.ok ? !!dns.body?.misconfigured : true;
  return {
    managed: true,
    verified: !!project.body?.verified && !misconfigured,
    message: misconfigured ? 'DNS is not pointing at this app yet' : undefined,
  };
}

export async function removeDomain(domain: string): Promise<void> {
  const cfg = config();
  if (!cfg) return;
  await vercel(`/v9/projects/${cfg.projectId}/domains/${encodeURIComponent(domain)}`, { method: 'DELETE' }).catch(() => {});
}
