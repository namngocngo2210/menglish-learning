import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";

describe("loadConfig", () => {
  it("reads DATABASE_URL when no file is given", () => {
    expect(loadConfig({ DATABASE_URL: "postgres://u:p@h/db" })).toEqual({
      databaseUrl: "postgres://u:p@h/db",
    });
  });

  it("prefers DATABASE_URL_FILE and trims the secret file content", () => {
    const dir = mkdtempSync(join(tmpdir(), "bj-config-"));
    const file = join(dir, "db_url");
    writeFileSync(file, "postgres://file:secret@h/db\n");
    expect(loadConfig({ DATABASE_URL: "postgres://ignored", DATABASE_URL_FILE: file })).toEqual({
      databaseUrl: "postgres://file:secret@h/db",
    });
  });

  it("names the missing variable when nothing is configured", () => {
    expect(() => loadConfig({})).toThrow("DATABASE_URL or DATABASE_URL_FILE");
  });

  it("rejects an empty value without echoing it", () => {
    expect(() => loadConfig({ DATABASE_URL: "" })).toThrow("DATABASE_URL");
  });
});
