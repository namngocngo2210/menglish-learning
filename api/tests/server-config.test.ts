import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadServerConfig } from "../src/server/config";

describe("loadServerConfig", () => {
  it("applies defaults and reads secrets from *_FILE", () => {
    const dir = mkdtempSync(join(tmpdir(), "bj-cfg-"));
    writeFileSync(join(dir, "db"), "postgres://u:p@h/db\n");
    writeFileSync(join(dir, "token"), "0123456789abcdef-token\n");
    const config = loadServerConfig({
      DATABASE_URL_FILE: join(dir, "db"),
      INTERNAL_TOKEN_FILE: join(dir, "token"),
    });
    expect(config).toMatchObject({
      port: 8080,
      host: "0.0.0.0",
      databaseUrl: "postgres://u:p@h/db",
      internalToken: "0123456789abcdef-token",
      rateLimitPerMinute: 120,
    });
  });

  it("accepts DATABASE_URL and leaves the internal token undefined", () => {
    const config = loadServerConfig({ DATABASE_URL: "postgres://x/y", PORT: "9000" });
    expect(config.port).toBe(9000);
    expect(config.internalToken).toBeUndefined();
  });

  it("fails naming the variable and never echoing its value", () => {
    expect(() => loadServerConfig({})).toThrow("DATABASE_URL");
    expect(() => loadServerConfig({ DATABASE_URL: "x", PORT: "banana" })).toThrow("PORT");
    try {
      loadServerConfig({ DATABASE_URL: "x", INTERNAL_TOKEN: "short" });
    } catch (error) {
      expect(String(error)).toContain("INTERNAL_TOKEN");
      expect(String(error)).not.toContain("short");
    }
  });
});
