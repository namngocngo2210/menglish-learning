// @vitest-environment jsdom
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { Mascot, HeroArt, GradeBadge, SkillIcon } from "@/components/art";
import { skillTone } from "@/components/art/SkillIcon";
import { SITE } from "@/lib/site-config";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
const poses = ["welcome", "thinking", "correct", "oops", "trophy", "group", "sleepy", "reading"] as const;

it("gives every mascot pose fixed dimensions and optional accessible naming", () => {
 for (const pose of poses) {
  const decorative = renderToStaticMarkup(createElement(Mascot, { pose, size: 120 }));
  expect(decorative).toMatch(/^<svg width="120" height="120" viewBox="0 0 120 120"/);
  expect(decorative).toContain('aria-hidden="true"');
  expect(decorative).toContain('focusable="false"');
  expect(decorative).not.toContain('role="img"');
  const named = renderToStaticMarkup(createElement(Mascot, { pose, size: 80, title: "Ong đồng hành", className: "example" }));
  expect(named).toContain('width="80" height="80"');
  expect(named).toContain('class="example" role="img"');
  expect(named).toContain('<title>Ong đồng hành</title>');
  expect(named).not.toContain('aria-hidden');
 }
});

it("keeps original art self-contained, font-free and small", () => {
 for (const file of readdirSync("components/art")) {
  const source = readFileSync(`components/art/${file}`, "utf8");
  expect(source, file).not.toMatch(/http|<image|<script|href\s*=|<text\b|<defs\b|use client/i);
 }
 expect(Buffer.byteLength(readFileSync("components/art/Mascot.tsx", "utf8"))).toBeLessThan(12000);
 for (const kind of Object.keys(skillTone) as (keyof typeof skillTone)[]) {
  const html = renderToStaticMarkup(createElement(SkillIcon, { kind }));
  expect(html).toContain('width="56" height="56"');
  expect(html).toContain(`var(--color-skill-${skillTone[kind]})`);
 }
 for (const grade of [6, 7, 8, 9] as const) expect(renderToStaticMarkup(createElement(GradeBadge, { grade }))).toContain('aria-hidden="true"');
 expect(renderToStaticMarkup(createElement(HeroArt))).toContain('aria-hidden="true"');
});

function luminance(hex: string) {
 const rgb = hex.match(/[\da-f]{2}/gi)!.map(channel => {
  const value = parseInt(channel, 16) / 255;
  return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
 });
 return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a: string, b: string) {
 const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
 return (values[0] + .05) / (values[1] + .05);
}

it("keeps every skill above 4.5:1 on its soft tile and cream, with accurate documented ratios", () => {
 const css = readFileSync("app/globals.css", "utf8");
 expect(css).toContain("@theme static {");
 const docs = readFileSync("../docs/visual-assets.md", "utf8");
 const token = (name: string) => css.match(new RegExp(`--color-${name}: (#[0-9a-f]{6});`))![1];
 for (const tone of Object.values(skillTone)) {
  const strong = token(`skill-${tone}`), soft = token(`skill-${tone}-soft`);
  const onSoft = contrast(strong, soft), onCream = contrast(strong, token("surface"));
  expect(onSoft, tone).toBeGreaterThanOrEqual(4.5);
  expect(onCream, tone).toBeGreaterThanOrEqual(4.5);
  expect(docs).toContain(`| ${tone} | \`${strong}\` | \`${soft}\` | ${onSoft.toFixed(2)} | ${onCream.toFixed(2)} |`);
 }
});

it("renders compact hero copy, crawlable grade choices and progressive disclosure within the SVG budget", async () => {
 const { default: Home } = await import("@/app/page");
 vi.stubEnv("ROOMS_ENABLED", "true");
 let html: string;
 try { html = renderToStaticMarkup(await Home()); } finally { vi.unstubAllEnvs(); }
 const doc = new DOMParser().parseFromString(html, "text/html");
 const h1 = doc.querySelector("h1")!;
 const hero = h1.closest("section")!;
 const picker = doc.querySelector("#chon-lop")!;
 const words = [h1.textContent, hero.querySelector("p")!.textContent, [...picker.querySelectorAll("a")].map(link => link.textContent).join(" ")].join(" ").trim().split(/\s+/);
 expect(words.length).toBeLessThanOrEqual(25);
 expect(h1.textContent).toBe(SITE.tagline);
 expect(hero.querySelectorAll("p")).toHaveLength(1);
 expect(hero.querySelector("p")!.textContent.trim().split(/\s+/).length).toBeLessThanOrEqual(10);
 for (const grade of [6, 7, 8, 9]) expect(picker.querySelector(`a[href="/grade-${grade}"]`)?.textContent).toBe(`Lớp ${grade}`);
 expect(doc.querySelectorAll("h1")).toHaveLength(1);
 expect(doc.querySelectorAll("#how-heading + ol > li")).toHaveLength(3);
 const details = [...doc.querySelectorAll("details")].find(node => node.querySelector("summary")?.textContent === "Xem thêm về BeeJunior")!;
 expect(details.hasAttribute("open")).toBe(false);
 expect(details.querySelectorAll("p")).toHaveLength(2);
 expect(details.compareDocumentPosition(doc.querySelector("#now-heading")!) & 2).toBeTruthy();
 expect(doc.querySelectorAll(".bee-float")).toHaveLength(1);
 const svg = [...doc.querySelectorAll("svg")].filter(node => !node.parentElement?.closest("svg")).map(node => node.outerHTML).join("");
 expect(Buffer.byteLength(svg)).toBeLessThan(25000);
 expect(gzipSync(svg).length).toBeLessThan(8000);
});
