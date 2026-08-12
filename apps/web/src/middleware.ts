import { NextResponse, type NextRequest } from 'next/server';

// Hosts that should NOT be indexed by search engines (e.g. a public demo).
// Configure via NOINDEX_HOSTS (comma-separated). Empty = your instance is
// indexable. Set as an HTTP header since the app is client-rendered.
const NOINDEX_HOSTS = new Set(
  (process.env.NOINDEX_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean),
);

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
