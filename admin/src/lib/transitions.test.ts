import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { allowed, TRANSITIONS } from "./transitions";

describe("transitions", () => {
  it("publish is only reachable from in_review", () => {
    const from = Object.entries(TRANSITIONS)
      .filter(([, to]) => to.includes("published"))
      .map(([s]) => s);
    expect(from).toEqual(["in_review"]);
  });
  it("tests never offer quarantine/rejected", () => {
    expect(allowed("test", "draft")).toEqual(["in_review", "archived"]);
  });
  it("matches the server table", () => {
    const src = readFileSync(resolve(process.cwd(), "../api/src/cms/transitions.ts"), "utf8");
    for (const [from, to] of Object.entries(TRANSITIONS)) {
      const m = new RegExp(`${from}: \\[([^\\]]*)\\]`).exec(src);
      expect(m?.[1]?.match(/"(\w+)"/g)?.map((x) => x.replaceAll('"', ""))).toEqual([...to]);
    }
  });
});
