import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain, extractCustomDomainCandidate, buildAdminUrl } from '@/lib/subdomain';
import prisma from '@/server/lib/prisma';

// Runs on the Node.js runtime (stable since Next 15.5) so it can read the
// tenant straight from the database - no HTTP hop to a separate API server.
export const config = {
  runtime: 'nodejs',
  // Everything except the API, Next internals and static files.
  matcher: ['/((?!api/|_next/static|_next/image|favicon\\.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|txt|xml|json|webmanifest|js)$).*)'],
};

// Tenant lookups are hot (every page view) and change rarely.
const CACHE_MS = 60_000;
const cache = new Map<string, { slug: string | null; expires: number }>();

async function cached(key: string, load: () => Promise<string | null>): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.slug;
  const slug = await load();
  cache.set(key, { slug, expires: Date.now() + CACHE_MS });
  if (cache.size > 5000) cache.clear();
  return slug;
}

const slugExists = (slug: string) =>
  cached(`slug:${slug}`, async () => {
    const org = await prisma.organization.findUnique({ where: { slug }, select: { slug: true } });
    return org?.slug ?? null;
  });

const slugForCustomDomain = (domain: string) =>
  cached(`domain:${domain}`, async () => {
    const found = await prisma.customDomain.findFirst({
      where: { domain, status: 'VERIFIED' },
      select: { organization: { select: { slug: true } } },
    });
    return found?.organization.slug ?? null;
  });

function notFound(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/workspace-not-found';
  return NextResponse.rewrite(url);
}

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const subdomain = extractSubdomain(host);
  const { pathname } = req.nextUrl;

  // Root domain / www: block direct /superadmin access from here. Before
  // falling back to that, check whether this host is a verified custom
  // domain - if so, treat it exactly like a tenant subdomain.
  if (!subdomain) {
    const candidate = extractCustomDomainCandidate(host);
    if (candidate) {
      const slug = await slugForCustomDomain(candidate).catch(() => null);
      if (slug) {
        const response = NextResponse.next();
        response.headers.set('x-tenant-slug', slug);
        response.headers.set('x-tenant-custom-domain', candidate);
        return response;
      }
    }

    if (pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL(buildAdminUrl(pathname), req.url));
    }
    return NextResponse.next();
  }

  // Admin subdomain: only rewrite the bare root to the superadmin dashboard.
  if (subdomain === 'admin') {
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/superadmin';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Any other subdomain: treat as a tenant slug and resolve it. A DB error
  // fails to the not-found page rather than a 500 on every tenant request.
  const slug = await slugExists(subdomain).catch(() => null);
  if (!slug) return notFound(req);

  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}
