import type { NextConfig } from "next";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { accountsEnabled } from "./lib/account/flag";
import { ACCOUNT_PRIVATE_PATHS } from "./lib/account/paths";

/** ROOMS_DEV_PROXY: local-only upstream for same-origin /rt/* (production routing is a separate sprint). */
function roomsDevProxy(env: Record<string, string | undefined> = process.env): string | null {
  const raw = env.ROOMS_DEV_PROXY?.trim();
  if (!raw) return null;
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("ROOMS_DEV_PROXY must be a valid http(s) URL"); }
  if (!["http:", "https:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("ROOMS_DEV_PROXY must point at localhost, 127.0.0.1 or [::1]");
  }
  return url.origin;
}

const config: NextConfig = {
  output: "standalone",
  // gzip inside the Next server buffers the proxied /rt SSE stream, so it is off only while the local dev proxy is on.
  compress: roomsDevProxy() === null,
  transpilePackages: ["@bj/core", "@bj/data", "@bj/db-types"],
  serverExternalPackages: ["pg"],
  async redirects() {
    let raw: string;
    try { raw = readFileSync(join(process.cwd(), "content/legacy-redirects.json"), "utf8"); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const redirects: { source: string; destination: string }[] = JSON.parse(raw);
    return redirects.map(({ source, destination }) => ({ source, destination, permanent: true }));
  },
  async rewrites() {
    const target = roomsDevProxy();
    return target ? [{ source: "/rt/:path*", destination: `${target}/rt/:path*` }] : [];
  },
  async headers() {
    // Room pages are private per-room shells: never indexed, never leak the code via Referer, never cached.
    const rooms = [
      { key: "X-Robots-Tag", value: "noindex, nofollow" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "Cache-Control", value: "no-store" },
    ];
    // Account pages (built only when ACCOUNTS_ENABLED): private, and one-time token links must not leak via Referer.
    const account = accountsEnabled() ? ACCOUNT_PRIVATE_PATHS.map(source => ({ source, headers: rooms })) : [];
    return [
      ...account,
      { source: "/luyen-tap-nhom/phong/:path*", headers: rooms },
      { source: "/luyen-tap-nhom/vao", headers: rooms },
    ];
  },
  outputFileTracingIncludes: { "/*": ["./content/tests/*.json"] },
};
export default config;
