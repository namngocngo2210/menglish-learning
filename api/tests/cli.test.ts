import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { main } from "../src/cli";
import { ADMIN_URL, createTestDb } from "./helpers";
import type { TestDb } from "./helpers";
import { CONTENT_DIR } from "./content-dir";

function capture() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (l: string) => out.push(l), err: (l: string) => err.push(l) }, out, err };
}

describe("cli usage", () => {
  it("prints usage and exits 2 when no command is given", async () => {
    const c = capture();
    expect(await main([], c.io, {})).toBe(2);
    expect(c.out.join("\n")).toContain("Usage: bj <command>");
  });

  it("prints usage and exits 0 for help", async () => {
    const c = capture();
    expect(await main(["help"], c.io, {})).toBe(0);
  });

  it("rejects an unknown command", async () => {
    const c = capture();
    expect(await main(["explode"], c.io, {})).toBe(2);
    expect(c.err.join("\n")).toContain("Unknown command: explode");
  });

  it("refuses to revert every migration without an explicit --all or --count", async () => {
    const c = capture();
    const env = { DATABASE_URL: "postgres://nobody@127.0.0.1:1/none" };
    expect(await main(["migrate", "--down"], c.io, env)).toBe(1);
    expect(c.err.join("\n")).toContain("Refusing to revert everything");
  });

  it("validates --count and a missing --out", async () => {
    const env = { DATABASE_URL: "postgres://nobody@127.0.0.1:1/none" };
    const a = capture();
    expect(await main(["migrate", "--down", "--count", "0"], a.io, env)).toBe(1);
    expect(a.err.join("\n")).toContain("--count must be a positive integer");
    const b = capture();
    expect(await main(["export-snapshot"], b.io, env)).toBe(1);
    expect(b.err.join("\n")).toContain("requires --out");
  });

  it("fails without echoing a value when the database is not configured", async () => {
    const c = capture();
    expect(await main(["import"], c.io, {})).toBe(1);
    expect(c.err.join("\n")).toContain("DATABASE_URL or DATABASE_URL_FILE");
  });
});

describe.skipIf(ADMIN_URL === undefined)("cli end to end", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createTestDb();
  });
  afterAll(async () => {
    await db.remove();
  });

  it("migrates, imports, passes parity and exports a snapshot", async () => {
    const env = { DATABASE_URL: db.url };
    const migrateRun = capture();
    expect(await main(["migrate"], migrateRun.io, env)).toBe(0);
    expect(migrateRun.out.join("")).toContain("up: 36 migration(s)");

    const dry = capture();
    expect(await main(["import", "--content-dir", CONTENT_DIR, "--dry-run"], dry.io, env)).toBe(0);
    expect(JSON.parse(dry.out.join("\n"))).toMatchObject({
      dryRun: true,
      questions: { inserted: 2700 },
    });

    const imported = capture();
    expect(await main(["import", "--content-dir", CONTENT_DIR], imported.io, env)).toBe(0);
    expect(JSON.parse(imported.out.join("\n"))).toMatchObject({
      dryRun: false,
      tests: { inserted: 316 },
    });

    const parity = capture();
    expect(await main(["parity", "--content-dir", CONTENT_DIR], parity.io, env)).toBe(0);
    expect(JSON.parse(parity.out.join("\n"))).toMatchObject({
      differences: 0,
      snapshotRoundTrip: { differences: 0 },
    });

    const dir = mkdtempSync(join(tmpdir(), "bj-cli-snapshot-"));
    const exported = capture();
    expect(await main(["export-snapshot", "--out", dir], exported.io, env)).toBe(0);
    expect(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")).counts.questions).toBe(
      2698,
    );

    const down = capture();
    expect(await main(["migrate", "--down", "--count", "1"], down.io, env)).toBe(0);
    expect(down.out.join("")).toContain("down: 1 migration(s)");
  });

  it("exits 1 and lists differences when the database drifts from the seed", async () => {
    await db.admin.query(
      "UPDATE questions SET stem = stem || ' x' WHERE id = (SELECT min(id) FROM questions)",
    );
    const parity = capture();
    expect(
      await main(["parity", "--content-dir", CONTENT_DIR], parity.io, { DATABASE_URL: db.url }),
    ).toBe(1);
    expect(JSON.parse(parity.out.join("\n")).differences).toBeGreaterThan(0);
  });
});
