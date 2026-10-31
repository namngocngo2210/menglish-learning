import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it, vi } from "vitest";
import config from "../next.config";
it("serves every generated legacy redirect as permanent", async () => {
 const expected = JSON.parse(readFileSync("content/legacy-redirects.json", "utf8")) as {source: string; destination: string}[];
 expect(await config.redirects!()).toEqual(expected.map(r => ({ ...r, permanent: true })));
 for (const r of expected) expect(r.source).toMatch(/^\/[a-z0-9/-]+$/);
});
it("allows a missing redirect file during builds", async () => {
 const cwd = process.cwd();
 const spy = vi.spyOn(process, "cwd").mockReturnValue(join(cwd, "tests/fixtures"));
 try { expect(await config.redirects!()).toEqual([]); } finally { spy.mockRestore(); }
});
