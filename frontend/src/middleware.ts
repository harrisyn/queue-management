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

  // Admin subdomain: only rewrite the bare root to the superadmin dashboard.
  // Everything else (e.g. /login, or /superadmin/* which already carries
  // the full prefix per the superadmin nav) passes through unmodified.
  if (subdomain === 'admin') {
    if (pathname === '/') {
      const url = req.nextUrl.clone();
      url.pathname = '/superadmin';
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // Any other subdomain: treat as a tenant slug and resolve it.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s budget
  try {
    const lookupRes = await fetch(`${API_INTERNAL_URL}/public/orgs/by-slug/${subdomain}`, {
      signal: controller.signal,
    });
    if (!lookupRes.ok) {
      const url = req.nextUrl.clone();
      url.pathname = '/workspace-not-found';
      return NextResponse.rewrite(url);
    }
  } catch {
    // Backend unreachable, or the lookup took too long and was aborted —
    // fail open to the not-found page rather than a hard error/hang, so a
    // transient backend hiccup doesn't 500 or wedge every tenant request.
    const url = req.nextUrl.clone();
    url.pathname = '/workspace-not-found';
    return NextResponse.rewrite(url);
  } finally {
    clearTimeout(timeoutId);
  }

  const response = NextResponse.next();
  response.headers.set('x-tenant-slug', subdomain);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
