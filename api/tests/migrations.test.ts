import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "../src/db/connection";
import { readContentDir } from "../src/import/files";
import { buildPlan } from "../src/import/plan";
import { applyPlan } from "../src/import/write";
import { migrate } from "../src/migrate";
import { CONTENT_DIR } from "./content-dir";
import { ADMIN_URL, createMigratedDb, createTestDb } from "./helpers";
import type { TestDb } from "./helpers";

const MIGRATION_COUNT = 21;

async function tables(db: TestDb): Promise<string[]> {
  const { rows } = await db.admin.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> 'pgmigrations'
     ORDER BY table_name`,
  );
  return rows.map((r) => r.table_name);
}

describe.skipIf(ADMIN_URL === undefined)("migrations on an empty database", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createMigratedDb();
  });
  afterAll(async () => {
    await db.remove();
  });

  it("creates the whole schema when applied to an empty database", async () => {
    expect(await tables(db)).toEqual([
      "admin_sessions",
      "admin_users",
      "audit_log",
      "crawl_errors",
      "crawl_jobs",
      "login_attempts",
      "mixer_presets",
      "outbox_events",
      "passages",
      "question_reports",
      "question_revisions",
      "questions",
      "raw_documents",
      "sources",
      "test_items",
      "tests",
      "topics",
    ]);
    const applied = await db.admin.query("SELECT 1 FROM pgmigrations");
    expect(applied.rowCount).toBe(MIGRATION_COUNT);
  });

  it("is a no-op when applied a second time", async () => {
    expect(await migrate(db.url, { direction: "up" })).toEqual([]);
  });

  it("indexes every foreign key column", async () => {
    const { rows } = await db.admin.query<{ table_name: string; column_name: string }>(
      `SELECT cl.relname AS table_name, a.attname AS column_name
       FROM pg_constraint c
       JOIN pg_class cl ON cl.oid = c.conrelid
       JOIN pg_namespace n ON n.oid = cl.relnamespace AND n.nspname = 'public'
       JOIN LATERAL unnest(c.conkey) WITH ORDINALITY k(attnum, ord) ON true
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
       WHERE c.contype = 'f' AND k.ord = 1
         AND cl.relname <> 'pgmigrations'
         AND NOT EXISTS (
           SELECT 1 FROM pg_index i
           WHERE i.indrelid = c.conrelid AND i.indkey[0] = k.attnum AND i.indpred IS NULL
         )`,
    );
    expect(rows).toEqual([]);
  });

  it("uses timestamptz for every time column and snake_case for every identifier", async () => {
    const { rows } = await db.admin.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      `SELECT table_name, column_name, data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name <> 'pgmigrations'`,
    );
    expect(rows.filter((r) => r.data_type === "timestamp without time zone")).toEqual([]);
    expect(
      rows.filter(
        (r) => r.column_name.endsWith("_at") && r.data_type !== "timestamp with time zone",
      ),
    ).toEqual([]);
    expect(
      rows.filter(
        (r) => !/^[a-z][a-z0-9_]*$/.test(r.column_name) || !/^[a-z][a-z0-9_]*$/.test(r.table_name),
      ),
    ).toEqual([]);
  });

  it("uses a bigint identity primary key on every table except the composite and hash-keyed ones", async () => {
    const { rows } = await db.admin.query<{
      table_name: string;
      data_type: string;
      is_identity: string;
    }>(
      `SELECT table_name, data_type, is_identity FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'id' AND table_name <> 'pgmigrations'
         AND table_name NOT LIKE 'v_public_%'`,
    );
    const odd = rows.filter((r) => !(r.data_type === "bigint" && r.is_identity === "YES"));
    expect(odd.map((r) => r.table_name)).toEqual(["admin_sessions"]); // sha256(token) text key
  });

  it("stores no student personal data columns", async () => {
    const { rows } = await db.admin.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_schema = 'public'
         AND column_name ~ '(^|_)(ip|phone|address|full_name|student|birth)(_|$)'
         AND column_name NOT IN ('ip_hash')`,
    );
    expect(rows).toEqual([]);
  });

  it("keeps the single-owner constraint on admin_users", async () => {
    await db.admin.query(
      `INSERT INTO admin_users (email, password_hash) VALUES ('a@example.test', 'x')`,
    );
    await expect(
      db.admin.query(
        `INSERT INTO admin_users (email, password_hash) VALUES ('b@example.test', 'x')`,
      ),
    ).rejects.toThrow(/admin_users_single/);
  });
});

describe.skipIf(ADMIN_URL === undefined)("migration down/up", () => {
  it("reverts and re-applies one step at a time on an empty database", async () => {
    const db = await createMigratedDb();
    try {
      for (let step = MIGRATION_COUNT; step >= 1; step--) {
        expect(await migrate(db.url, { direction: "down", count: 1 })).toHaveLength(1);
        const left = await db.admin.query("SELECT 1 FROM pgmigrations");
        expect(left.rowCount).toBe(step - 1);
      }
      expect(await tables(db)).toEqual([]);
      expect(await migrate(db.url, { direction: "up" })).toHaveLength(MIGRATION_COUNT);
      expect((await tables(db)).length).toBe(17);
    } finally {
      await db.remove();
    }
  });

  it("reverts everything and re-applies when the database already holds the imported content", async () => {
    const db = await createMigratedDb();
    const handle = connect(db.url);
    try {
      await applyPlan(handle.db, buildPlan(readContentDir(CONTENT_DIR)));
      const before = await db.admin.query<{ n: string }>("SELECT count(*) AS n FROM questions");
      expect(Number(before.rows[0]?.n)).toBe(2700);

      expect(await migrate(db.url, { direction: "down" })).toHaveLength(MIGRATION_COUNT);
      expect(await tables(db)).toEqual([]);

      await migrate(db.url, { direction: "up" });
      const after = await db.admin.query<{ n: string }>("SELECT count(*) AS n FROM questions");
      expect(Number(after.rows[0]?.n)).toBe(0);
    } finally {
      await handle.close();
      await db.remove();
    }
  });

  it("leaves the database unchanged when a migration fails halfway", async () => {
    const db = await createTestDb();
    try {
      await db.admin.query("CREATE TABLE sources (id int)"); // collides with migration 0002
      await expect(migrate(db.url, { direction: "up" })).rejects.toThrow();
      const { rows } = await db.admin.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`,
      );
      expect(rows.map((r) => r.table_name)).toEqual(["pgmigrations", "sources"]);
      const applied = await db.admin.query("SELECT 1 FROM pgmigrations");
      expect(applied.rowCount).toBe(0);
    } finally {
      await db.remove();
    }
  });
});
