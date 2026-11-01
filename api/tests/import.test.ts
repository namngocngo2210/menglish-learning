import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ContentBundleSchema } from "@bj/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connect } from "../src/db/connection";
import type { DbHandle } from "../src/db/connection";
import { readContentDir } from "../src/import/files";
import {
  compareSnapshot,
  diffSummaries,
  summarizeDatabase,
  summarizePlan,
} from "../src/import/parity";
import { buildPlan } from "../src/import/plan";
import { applyPlan } from "../src/import/write";
import { exportSnapshot } from "../src/snapshot/export";
import { writeSnapshot } from "../src/snapshot/write";
import { CONTENT_DIR } from "./content-dir";
import { ADMIN_URL, createMigratedDb } from "./helpers";
import type { TestDb } from "./helpers";

describe.skipIf(ADMIN_URL === undefined)("importer against a real database", () => {
  const files = readContentDir(CONTENT_DIR);
  const plan = buildPlan(files);
  let testDb: TestDb;
  let handle: DbHandle;

  beforeAll(async () => {
    testDb = await createMigratedDb();
    handle = connect(testDb.url);
  });
  afterAll(async () => {
    await handle.close();
    await testDb.remove();
  });

  it("rolls back everything when run with dryRun", async () => {
    const report = await applyPlan(handle.db, plan, { dryRun: true });
    expect(report.dryRun).toBe(true);
    expect(report.questions.inserted).toBe(2700);
    const { rows } = await testDb.admin.query<{ n: string }>("SELECT count(*) AS n FROM questions");
    expect(Number(rows[0]?.n)).toBe(0);
  });

  it("imports the blueprint 3.6 counts on the first run", async () => {
    const report = await applyPlan(handle.db, plan);
    expect(report).toMatchObject({
      sources: { planned: 2, inserted: 2 },
      topics: { planned: 146, inserted: 146 },
      passages: { planned: 50, inserted: 50 },
      questions: { planned: 2700, inserted: 2700 },
      tests: { planned: 316, inserted: 316 },
      testItems: { planned: 4590, inserted: 4590 },
    });
    const { rows } = await testDb.admin.query<{ review_status: string; n: string }>(
      "SELECT review_status, count(*) AS n FROM questions GROUP BY 1 ORDER BY 1",
    );
    expect(rows).toEqual([
      { review_status: "published", n: "2698" },
      { review_status: "quarantine", n: "2" },
    ]);
  });

  it("changes nothing when the import is run again", async () => {
    const before = await testDb.admin.query<{ t: string }>(
      "SELECT max(updated_at)::text AS t FROM questions",
    );
    const report = await applyPlan(handle.db, plan);
    for (const table of ["sources", "topics", "passages", "questions", "tests"] as const) {
      expect(report[table]).toMatchObject({
        inserted: 0,
        updated: 0,
        unchanged: report[table].planned,
      });
    }
    expect(report.testItems).toMatchObject({ inserted: 0, deleted: 0, testsChanged: 0 });
    const after = await testDb.admin.query<{ t: string }>(
      "SELECT max(updated_at)::text AS t FROM questions",
    );
    expect(after.rows[0]?.t).toBe(before.rows[0]?.t);
  });

  it("reports zero differences between the seed JSON and the database", async () => {
    const differences = diffSummaries(summarizePlan(plan), await summarizeDatabase(handle.db));
    expect(differences).toEqual([]);
  });

  it("matches the per-source and per-status table of blueprint 3.6", async () => {
    const actual = await summarizeDatabase(handle.db);
    expect(actual.counts).toMatchObject({
      "questions.published": 2698,
      "questions.published@voa-learning-english": 2587,
      "questions.quarantine": 2,
      "passages.published": 50,
      tests: 316,
      test_items: 4590,
      sources: 2,
      topics: 146,
    });
    const gov = Object.entries(actual.counts).find(([k]) =>
      k.startsWith("questions.published@gov-"),
    );
    expect(gov?.[1]).toBe(111);
  });

  it("round-trips: the exported snapshot equals the seed JSON of the published layer", async () => {
    const snapshot = await exportSnapshot(handle.db);
    expect(ContentBundleSchema.safeParse(snapshot).success).toBe(true);
    expect(compareSnapshot(snapshot, files)).toEqual({ differences: 0, samples: [] });
    expect(snapshot.questions).toHaveLength(2698);
    expect(snapshot.tests).toHaveLength(316);
    expect(snapshot.passages).toHaveLength(50);
  });

  it("writes the snapshot and a manifest with its sha256", async () => {
    const dir = mkdtempSync(join(tmpdir(), "bj-snapshot-"));
    const manifest = writeSnapshot(
      dir,
      await exportSnapshot(handle.db),
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(manifest.counts).toEqual({
      sources: 2,
      passages: 50,
      topics: 31,
      questions: 2698,
      tests: 316,
    });
    expect(JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"))).toEqual(manifest);
    expect(
      ContentBundleSchema.safeParse(JSON.parse(readFileSync(join(dir, "bundle.json"), "utf8")))
        .success,
    ).toBe(true);
  });

  it("detects a changed question text through the content hash", async () => {
    await testDb.admin.query(
      `UPDATE questions SET stem = stem || ' (edited)' WHERE external_id = (SELECT min(external_id) FROM questions)`,
    );
    const differences = diffSummaries(summarizePlan(plan), await summarizeDatabase(handle.db));
    expect(differences.some((d) => d.includes("content hash differs"))).toBe(true);
    expect(differences.some((d) => d.includes("text digest"))).toBe(true);
    await testDb.admin.query(`UPDATE questions SET stem = replace(stem, ' (edited)', '')`);
    expect(diffSummaries(summarizePlan(plan), await summarizeDatabase(handle.db))).toEqual([]);
  });

  it("detects a missing and an extra question", async () => {
    await testDb.admin.query(
      `UPDATE questions SET review_status = 'archived' WHERE external_id = (SELECT min(external_id) FROM questions WHERE review_status = 'quarantine')`,
    );
    const differences = diffSummaries(summarizePlan(plan), await summarizeDatabase(handle.db));
    expect(differences.some((d) => d.includes("questions.quarantine"))).toBe(true);
    await testDb.admin.query(
      `UPDATE questions SET review_status = 'quarantine' WHERE review_status = 'archived'`,
    );
  });

  it("repairs drift on seed rows but never overwrites a row edited in the CMS (version > 1)", async () => {
    await testDb.admin.query(
      `UPDATE questions SET explanation = 'drifted' WHERE external_id = 'gov-aaaaaaaa' OR external_id = (SELECT min(external_id) FROM questions WHERE external_id LIKE 'voa-%')`,
    );
    const edited = await testDb.admin.query<{ external_id: string }>(
      `UPDATE questions SET explanation = 'CMS edit', version = 2 WHERE external_id = (SELECT max(external_id) FROM questions WHERE external_id LIKE 'voa-%') RETURNING external_id`,
    );
    const report = await applyPlan(handle.db, plan);
    expect(report.questions.updated).toBe(1); // the drifted seed row; the CMS-edited row is protected
    const kept = await testDb.admin.query<{ explanation: string }>(
      `SELECT explanation FROM questions WHERE external_id = $1`,
      [edited.rows[0]?.external_id],
    );
    expect(kept.rows[0]?.explanation).toBe("CMS edit");
    const drift = await testDb.admin.query(`SELECT 1 FROM questions WHERE explanation = 'drifted'`);
    expect(drift.rowCount).toBe(0);
  });
});
