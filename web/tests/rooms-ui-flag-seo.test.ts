import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import config from "@/next.config";
import sitemap from "@/app/sitemap";
import { roomsEnabled } from "@/lib/rooms/flag";
import { getAllRoutes, absoluteUrl, TITLE_MAX } from "@/lib/seo";

const notFound = vi.hoisted(() => vi.fn(() => { throw new Error("NEXT_NOT_FOUND"); }));
vi.mock("next/navigation", () => ({ notFound, useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
afterEach(() => { vi.unstubAllEnvs(); notFound.mockClear(); });
beforeEach(() => vi.stubEnv("ROOMS_ENABLED", undefined));

it("flag is OFF by default and accepts only true/1", () => {
  expect(roomsEnabled({})).toBe(false);
  for (const v of ["", "false", "0", "yes", "off"]) expect(roomsEnabled({ ROOMS_ENABLED: v })).toBe(false);
  for (const v of ["true", "1", "TRUE", " true "]) expect(roomsEnabled({ ROOMS_ENABLED: v })).toBe(true);
});

it("sitemap lists the landing only when enabled and never any room URL", () => {
  expect(sitemap().map(e => e.url)).not.toContain(absoluteUrl("/luyen-tap-nhom"));
  vi.stubEnv("ROOMS_ENABLED", "true");
  const urls = sitemap().map(e => e.url);
  expect(urls).toContain(absoluteUrl("/luyen-tap-nhom"));
  expect(urls.filter(u => /\/luyen-tap-nhom\/(phong|vao)/.test(u))).toEqual([]);
  expect(getAllRoutes().filter(r => r.path.startsWith("/luyen-tap-nhom"))).toHaveLength(1);
});

it("room shell routes send X-Robots-Tag noindex, nofollow, no-referrer and no-store", async () => {
  const rules = await config.headers!();
  expect(rules.map(r => r.source).sort()).toEqual(["/luyen-tap-nhom/phong/:path*", "/luyen-tap-nhom/vao"]);
  for (const rule of rules) {
    const h = Object.fromEntries(rule.headers.map(x => [x.key, x.value]));
    expect(h).toMatchObject({ "X-Robots-Tag": "noindex, nofollow", "Referrer-Policy": "no-referrer", "Cache-Control": "no-store" });
  }
});

it("/rt rewrite exists only with a local ROOMS_DEV_PROXY", async () => {
  expect(await config.rewrites!()).toEqual([]);
  vi.stubEnv("ROOMS_DEV_PROXY", "http://127.0.0.1:4010/");
  expect(await config.rewrites!()).toEqual([{ source: "/rt/:path*", destination: "http://127.0.0.1:4010/rt/:path*" }]);
  vi.stubEnv("ROOMS_DEV_PROXY", "https://evil.example.com");
  await expect(config.rewrites!()).rejects.toThrow(/localhost/);
  vi.stubEnv("ROOMS_DEV_PROXY", "not a url");
  await expect(config.rewrites!()).rejects.toThrow(/valid/);
});

it("landing: indexable metadata with canonical/OG when on, noindex coming-soon when off", async () => {
  const { generateMetadata, default: Landing } = await import("@/app/luyen-tap-nhom/page");
  const off = generateMetadata();
  expect(off.robots).toEqual({ index: false, follow: false });
  const offHtml = renderToStaticMarkup(createElement(Landing));
  expect(offHtml).toContain("sắp ra mắt");
  expect(offHtml).not.toContain("Vị trí quảng cáo");
  expect(offHtml).not.toContain("FAQPage");
  vi.stubEnv("ROOMS_ENABLED", "1");
  const on = generateMetadata();
  expect(on.robots).toEqual({ index: true, follow: true });
  expect(on.alternates?.canonical).toBe(absoluteUrl("/luyen-tap-nhom"));
  expect(on.openGraph).toMatchObject({ url: absoluteUrl("/luyen-tap-nhom"), locale: "vi_VN" });
  expect(String(on.title).length).toBeLessThanOrEqual(TITLE_MAX);
  expect(String(on.description).length).toBeGreaterThan(80);
  const html = renderToStaticMarkup(createElement(Landing));
  for (const t of ["BreadcrumbList", "FAQPage", "WebPage"]) expect(html).toContain(`"@type":"${t}"`);
  expect(html).toContain("Cùng làm một đề, cùng lúc");
  expect(html.match(/Vị trí quảng cáo/g)).toHaveLength(1);
});

it("room shell and join routes: 404 when off or invalid code, noindex meta", async () => {
  const room = await import("@/app/luyen-tap-nhom/phong/[ma]/page");
  const join = await import("@/app/luyen-tap-nhom/vao/page");
  expect(room.metadata.robots).toEqual({ index: false, follow: false });
  expect(join.metadata.robots).toEqual({ index: false, follow: false });
  await expect(room.default({ params: Promise.resolve({ ma: "K7M2QX" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  expect(() => join.default()).toThrow("NEXT_NOT_FOUND");
  vi.stubEnv("ROOMS_ENABLED", "true");
  await expect(room.default({ params: Promise.resolve({ ma: "bad!" }) })).rejects.toThrow("NEXT_NOT_FOUND");
  await expect(room.default({ params: Promise.resolve({ ma: "k7m-2qx" }) })).resolves.toBeTruthy();
  expect(() => join.default()).not.toThrow();
});
