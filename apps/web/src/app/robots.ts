import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

// Host-conditional robots.txt: the private client portal AND the sample-data
// demo both disallow all crawling (any other host stays crawlable).
const NOINDEX_HOSTS = new Set(['hrms.zedtreeo.io', 'demo.zedtreeo.io']);

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
