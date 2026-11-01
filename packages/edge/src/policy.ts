/** Cache policy per route (blueprint §4.3). Times are in seconds. */
export interface Policy {
  ttl: number;
  stale: number;
}

const DAY = 86_400;
const TEST_PAGE = /^\/(lop-[6-9]\/[a-z0-9-]+\/[a-z0-9-]+\/de-[0-9]+|thi-vao-lop-10\/[a-z0-9-]+)$/;

/** Policy for a successful (200) response of `path`. */
export function policyFor(path: string): Policy {
  if (path === "/sitemap.xml") return { ttl: 300, stale: DAY };
  if (path === "/robots.txt" || path === "/manifest.webmanifest") return { ttl: 3600, stale: DAY };
  if (path.startsWith("/pool/")) return { ttl: 300, stale: DAY };
  if (TEST_PAGE.test(path)) return { ttl: 300, stale: DAY };
  return { ttl: 60, stale: DAY };
}

/** Negative cache for a legitimate 404 (unknown slug). */
export const NOT_FOUND_POLICY: Policy = { ttl: 30, stale: 0 };

const CACHEABLE_TYPES = /^(text\/html|application\/json|application\/xml|text\/xml|text\/plain)/i;

export function isCacheableType(contentType: string | undefined): boolean {
  return contentType !== undefined && CACHEABLE_TYPES.test(contentType);
}

const TRACKING = /^(utm_.*|fbclid|gclid)$/i;

/** Cache key: pathname plus the query without tracking parameters, sorted. */
export function cacheKey(rawUrl: string): { path: string; key: string } {
  const url = new URL(rawUrl, "http://edge.local");
  const kept = [...url.searchParams.entries()]
    .filter(([name]) => !TRACKING.test(name))
    .sort(([a, av], [b, bv]) => (a === b ? av.localeCompare(bv) : a.localeCompare(b)));
  const query = new URLSearchParams(kept).toString();
  return { path: url.pathname, key: query ? `${url.pathname}?${query}` : url.pathname };
}
