import { NextResponse, type NextRequest } from 'next/server';

// Neither the private client portal (hrms.zedtreeo.io) nor the sample-data demo
// (demo.zedtreeo.io) should be indexed by search engines — the demo is a bare
// login page over synthetic data with no SEO value. Because the app is
// client-rendered, a static <meta> tag is unreliable, so we set the
// X-Robots-Tag HTTP header per-request for these hosts.
const NOINDEX_HOSTS = new Set(['hrms.zedtreeo.io', 'demo.zedtreeo.io']);

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const host = req.headers.get('host')?.split(':')[0] ?? '';
  if (NOINDEX_HOSTS.has(host)) {
    res.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
}

export const config = {
  // Run on all routes except Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
