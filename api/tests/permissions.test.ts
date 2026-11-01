import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PoolClient } from "pg";
import { connect } from "../src/db/connection";
import { readContentDir } from "../src/import/files";
import { buildPlan } from "../src/import/plan";
import { applyPlan } from "../src/import/write";
import { CONTENT_DIR } from "./content-dir";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

/** Runs `fn` as the given group role inside a rolled-back transaction. */
async function asRole<T>(
  db: TestDb,
  role: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await db.admin.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL ROLE ${role}`);
    return await fn(client);
  } finally {
    await client.query("ROLLBACK");
    client.release();
  }
}

const NEW_QUESTION = (status: string) =>
  `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, stem, options, correct_key,
                          explanation, source_id, source_url, review_status, published_at)
   SELECT 'perm-' || '${status}', 6, 'ngu-phap', t.id, 1, 'Stem', '[{"key":"A","text":"a"},{"key":"B","text":"b"},{"key":"C","text":"c"},{"key":"D","text":"d"}]',
          'A', 'Because', s.id, 'https://example.test/q', '${status}', now()
   FROM topics t, sources s LIMIT 1`;

describe.skipIf(ADMIN_URL === undefined)("database roles", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createMigratedDb();
    const handle = connect(db.url);
    await applyPlan(handle.db, buildPlan(readContentDir(CONTENT_DIR)));
    await handle.close();
  });
  afterAll(async () => {
    await db.remove();
  });

  it("lets bj_worker insert a quarantine question", async () => {
    await asRole(db, "bj_worker", async (c) => {
      const result = await c.query(NEW_QUESTION("quarantine"));
      expect(result.rowCount).toBe(1);
    });
  });

  it("blocks bj_worker from inserting a published question", async () => {
    await expect(
      asRole(db, "bj_worker", (c) => c.query(NEW_QUESTION("published"))),
    ).rejects.toThrow(/may not publish/);
  });

  it("blocks bj_worker from publishing an existing question or changing content at all", async () => {
    await expect(
      asRole(db, "bj_worker", (c) =>
        c.query(
          `UPDATE questions SET review_status = 'published' WHERE review_status = 'quarantine'`,
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asRole(db, "bj_worker", (c) => c.query(`DELETE FROM questions`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("lets bj_api publish, and blocks a plain role with UPDATE grants from doing so", async () => {
    await asRole(db, "bj_api", async (c) => {
      const result = await c.query(
        `UPDATE questions SET review_status = 'published', published_at = now()
         WHERE review_status = 'quarantine'`,
      );
      expect(result.rowCount).toBe(2);
    });
    await db.admin.query("DROP ROLE IF EXISTS bj_plain");
    await db.admin.query("CREATE ROLE bj_plain NOLOGIN");
    await db.admin.query("GRANT SELECT, INSERT, UPDATE ON questions TO bj_plain");
    await db.admin.query("GRANT USAGE ON SEQUENCE questions_id_seq TO bj_plain");
    await expect(
      asRole(db, "bj_plain", (c) =>
        c.query(
          `UPDATE questions SET review_status = 'published', published_at = now() WHERE review_status = 'quarantine'`,
        ),
      ),
    ).rejects.toThrow(/may not publish/);
    await db.admin.query("REVOKE ALL ON questions FROM bj_plain");
    await db.admin.query("REVOKE USAGE ON SEQUENCE questions_id_seq FROM bj_plain");
    await db.admin.query("DROP ROLE bj_plain");
  });

  it("keeps audit_log append-only for bj_api", async () => {
    await asRole(db, "bj_api", async (c) => {
      await c.query(`INSERT INTO audit_log (action, entity_type) VALUES ('test', 'question')`);
      await c.query("SAVEPOINT s1");
      await expect(c.query(`UPDATE audit_log SET action = 'x'`)).rejects.toThrow(
        /permission denied/,
      );
      await c.query("ROLLBACK TO SAVEPOINT s1");
      await expect(c.query(`DELETE FROM audit_log`)).rejects.toThrow(/permission denied/);
    });
  });

  it("lets bj_web read the public views only", async () => {
    await asRole(db, "bj_web", async (c) => {
      const published = await c.query<{ n: string }>(
        "SELECT count(*) AS n FROM v_public_questions",
      );
      expect(Number(published.rows[0]?.n)).toBeGreaterThan(2000);
      const tests = await c.query<{ n: string }>("SELECT count(*) AS n FROM v_public_tests");
      expect(Number(tests.rows[0]?.n)).toBe(316);
      await c.query("SAVEPOINT s1");
      await expect(c.query("SELECT 1 FROM questions")).rejects.toThrow(/permission denied/);
      await c.query("ROLLBACK TO SAVEPOINT s1");
      await expect(c.query("SELECT 1 FROM admin_users")).rejects.toThrow(/permission denied/);
    });
  });

  it("hides a test from the public view when one of its questions stops being published", async () => {
    const victim = await db.admin.query<{ slug: string; qid: string }>(
      `SELECT te.slug, ti.question_id AS qid FROM tests te JOIN test_items ti ON ti.test_id = te.id
       WHERE te.review_status = 'published' ORDER BY te.id LIMIT 1`,
    );
    const { slug, qid } = victim.rows[0] ?? { slug: "", qid: "" };
    const client = await db.admin.connect();
    try {
      await client.query("BEGIN");
      await client.query(`UPDATE questions SET review_status = 'archived' WHERE id = $1`, [qid]);
      const visible = await client.query(`SELECT 1 FROM v_public_tests WHERE slug = $1`, [slug]);
      const items = await client.query(`SELECT 1 FROM v_public_test_items WHERE test_slug = $1`, [
        slug,
      ]);
      expect(visible.rowCount).toBe(0);
      expect(items.rowCount).toBe(0);
    } finally {
      await client.query("ROLLBACK");
      client.release();
    }
  });
});
