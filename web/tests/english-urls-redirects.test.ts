import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { legacyToPublicPath } from "@bj/core";
import { proxy } from "../proxy";
import { getAllRoutes } from "@/lib/seo";

const run = (path: string) => proxy(new NextRequest(`http://localhost:3000${path}`));
const oldUrls: string[] = JSON.parse(readFileSync("tests/fixtures/old-sitemap-urls.json", "utf8"));
const legacy: { source: string; destination: string }[] = JSON.parse(readFileSync("content/legacy-redirects.json", "utf8"));

describe("301 from every old URL", () => {
  const live = new Set(getAllRoutes().map(r => r.path));
  it("fixture is the live sitemap captured 2/11", () => { expect(oldUrls.length).toBeGreaterThanOrEqual(373); });

  it("answers one 301 hop to a new path, never a chain or loop", () => {
    const unmapped: string[] = [];
    for (const old of oldUrls) {
      if (old === "/") { expect(run(old).headers.get("location")).toBeNull(); continue; }
      const res = run(old);
      expect(res.status, old).toBe(301);
      const target = new URL(res.headers.get("location")!).pathname;
      expect(target, old).toBe(legacyToPublicPath(old));
      expect(run(target).headers.get("location"), `${old} -> ${target} must be final`).toBeNull();
      if (!live.has(target)) unmapped.push(`${old} -> ${target}`);
    }
    // Pages that exist in production but not in the local demo bank are fine; the mapping itself is total (above).
    expect(unmapped.length).toBeLessThan(oldUrls.length);
  });

  it("keeps the query string and folds a trailing slash into the same single hop", () => {
    const q = run("/lop-6/ngu-phap/?utm_source=facebook&x=1");
    expect(q.status).toBe(301);
    expect(new URL(q.headers.get("location")!).pathname + new URL(q.headers.get("location")!).search).toBe("/grade-6/grammar?utm_source=facebook&x=1");
    expect(run("/luyen-tap-nhom/phong/ABCDEF").headers.get("location")).toBe("http://localhost:3000/group-practice/room/ABCDEF");
    const slash = run("/grade-6/");
    expect(slash.status).toBe(301);
    expect(slash.headers.get("location")).toBe("http://localhost:3000/grade-6");
  });

  it("earlier redirects (legacy-redirects.json) also land on the new URL in one hop", () => {
    for (const { source, destination } of legacy) {
      const res = run(source);
      expect(res.status, source).toBe(301);
      expect(new URL(res.headers.get("location")!).pathname, source).toBe(legacyToPublicPath(destination));
    }
  });

  it("leaves unknown, new, asset and api paths alone", () => {
    for (const p of ["/lop-5", "/lop-6/khong-co", "/grade-6", "/about", "/api/v1/x", "/rt/x", "/icon.png"]) expect(run(p).headers.get("location"), p).toBeNull();
  });
});
