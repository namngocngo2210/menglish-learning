import { NextResponse, type NextRequest } from "next/server";
import { legacyToPublicPath } from "@bj/core";
import legacy from "./content/legacy-redirects.json";

// Permanent: every URL that was ever public in Vietnamese answers one 301 hop to its English URL (docs/url-map.md).
const EARLIER_REDIRECTS = new Map(legacy.map(({ source, destination }) => [source, destination]));

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // skipTrailingSlashRedirect is on, so "/x/" is folded into the same single hop.
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  const target = legacyToPublicPath(clean, EARLIER_REDIRECTS) ?? (clean === pathname ? null : clean);
  if (target === null) return NextResponse.next();
  return NextResponse.redirect(new URL(target + request.nextUrl.search, request.url), 301);
}

export const config = { matcher: ["/((?!_next/|rt/|api/|.*\\..*).*)"] };
