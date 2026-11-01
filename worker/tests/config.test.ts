import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config";
import { createLogger } from "../src/log";

describe("worker config", () => {
  it("reads secrets from *_FILE and applies defaults", () => {
    const dir = mkdtempSync(join(tmpdir(), "bj-cfg-"));
    writeFileSync(join(dir, "db"), "postgres://u:p@h/db\n");
    writeFileSync(join(dir, "tok"), "x".repeat(20) + "\n");
    const cfg = loadConfig({
      DATABASE_URL_FILE: join(dir, "db"),
      EDGE_PURGE_URL: "http://web:3100/_purge",
      EDGE_PURGE_TOKEN_FILE: join(dir, "tok"),
    });
    expect(cfg).toMatchObject({
      databaseUrl: "postgres://u:p@h/db",
      maxAttempts: 3,
      jobStaleSeconds: 300,
    });
    expect(cfg.edgePurgeToken).toBe("x".repeat(20));
  });

  it("names the bad variable but never prints its value", () => {
    expect(() => loadConfig({ DATABASE_URL: "postgres://secret", MAX_ATTEMPTS: "banana" })).toThrow(
      /MAX_ATTEMPTS/,
    );
    try {
      loadConfig({ DATABASE_URL: "postgres://secret", MAX_ATTEMPTS: "banana" });
    } catch (e) {
      expect(String(e)).not.toContain("banana");
    }
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it("writes one JSON line per event", () => {
    const lines: string[] = [];
    createLogger((l) => lines.push(l)).warn("ev", { job: "1" });
    expect(JSON.parse(lines[0] ?? "")).toMatchObject({ level: "warn", event: "ev", job: "1" });
  });
});
