import { readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { assemble, corpusStats, ocrOutcome, validateExtraction } from "@crawler";
import { readFileSync } from "node:fs";
import { runCrawlJob } from "../src/crawl";
import { importOcr } from "../src/import-ocr";
import { persistBundles } from "../src/persist";
import { claimJob } from "../src/queue";
import { tick } from "../src/runner";
import {
  ADMIN_URL,
  createWorkerDb,
  listen,
  publicResolver,
  silentLog,
  voaHandler,
} from "./helpers";
import type { TestDb } from "./helpers";

const OCR_DIR = resolve(fileURLToPath(new URL("../../crawler/ocr", import.meta.url)));

describe.skipIf(ADMIN_URL === undefined)("crawl runner", () => {
  let db: TestDb;
  let data: string;
  let origin: { port: number; close(): Promise<void> };
  beforeAll(async () => {
    db = await createWorkerDb();
    data = mkdtempSync(join(tmpdir(), "bj-crawl-"));
    origin = await listen(voaHandler(3));
  });
  afterAll(async () => {
    await origin.close();
    await db.remove();
  });

  const deps = () => ({
    pool: db.worker,
    cfg: { crawlDataDir: data, heartbeatMs: 60_000 },
    log: silentLog,
    workerId: "w-test",
    gapMs: 0,
    fetchOptions: { testServer: { port: origin.port }, resolver: publicResolver },
  });
  const enqueue = async (params: object = { limit: 3 }) => {
    await db.admin.query(
      "INSERT INTO crawl_jobs (source_id, params) SELECT id, $1::jsonb FROM sources WHERE code = 'voa-learning-english'",
      [JSON.stringify(params)],
    );
    const job = await claimJob(db.worker, "w-test");
    if (!job) throw new Error("no job claimed");
    return job;
  };

  it("stores only quarantine rows and crawl bookkeeping when a VOA job runs", async () => {
    const counters = await runCrawlJob(deps(), await enqueue());
    expect(counters.fetched).toBeGreaterThan(3);
    expect(counters.quarantined).toBeGreaterThan(0);
    const statuses = await db.admin.query<{ s: string }>(
      "SELECT DISTINCT review_status AS s FROM questions UNION SELECT review_status FROM passages",
    );
    expect(statuses.rows.map((r) => r.s)).toEqual(["quarantine"]);
    const docs = await db.admin.query("SELECT count(*)::int AS n FROM raw_documents");
    expect((docs.rows[0] as { n: number }).n).toBeGreaterThan(0);
    expect(await readdir(data)).toEqual([]); // throwaway job dir is removed
  });

  it("inserts nothing new when the same source is crawled again", async () => {
    const before = await db.admin.query("SELECT count(*)::int AS n FROM questions");
    const counters = await runCrawlJob(deps(), await enqueue());
    const after = await db.admin.query("SELECT count(*)::int AS n FROM questions");
    expect(counters.quarantined).toBe(0);
    expect(after.rows[0]).toEqual(before.rows[0]);
  });

  it("fails the job without retry when the source is disabled", async () => {
    const job = await enqueue();
    await db.admin.query("UPDATE sources SET enabled = false");
    await expect(runCrawlJob(deps(), job)).rejects.toMatchObject({ kind: "source_disabled" });
    await db.admin.query("UPDATE sources SET enabled = true");
  });

  it("marks the job failed with a crawl error when tick() hits a refused source", async () => {
    await db.admin.query("UPDATE sources SET enabled = false");
    await db.admin.query(
      "INSERT INTO crawl_jobs (source_id) SELECT id FROM sources WHERE code = 'voa-learning-english'",
    );
    const cfg = { ...deps().cfg, jobStaleSeconds: 300, maxAttempts: 3 };
    const r = await tick({
      pool: db.worker,
      cfg,
      log: silentLog,
      workerId: "w-test",
      post: undefined,
    });
    expect(r.ranJob).toBe(true);
    const job = await db.admin.query<{ status: string }>(
      "SELECT status FROM crawl_jobs ORDER BY id DESC LIMIT 1",
    );
    expect(job.rows[0]?.status).toBe("failed");
    const err = await db.admin.query("SELECT kind FROM crawl_errors ORDER BY id DESC LIMIT 1");
    expect(err.rows[0]).toEqual({ kind: "source_disabled" });
    await db.admin.query("UPDATE sources SET enabled = true");
  });

  it("fails the job when robots.txt disallows the sitemap", async () => {
    const blocked = await listen((req, res) => {
      if (req.url === "/robots.txt") res.writeHead(200).end("User-agent: *\nDisallow: /\n");
      else voaHandler(2)(req, res);
    });
    try {
      const job = await enqueue({ limit: 2 });
      await expect(
        runCrawlJob(
          {
            ...deps(),
            fetchOptions: { testServer: { port: blocked.port }, resolver: publicResolver },
          },
          job,
        ),
      ).rejects.toThrow(/Robots disallows/);
    } finally {
      await blocked.close();
    }
  });

  it("lets the worker role insert quarantine rows but never publish or modify content", async () => {
    const sql = (status: string) =>
      `INSERT INTO questions (external_id, grade, skill, topic_id, difficulty, stem, options, correct_key,
         explanation, source_id, source_url, review_status, published_at)
       SELECT 'perm-${status}', 6, 'ngu-phap', t.id, 1, 'Stem', '[{"key":"A","text":"a"},{"key":"B","text":"b"},{"key":"C","text":"c"},{"key":"D","text":"d"}]'::jsonb,
         'A', 'Why', s.id, 'https://example.test/q', '${status}', now() FROM topics t, sources s LIMIT 1`;
    await expect(db.worker.query(sql("published"))).rejects.toThrow(/may not publish/);
    await expect(db.worker.query(sql("draft"))).rejects.toThrow(/only insert quarantine/);
    await expect(
      db.worker.query("UPDATE questions SET review_status = 'published', published_at = now()"),
    ).rejects.toThrow();
    await expect(db.worker.query("DELETE FROM questions")).rejects.toThrow(/permission denied/);
    await expect(db.worker.query("UPDATE tests SET review_status = 'published'")).rejects.toThrow();
  });

  it("imports the committed Hanoi OCR transcriptions as 111 quarantine questions when the source exists", async () => {
    const ext = validateExtraction(
      JSON.parse(readFileSync(join(OCR_DIR, "hanoi-2024.json"), "utf8")),
    );
    const code = ocrOutcome(ext).candidates[0]?.sourceId;
    expect(code).toMatch(/^gov-/);
    await db.admin.query(
      `INSERT INTO sources (code, name, base_url, license, attribution, allowed_hosts, enabled)
       VALUES ($1, 'Hanoi', 'https://hanoi.edu.vn', 'Official', 'Hanoi', ARRAY['hanoi.edu.vn'], true)`,
      [code],
    );
    expect(assemble(ocrOutcome(ext).candidates, corpusStats([])).bundles.length).toBeGreaterThan(0);
    const first = await importOcr(db.worker, OCR_DIR);
    expect(first.files).toBe(3);
    expect(first.inserted).toBe(111);
    const again = await importOcr(db.worker, OCR_DIR);
    expect(again.inserted).toBe(0);
  });

  it("records a per-seed error and still finishes when an official PDF is unreadable or has no text layer", async () => {
    await db.admin.query(
      `INSERT INTO sources (code, name, base_url, license, attribution, allowed_hosts, enabled)
       VALUES ('gov-crawltest', 'Gov', 'https://hanoi.edu.vn', 'Official', 'Gov', ARRAY['hanoi.edu.vn'], true)`,
    );
    const pdf = await listen((req, res) => {
      if (req.url === "/robots.txt") res.writeHead(404).end();
      else
        res.writeHead(200, { "content-type": "application/pdf" }).end("%PDF-1.4\nnot a real pdf");
    });
    try {
      await db.admin.query(
        "INSERT INTO crawl_jobs (source_id, params) SELECT id, $1::jsonb FROM sources WHERE code = 'gov-crawltest'",
        [
          JSON.stringify({
            seeds: [
              { url: "https://hanoi.edu.vn/a.pdf", year: 2026, province: "X", grade: 9, kind: "k" },
              { url: "https://evil.example/b.pdf", year: 2026, province: "X", grade: 9, kind: "k" },
            ],
          }),
        ],
      );
      const job = await claimJob(db.worker, "w-test");
      if (!job) throw new Error("no job");
      const counters = await runCrawlJob(
        { ...deps(), fetchOptions: { testServer: { port: pdf.port }, resolver: publicResolver } },
        job,
      );
      expect(counters.quarantined).toBe(0);
      expect(counters.errors).toBeGreaterThan(0); // unreadable PDF; the non-allowlisted seed is dropped silently
    } finally {
      await pdf.close();
    }
  });

  it("refuses jobs with invalid params or for a source without a crawler, without retry", async () => {
    const job = await enqueue({ limit: 0 });
    await expect(runCrawlJob(deps(), job)).rejects.toMatchObject({ kind: "bad_params" });
    await db.admin.query(
      `INSERT INTO sources (code, name, base_url, license, attribution, enabled)
       VALUES ('other', 'Other', 'https://o.example', 'x', 'x', true)`,
    );
    await db.admin.query(
      "INSERT INTO crawl_jobs (source_id) SELECT id FROM sources WHERE code = 'other'",
    );
    const other = await claimJob(db.worker, "w-test");
    if (!other) throw new Error("no job");
    await expect(runCrawlJob(deps(), other)).rejects.toMatchObject({ kind: "unsupported_source" });
  });

  it("runs, finishes and counts a job through tick()", async () => {
    await db.admin.query("TRUNCATE crawl_jobs CASCADE");
    await db.admin.query(
      "INSERT INTO crawl_jobs (source_id, params) SELECT id, '{\"limit\":2}' FROM sources WHERE code = 'voa-learning-english'",
    );
    const cfg = { ...deps().cfg, jobStaleSeconds: 300, maxAttempts: 3 };
    const r = await tick({
      pool: db.worker,
      cfg,
      log: silentLog,
      workerId: "w-test",
      post: undefined,
      run: { gapMs: 0, fetchOptions: deps().fetchOptions },
    });
    expect(r.ranJob).toBe(true);
    const job = await db.admin.query("SELECT status FROM crawl_jobs");
    expect(job.rows[0]).toMatchObject({ status: "succeeded" });
  });

  it("skips questions whose source is unknown or disabled instead of creating anything", async () => {
    const q = (sourceId: string) => ({
      passages: [],
      sources: [],
      topics: [],
      questions: [
        {
          id: `skip-${sourceId}`,
          type: "mcq",
          grade: 6,
          skill: "ngu-phap",
          topicSlug: "chung",
          difficulty: 1,
          stem: "S",
          options: ["A", "B", "C", "D"].map((key) => ({ key, text: key.toLowerCase() })),
          correctKey: "A",
          explanation: "e",
          sourceId,
          sourceUrl: "https://x.test",
          sourceRef: "r",
          sourceName: "n",
          license: "l",
          crawledAt: "2026-01-01T00:00:00Z",
          reviewStatus: "quarantine",
        },
      ],
      tests: [],
    });
    const r = await persistBundles(db.worker, [
      q("missing-source") as never,
      q("voa-learning-english") as never,
    ]);
    expect(r).toEqual({ inserted: 1, skipped: { unknown_or_disabled_source: 1 } });
  });

  it("skips questions without a topic or with a missing passage", async () => {
    const base = {
      type: "mcq",
      difficulty: 1,
      stem: "S",
      options: ["A", "B", "C", "D"].map((key) => ({ key, text: key.toLowerCase() })),
      correctKey: "A",
      explanation: "e",
      sourceId: "voa-learning-english",
      sourceUrl: "https://x.test",
      sourceRef: "r",
      sourceName: "n",
      license: "l",
      crawledAt: "2026-01-01T00:00:00Z",
      reviewStatus: "quarantine",
    };
    const bundle = {
      passages: [],
      sources: [],
      topics: [],
      tests: [],
      questions: [
        { ...base, id: "nt-1", grade: 7, skill: "viet-cau", topicSlug: "chung" },
        {
          ...base,
          id: "nt-2",
          grade: 7,
          skill: "viet-cau",
          topicSlug: "chung",
          passageId: "ghost",
        },
      ],
    };
    await db.admin.query(
      "UPDATE topics SET slug = 'chung-off' WHERE grade = 7 AND skill = 'viet-cau'",
    );
    const r = await persistBundles(db.worker, [bundle as never]);
    expect(r.skipped).toEqual({ no_topic: 2 });
    await db.admin.query(
      "UPDATE topics SET slug = 'chung' WHERE grade = 7 AND skill = 'viet-cau' AND slug = 'chung-off'",
    );
    expect((await persistBundles(db.worker, [bundle as never])).skipped).toEqual({ no_passage: 1 });
  });

  it("reaps a dead worker's job at the start of tick() and re-runs it", async () => {
    await db.admin.query("TRUNCATE crawl_jobs CASCADE");
    await db.admin.query(
      `INSERT INTO crawl_jobs (source_id, params, status, locked_by, attempts, heartbeat_at)
       SELECT id, '{"limit":1}', 'running', 'dead', 1, now() - interval '1 hour' FROM sources WHERE code = 'voa-learning-english'`,
    );
    const cfg = { ...deps().cfg, jobStaleSeconds: 300, maxAttempts: 3 };
    const r = await tick({
      pool: db.worker,
      cfg,
      log: silentLog,
      workerId: "w-live",
      post: undefined,
      run: { gapMs: 0, fetchOptions: deps().fetchOptions },
    });
    expect(r).toMatchObject({ reaped: 1, ranJob: true });
    expect((await db.admin.query("SELECT status, attempts FROM crawl_jobs")).rows[0]).toEqual({
      status: "succeeded",
      attempts: 2,
    });
  });
});
