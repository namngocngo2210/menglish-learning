import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { claimJob, failJob, finishJob, heartbeat, reapStaleJobs } from "../src/queue";
import { ADMIN_URL, createWorkerDb } from "./helpers";
import type { TestDb } from "./helpers";

describe.skipIf(ADMIN_URL === undefined)("crawl queue", () => {
  let db: TestDb;
  beforeAll(async () => {
    db = await createWorkerDb();
  });
  afterAll(async () => {
    await db.remove();
  });
  beforeEach(async () => {
    await db.admin.query("DELETE FROM crawl_jobs");
  });
  const enqueue = async (n = 1): Promise<void> => {
    for (let i = 0; i < n; i++)
      await db.admin.query(
        "INSERT INTO crawl_jobs (source_id) SELECT id FROM sources WHERE code = 'voa-learning-english'",
      );
  };
  const status = async (): Promise<string[]> =>
    (
      await db.admin.query<{ status: string }>("SELECT status FROM crawl_jobs ORDER BY id")
    ).rows.map((r) => r.status);

  it("hands each queued job to exactly one of many concurrent claimers", async () => {
    await enqueue(5);
    const claims = await Promise.all(
      Array.from({ length: 12 }, (_, i) => claimJob(db.worker, `w${String(i)}`)),
    );
    const ids = claims.filter((j) => j !== undefined).map((j) => j.id);
    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
  });

  it("does not claim jobs that are not due yet", async () => {
    await enqueue();
    await db.admin.query("UPDATE crawl_jobs SET run_after = now() + interval '1 hour'");
    expect(await claimJob(db.worker, "w1")).toBeUndefined();
  });

  it("finishes only for the owning worker", async () => {
    await enqueue();
    const job = await claimJob(db.worker, "w1");
    expect(job).toBeDefined();
    const counters = { fetched: 4, quarantined: 2, errors: 0 };
    expect(await finishJob(db.worker, job?.id ?? "", "w2", counters)).toBe(false);
    expect(await heartbeat(db.worker, job?.id ?? "", "w1")).toBe(true);
    expect(await finishJob(db.worker, job?.id ?? "", "w1", counters)).toBe(true);
    expect(await status()).toEqual(["succeeded"]);
  });

  it("requeues with backoff on failure and fails for good after max attempts", async () => {
    await enqueue();
    const opts = { maxAttempts: 2, retry: true };
    const first = await claimJob(db.worker, "w1");
    if (!first) throw new Error("no job");
    expect(await failJob(db.worker, first, "w1", "crawl_failed", "boom", opts)).toBe(true);
    expect(await status()).toEqual(["queued"]);
    expect(await claimJob(db.worker, "w1")).toBeUndefined(); // backoff: run_after is in the future
    await db.admin.query("UPDATE crawl_jobs SET run_after = now()");
    const second = await claimJob(db.worker, "w1");
    if (!second) throw new Error("no job");
    expect(second.attempts).toBe(2);
    await failJob(db.worker, second, "w1", "crawl_failed", "boom again", opts);
    expect(await status()).toEqual(["failed"]);
    const errors = await db.admin.query("SELECT count(*)::int AS n FROM crawl_errors");
    expect(errors.rows[0]).toEqual({ n: 2 });
  });

  it("fails at once when retry is false", async () => {
    await enqueue();
    const job = await claimJob(db.worker, "w1");
    if (!job) throw new Error("no job");
    await failJob(db.worker, job, "w1", "source_disabled", "off", { maxAttempts: 3, retry: false });
    expect(await status()).toEqual(["failed"]);
  });

  it("reaps a job whose worker died, lets another worker re-claim it, and ignores the zombie's late result", async () => {
    await enqueue();
    const dead = await claimJob(db.worker, "dead-worker");
    if (!dead) throw new Error("no job");
    expect(await reapStaleJobs(db.worker, 300, 3)).toBe(0); // still fresh
    await db.admin.query("UPDATE crawl_jobs SET heartbeat_at = now() - interval '10 minutes'");
    expect(await reapStaleJobs(db.worker, 300, 3)).toBe(1);
    expect(await status()).toEqual(["queued"]);
    const again = await claimJob(db.worker, "live-worker");
    expect(again?.id).toBe(dead.id);
    expect(await heartbeat(db.worker, dead.id, "dead-worker")).toBe(false);
    expect(
      await finishJob(db.worker, dead.id, "dead-worker", { fetched: 1, quarantined: 1, errors: 0 }),
    ).toBe(false);
    expect(
      await finishJob(db.worker, dead.id, "live-worker", { fetched: 1, quarantined: 1, errors: 0 }),
    ).toBe(true);
    const reaped = await db.admin.query("SELECT kind FROM crawl_errors WHERE kind = 'reaped'");
    expect(reaped.rowCount).toBe(1);
  });

  it("fails a reaped job that has used all its attempts", async () => {
    await enqueue();
    await db.admin.query(
      "UPDATE crawl_jobs SET status = 'running', locked_by = 'x', attempts = 3, heartbeat_at = now() - interval '1 hour'",
    );
    expect(await reapStaleJobs(db.worker, 300, 3)).toBe(1);
    expect(await status()).toEqual(["failed"]);
  });
});
