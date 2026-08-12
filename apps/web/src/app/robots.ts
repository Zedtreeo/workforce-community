import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// Host-conditional robots.txt: hosts in NOINDEX_HOSTS (comma-separated env,
// e.g. a public demo) disallow crawling; any other host stays crawlable.
const NOINDEX_HOSTS = new Set(
  (process.env.NOINDEX_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean),
);

export default function robots(): MetadataRoute.Robots {
  const host = headers().get('host')?.split(':')[0] ?? '';
  const isPrivatePortal = NOINDEX_HOSTS.has(host);
  return {
    rules: {
      userAgent: '*',
      ...(isPrivatePortal ? { disallow: '/' } : { allow: '/' }),
    },
  };
}
