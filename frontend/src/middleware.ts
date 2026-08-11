import { NextRequest, NextResponse } from 'next/server';
import { extractSubdomain, buildAdminUrl } from '@/lib/subdomain';

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://backend:9000/api/v1';

export async function middleware(req: NextRequest) {
  const host = req.headers.get('host') || '';
  const subdomain = extractSubdomain(host);
  const { pathname } = req.nextUrl;

  // Root domain / www: block direct /superadmin access from here.
  if (!subdomain) {
    if (pathname.startsWith('/superadmin')) {
      return NextResponse.redirect(new URL(buildAdminUrl(pathname), req.url));
    }
    return NextResponse.next();
  }

  // Admin subdomain: rewrite everything under /superadmin/*.
  if (subdomain === 'admin') {
    if (pathname.startsWith('/superadmin')) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = `/superadmin${pathname === '/' ? '' : pathname}`;
    return NextResponse.rewrite(url);
  }

  // Any other subdomain: treat as a tenant slug and resolve it.
  try {
    const lookupRes = await fetch(`${API_INTERNAL_URL}/public/orgs/by-slug/${subdomain}`);
    if (!lookupRes.ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/workspace-not-found';
      return NextResponse.rewrite(url);
    }
  } catch {
    // Backend unreachable — fail open to the not-found page rather than
    // a hard error, so a transient backend hiccup doesn't 500 every tenant.
    const url = req.nextUrl.clone();
    url.pathname = '/workspace-not-found';
    return NextResponse.rewrite(url);
  }

  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
