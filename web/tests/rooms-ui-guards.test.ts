import { expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const walk = (dir: string): string[] => readdirSync(dir).flatMap(n => { const p = join(dir, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
const src = (dirs: string[]) => dirs.flatMap(d => walk(join(root, d))).filter(p => /\.tsx?$/.test(p));

it("no ads or localStorage anywhere in room surfaces", () => {
  const files = src(["components/rooms", "lib/rooms", "app/luyen-tap-nhom/phong", "app/luyen-tap-nhom/vao"]);
  expect(files.length).toBeGreaterThan(5);
  for (const f of files) expect(readFileSync(f, "utf8"), relative(root, f)).not.toMatch(/AdSlot|AdUnit|AdSenseLoader|adsbygoogle|localStorage|sessionStorage/);
});
it("the landing is the only rooms route with an ad slot", () => {
  const landing = readFileSync(join(root, "app/luyen-tap-nhom/page.tsx"), "utf8");
  expect(landing.match(/<AdSlot /g)).toHaveLength(1);
  expect(walk(join(root, "app/luyen-tap-nhom")).filter(p => /AdSlot/.test(readFileSync(p, "utf8")))).toEqual([join(root, "app/luyen-tap-nhom/page.tsx")]);
});
it("room client never references answer keys on the play path and stays same-origin", () => {
  const types = readFileSync(join(root, "lib/rooms/types.ts"), "utf8");
  const quiz = /interface QuizQuestion \{[^}]*\}/.exec(types)![0];
  expect(quiz).not.toMatch(/correctKey|explanation/);
  for (const f of src(["lib/rooms", "components/rooms"])) expect(readFileSync(f, "utf8"), relative(root, f)).not.toMatch(/https?:\/\//);
});
