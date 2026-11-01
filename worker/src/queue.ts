import type pg from "pg";

export interface Job {
  id: string;
  sourceId: string;
  params: Record<string, unknown>;
  attempts: number;
}

interface JobRow {
  id: string;
  source_id: string;
  params: Record<string, unknown>;
  attempts: number;
}

const toJob = (r: JobRow): Job => ({
  id: r.id,
  sourceId: r.source_id,
  params: r.params,
  attempts: r.attempts,
});

/** Claims the next due job; concurrent workers never get the same row (SKIP LOCKED). */
export async function claimJob(pool: pg.Pool, workerId: string): Promise<Job | undefined> {
  const { rows } = await pool.query<JobRow>(
    `UPDATE crawl_jobs SET status = 'running', locked_by = $1, started_at = now(),
            heartbeat_at = now(), attempts = attempts + 1
     WHERE id = (SELECT id FROM crawl_jobs WHERE status = 'queued' AND run_after <= now()
                 ORDER BY run_after, id FOR UPDATE SKIP LOCKED LIMIT 1)
     RETURNING id::text, source_id::text, params, attempts`,
    [workerId],
  );
  const row = rows[0];
  return row ? toJob(row) : undefined;
}

/** Returns false when this worker no longer owns the job (it was reaped or cancelled). */
export async function heartbeat(pool: pg.Pool, jobId: string, workerId: string): Promise<boolean> {
  const r = await pool.query(
    "UPDATE crawl_jobs SET heartbeat_at = now() WHERE id = $1 AND locked_by = $2 AND status = 'running'",
    [jobId, workerId],
  );
  return r.rowCount === 1;
}

export interface Counters {
  fetched: number;
  quarantined: number;
  errors: number;
}

export async function finishJob(
  pool: pg.Pool,
  jobId: string,
  workerId: string,
  counters: Counters,
): Promise<boolean> {
  const r = await pool.query(
    `UPDATE crawl_jobs SET status = 'succeeded', finished_at = now(), fetched_count = $3,
            quarantined_count = $4, error_count = $5
     WHERE id = $1 AND locked_by = $2 AND status = 'running'`,
    [jobId, workerId, counters.fetched, counters.quarantined, counters.errors],
  );
  return r.rowCount === 1;
}

/** Records the error; retries with backoff until `maxAttempts`, or fails at once when `retry` is false. */
export async function failJob(
  pool: pg.Pool,
  job: Job,
  workerId: string,
  kind: string,
  message: string,
  opts: { maxAttempts: number; retry: boolean },
): Promise<boolean> {
  const again = opts.retry && job.attempts < opts.maxAttempts;
  const r = await pool.query(
    `UPDATE crawl_jobs SET status = $3, locked_by = NULL, heartbeat_at = NULL,
            run_after = now() + make_interval(secs => $4::int),
            finished_at = CASE WHEN $3 = 'failed' THEN now() ELSE NULL END,
            error_count = error_count + 1
     WHERE id = $1 AND locked_by = $2 AND status = 'running'`,
    [job.id, workerId, again ? "queued" : "failed", 30 * 2 ** job.attempts],
  );
  if (r.rowCount !== 1) return false;
  await pool.query("INSERT INTO crawl_errors (crawl_job_id, kind, message) VALUES ($1, $2, $3)", [
    job.id,
    kind,
    message.slice(0, 500),
  ]);
  return true;
}

/** Puts jobs whose worker stopped heartbeating back in the queue (or fails them after max attempts). */
export async function reapStaleJobs(
  pool: pg.Pool,
  staleSeconds: number,
  maxAttempts: number,
): Promise<number> {
  const { rows } = await pool.query<{ id: string }>(
    `UPDATE crawl_jobs SET locked_by = NULL, heartbeat_at = NULL,
            status = CASE WHEN attempts >= $2 THEN 'failed' ELSE 'queued' END,
            finished_at = CASE WHEN attempts >= $2 THEN now() ELSE NULL END,
            error_count = error_count + 1
     WHERE status = 'running' AND heartbeat_at < now() - make_interval(secs => $1::int)
     RETURNING id::text`,
    [staleSeconds, maxAttempts],
  );
  for (const row of rows)
    await pool.query(
      "INSERT INTO crawl_errors (crawl_job_id, kind, message) VALUES ($1, 'reaped', 'worker stopped heartbeating')",
      [row.id],
    );
  return rows.length;
}
