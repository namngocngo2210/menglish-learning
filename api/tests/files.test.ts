import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readContentDir } from "../src/import/files";

function contentDir(
  quarantine: Record<string, string>,
  tests: Record<string, string> = {},
): string {
  const root = mkdtempSync(join(tmpdir(), "bj-files-"));
  mkdirSync(join(root, "quarantine"));
  mkdirSync(join(root, "tests"));
  for (const [name, body] of Object.entries(quarantine))
    writeFileSync(join(root, "quarantine", name), body);
  for (const [name, body] of Object.entries(tests)) writeFileSync(join(root, "tests", name), body);
  return root;
}

const EMPTY = JSON.stringify({ sources: [], passages: [], topics: [], questions: [], tests: [] });

describe("readContentDir", () => {
  it("reads the quarantine layer before the published layer and ignores non-JSON files", () => {
    const dir = contentDir(
      { "b.json": EMPTY, "a.json": EMPTY, "notes.txt": "x" },
      { "bank.json": EMPTY },
    );
    expect(readContentDir(dir).map((f) => `${f.layer}:${f.name}`)).toEqual([
      "quarantine:quarantine/a.json",
      "quarantine:quarantine/b.json",
      "published:tests/bank.json",
    ]);
  });

  it("names the file when the JSON is malformed", () => {
    expect(() => readContentDir(contentDir({ "bad.json": "{" }))).toThrow("quarantine/bad.json");
  });

  it("names the file and the path when the bundle fails schema validation", () => {
    const dir = contentDir({ "ok.json": EMPTY }, { "bank.json": JSON.stringify({ sources: [] }) });
    expect(() => readContentDir(dir)).toThrow(/tests\/bank\.json: passages/);
  });
});
